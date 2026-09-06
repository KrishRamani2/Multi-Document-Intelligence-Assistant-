import os
import re
import uuid
import hashlib
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

load_dotenv()

from loguru import logger
from app.db.models import IngestJobModel, DocumentModel, JobStatus
from app.db.repositories.job_repository import JobRepository
from app.db.repositories.document_repository import DocumentRepository
from app.utils import compute_file_hash, get_file_size


CDN_BASE = os.getenv("CDN_BASE", "https://5kcn84nzfr.ucarecd.net")
DOWNLOAD_DIR = "./downloads"
DIRECT_EXTRACT_TYPES = {"youtube", "audio"}


def extract_uuid(url_or_uuid: str) -> Optional[str]:
    match = re.search(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        url_or_uuid.strip(),
        re.IGNORECASE,
    )
    return match.group(0) if match else None


def download_file(url_or_uuid: str, dest_dir: str = DOWNLOAD_DIR) -> Optional[str]:
    import requests

    uuid_val = extract_uuid(url_or_uuid)
    if not uuid_val:
        logger.error(f"Failed to extract UUID from: {url_or_uuid}")
        return None

    try:
        resp = requests.get(
            f"{CDN_BASE.rstrip('/')}/{uuid_val}/", stream=True, timeout=30
        )
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return None

    # Get filename
    filename = None
    cd = resp.headers.get("Content-Disposition", "")
    if "filename=" in cd:
        filename = unquote(cd.split("filename=")[-1].strip().strip('"').split(";")[0])
    if not filename:
        path = urlparse(resp.url).path.rstrip("/")
        segment = path.split("/")[-1] if path else ""
        if "." in segment:
            filename = unquote(segment)
    if not filename:
        ct = resp.headers.get("Content-Type", "").split(";")[0].strip()
        ext_map = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "text/plain": ".txt",
            "text/csv": ".csv",
        }
        filename = f"{uuid_val}{ext_map.get(ct, '')}"

    dest_path = Path(dest_dir) / filename
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # Handle duplicates
    counter = 1
    stem, suffix = dest_path.stem, dest_path.suffix
    while dest_path.exists():
        dest_path = Path(dest_dir) / f"{stem} ({counter}){suffix}"
        counter += 1

    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return str(dest_path) if dest_path.exists() else None


def download_external_url(url: str, dest_dir: str = DOWNLOAD_DIR) -> Optional[str]:
    import requests

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, stream=True, timeout=60, verify=False, headers=headers)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return None

    filename = None
    cd = resp.headers.get("Content-Disposition", "")
    if "filename=" in cd:
        filename = unquote(cd.split("filename=")[-1].strip().strip('"').split(";")[0])
    if not filename:
        path = urlparse(url).path.rstrip("/")
        segment = path.split("/")[-1] if path else ""
        if "." in segment:
            filename = unquote(segment)
    if not filename:
        ct = resp.headers.get("Content-Type", "").split(";")[0].strip()
        ext_map = {
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "text/html": ".html",
        }
        filename = f"external_{uuid.uuid4()}{ext_map.get(ct, '')}"

    dest_path = Path(dest_dir) / filename
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    counter = 1
    stem, suffix = dest_path.stem, dest_path.suffix
    while dest_path.exists():
        dest_path = Path(dest_dir) / f"{stem} ({counter}){suffix}"
        counter += 1

    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return str(dest_path) if dest_path.exists() else None


async def create_job(
    source_type: str, file_url: str, source_location: str = "cdn", redact: bool = False
) -> IngestJobModel:
    job = IngestJobModel(
        job_id=str(uuid.uuid4()),
        source_type=source_type,
        file_url=file_url,
        source_location=source_location,
        redact=redact,
        status=JobStatus.PENDING,
    )
    return await JobRepository.create(job)


async def get_job(job_id: str) -> Optional[IngestJobModel]:
    return await JobRepository.get_by_id(job_id)


async def process_job(job_id: str):
    """Main ingestion pipeline."""
    logger.info(f"Processing job: {job_id}")

    job = await JobRepository.get_by_id(job_id)
    if not job:
        logger.error(f"Job not found: {job_id}")
        return

    await JobRepository.update_status(job_id, JobStatus.PROCESSING)

    try:
        # === STEP 1: Resolve source ===
        file_path = None
        use_file_path = True

        # Direct extract types (YouTube, Audio) - don't download, extract from URL directly
        if job.source_type in DIRECT_EXTRACT_TYPES:
            logger.info(f"Step 1: Direct extract ({job.source_type})")
            file_path = None
            use_file_path = False

        elif job.source_location == "local":
            logger.info("Step 1: Using local file")
            file_path = job.file_url
            if not Path(file_path).exists():
                raise Exception(f"Local file not found: {file_path}")

        elif job.source_location == "url":
            logger.info("Step 1: Downloading external URL")
            file_path = download_external_url(job.file_url)
            if not file_path:
                raise Exception(f"Failed to download: {job.file_url}")

        else:  # cdn
            logger.info("Step 1: Downloading from CDN")
            file_path = download_file(job.file_url)
            if not file_path:
                raise Exception("Failed to download from CDN")

        # === STEP 2: Compute hash & check cache ===
        file_hash = None
        file_size = 0

        if use_file_path and file_path:
            logger.info("Step 2: Compute file hash & check cache")
            file_hash = compute_file_hash(file_path)
            file_size = get_file_size(file_path)

            existing = await DocumentRepository.get_by_file_hash(file_hash)
            if existing:
                logger.info(
                    f"Found cached document: {existing.document_id} - forcing re-embed"
                )
                # Force fresh processing even for cached docs
                file_hash = None  # Reset to trigger fresh processing

        # === STEP 3: Extract ===
        logger.info("Step 3: Extract content")
        import ingestion.extractors  # Ensures extractors are registered
        from ingestion.models import SourceType
        from ingestion import ExtractorFactory, HierarchicalChunker

        source = job.file_url if not use_file_path else file_path
        extractor = ExtractorFactory.get_extractor(SourceType(job.source_type))
        document = extractor.extract(source)
        logger.info(f"Extracted: {len(document.elements)} elements")

        # === STEP 4: Chunk ===
        logger.info("Step 4: Chunk document")
        document = HierarchicalChunker().chunk_document(document)
        logger.info(
            f"Chunks: {len(document.section_chunks)} sections, {len(document.passage_chunks)} passages"
        )

        # === STEP 5: Middleware ===
        logger.info("Step 5: Apply middleware")
        from ingestion import ChunksMiddleware, MiddlewareConfig

        # Use job.redact (from request) or fall back to env var
        redact_enabled = (
            job.redact
            if hasattr(job, "redact") and job.redact
            else (os.getenv("REDACT_ENABLED", "false").lower() == "true")
        )
        config = MiddlewareConfig(
            dedupe_enabled=True,
            dedupe_threshold=0.98,
            temporal_enabled=True,
            redact_enabled=redact_enabled,
        )
        document = ChunksMiddleware(config).process(document)
        if redact_enabled:
            logger.info("PII redaction applied")

        # === STEP 6: Embed ===
        logger.info("Step 6: Generate embeddings")
        from embeddings.service import EmbeddingService

        embed_service = EmbeddingService(
            provider=os.getenv("EMBEDDING_PROVIDER", "gemini")
        )
        embed_result = embed_service.generate_embeddings(document)
        logger.info(
            f"Embeddings: {embed_result.chunks_count} chunks from {embed_result.provider}"
        )

        # === STEP 7: Save to DB ===
        logger.info("Step 7: Save to database")
        from app.db.models import EmbeddingInfo

        chunks_data = []
        for c in document.passage_chunks or document.section_chunks or []:
            chunk_data = {
                "chunk_id": c.chunk_id,
                "text": c.text,
                "level": c.level.value,
                "heading_path": c.heading_path,
            }
            # Include tables metadata
            if c.metadata and c.metadata.get("tables"):
                chunk_data["tables"] = c.metadata["tables"]
            # Include images metadata
            if c.metadata and c.metadata.get("images"):
                chunk_data["images"] = c.metadata["images"]
            # Include element types
            if c.element_types:
                chunk_data["element_types"] = [e.value for e in c.element_types]
            chunks_data.append(chunk_data)

        doc_model = DocumentModel(
            document_id=document.document_id,
            source_type=document.source_type.value,
            source_name=document.metadata.source_name,
            source_url=document.metadata.source_url,
            file_hash=file_hash or f"stream_{document.document_id}",
            file_size=file_size,
            local_path=file_path,
            hierarchical_chunks={
                "sections": [
                    {
                        "chunk_id": c.chunk_id,
                        "text": c.text,
                        "level": c.level.value,
                        "start_char": c.start_char,
                        "end_char": c.end_char,
                        "heading_path": c.heading_path,
                        "tables": c.metadata.get("tables", []) if c.metadata else [],
                        "images": c.metadata.get("images", []) if c.metadata else [],
                    }
                    for c in (document.section_chunks or [])
                ],
                "passages": [
                    {
                        "chunk_id": c.chunk_id,
                        "text": c.text,
                        "level": c.level.value,
                        "start_char": c.start_char,
                        "end_char": c.end_char,
                        "heading_path": c.heading_path,
                        "tables": c.metadata.get("tables", []) if c.metadata else [],
                        "images": c.metadata.get("images", []) if c.metadata else [],
                    }
                    for c in (document.passage_chunks or [])
                ],
            },
            sections_count=len(document.section_chunks)
            if document.section_chunks
            else 0,
            passages_count=len(document.passage_chunks)
            if document.passage_chunks
            else 0,
            embedding_info=EmbeddingInfo(
                generated=True,
                provider=embed_result.provider,
                model=embed_result.model,
                dimensions=embed_result.dimensions,
                chunks_embedded=embed_result.chunks_count,
            ),
        )
        await DocumentRepository.create(doc_model)

        # === STEP 8: Save to vector store ===
        logger.info("Step 8: Save to vector store")
        from app.vector_store import get_vector_store

        vector_store = get_vector_store()

        embeddings_data = [
            c.embedding
            for c in (document.passage_chunks or document.section_chunks or [])
            if c.embedding
        ]
        if chunks_data and embeddings_data:
            await vector_store.ingest(
                document_id=document.document_id,
                document_name=document.metadata.source_name,
                chunks=chunks_data,
                embeddings=embeddings_data,
            )
            logger.info(f"Indexed {len(chunks_data)} chunks")

        # === STEP 9: Complete ===
        await JobRepository.update_status(
            job_id,
            JobStatus.COMPLETED,
            document_id=document.document_id,
            chunks_count=len(chunks_data),
        )
        logger.info(f"Job completed: {job_id}")

    except Exception as e:
        logger.error(f"Error processing job: {e}")
        await JobRepository.update_status(job_id, JobStatus.FAILED, error=str(e))
        logger.info(f"Job marked as FAILED: {job_id}")

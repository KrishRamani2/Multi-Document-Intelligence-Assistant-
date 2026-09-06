from fastapi import APIRouter, HTTPException
from typing import Optional, List
from loguru import logger
from pydantic import BaseModel

from app.db.repositories.document_repository import DocumentRepository
from app.db.models import DocumentModel, ChunkType


router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentSummary(BaseModel):
    """Summary of a document."""

    document_id: str
    source_name: str
    source_type: str
    created_at: str
    chunks_count: int


class DocumentListResponse(BaseModel):
    """List of documents."""

    documents: List[DocumentSummary]
    total: int


class HierarchicalChunksResponse(BaseModel):
    document_id: str
    chunk_type: str  # sections, passages, sentences
    chunks: List[dict]
    count: int


class RecursiveChunksResponse(BaseModel):
    document_id: str
    chunk_type: str = "recursive"
    chunks: List[dict]
    count: int


class AllChunksResponse(BaseModel):
    document_id: str
    hierarchical: dict
    recursive: dict
    summary: dict


@router.get("/{document_id}")
async def get_document(document_id: str):
    """
    Get full document with metadata, file info, and all chunks.

    Returns:
        - document_id: Unique identifier
        - source_type: pdf, html, youtube, audio, image, csv, json, md, text
        - source_name: Original filename
        - source_url: CDN URL if provided
        - file: hash, size, local_path
        - hierarchical_chunks: sections, passages, sentences (with heading_path)
        - recursive_chunks: fixed-size character chunks
        - embedding_info: provider, model, dimensions, file_path
        - created_at, updated_at
    """
    logger.info(f"GET /documents/{document_id}")
    doc = await DocumentRepository.get_by_id(document_id)
    if not doc:
        logger.warning(f"Document not found: {document_id}")
        raise HTTPException(status_code=404, detail="Document not found")
    logger.info(f"Document found: {document_id}")
    return doc


@router.get("/{document_id}/hierarchical", response_model=HierarchicalChunksResponse)
async def get_hierarchical_chunks(
    document_id: str,
    chunk_type: str = "passages",  # sections, passages, sentences
):
    """
    Get hierarchical (semantic) chunks - understands document structure.

    Options:
    - sections: Full sections with headings (best for table of contents)
    - passages: Paragraph-sized chunks (default, best for display)
    - sentences: Individual sentences (best for fine-grained analysis)

    Each chunk includes:
    - chunk_id: Unique identifier
    - text: The actual content
    - level: section, passage, or sentence
    - start_char, end_char: Position in original document
    - heading_path: "Section > Subsection > ..." (for navigation)
    """
    logger.info(f"GET /documents/{document_id}/hierarchical?chunk_type={chunk_type}")

    if chunk_type not in ["sections", "passages", "sentences"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid chunk_type: {chunk_type}. Use: sections, passages, sentences",
        )

    doc = await DocumentRepository.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = doc.hierarchical_chunks.get(chunk_type, [])
    count = len(chunks)
    logger.info(f"Returning {count} {chunk_type} chunks")

    return HierarchicalChunksResponse(
        document_id=document_id,
        chunk_type=chunk_type,
        chunks=chunks,
        count=count,
    )


@router.get("/{document_id}/recursive", response_model=RecursiveChunksResponse)
async def get_recursive_chunks(document_id: str):
    """
    Get recursive (character-based) chunks - fixed size with overlap.

    These are created by splitting text at character boundaries:
    - chunk_size: 1000 characters
    - overlap: 100 characters (between consecutive chunks)

    Best for:
    - Semantic search (consistent embedding sizes)
    - When document structure is not important
    - Building vector index for similarity search

    Each chunk includes:
    - chunk_id: Unique identifier
    - text: The chunk content
    - level: "chunk"
    - start_char, end_char: Position in original document
    """
    logger.info(f"GET /documents/{document_id}/recursive")

    doc = await DocumentRepository.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = doc.recursive_chunks
    count = len(chunks)
    logger.info(f"Returning {count} recursive chunks")

    return RecursiveChunksResponse(
        document_id=document_id,
        chunk_type="recursive",
        chunks=chunks,
        count=count,
    )


@router.get("/{document_id}/chunks", response_model=AllChunksResponse)
async def get_all_chunks(document_id: str):
    """
    Get all chunks (both hierarchical and recursive) in one call.

    Returns:
    - hierarchical: sections, passages, sentences
    - recursive: fixed-size character chunks
    - summary: counts for each type
    """
    logger.info(f"GET /documents/{document_id}/chunks")

    doc = await DocumentRepository.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return AllChunksResponse(
        document_id=document_id,
        hierarchical=doc.hierarchical_chunks,
        recursive={"chunks": doc.recursive_chunks, "count": doc.recursive_chunks_count},
        summary={
            "sections": doc.sections_count,
            "passages": doc.passages_count,
            "sentences": doc.sentences_count,
            "recursive": doc.recursive_chunks_count,
        },
    )


@router.get("/by-hash/{file_hash}")
async def get_document_by_hash(file_hash: str):
    """Get a document by file hash (for deduplication)."""
    logger.info(f"GET /documents/by-hash/{file_hash}")
    doc = await DocumentRepository.get_by_file_hash(file_hash)
    if not doc:
        logger.warning(f"Document not found for hash: {file_hash}")
        raise HTTPException(status_code=404, detail="Document not found")
    logger.info(f"Document found: {doc.document_id}")
    return doc


@router.get("/by-hash/{file_hash}/hierarchical")
async def get_hierarchical_chunks_by_hash(file_hash: str, chunk_type: str = "passages"):
    """Get hierarchical chunks by file hash."""
    doc = await DocumentRepository.get_by_file_hash(file_hash)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if chunk_type not in ["sections", "passages", "sentences"]:
        raise HTTPException(status_code=400, detail=f"Invalid chunk_type: {chunk_type}")

    chunks = doc.hierarchical_chunks.get(chunk_type, [])
    return HierarchicalChunksResponse(
        document_id=doc.document_id,
        chunk_type=chunk_type,
        chunks=chunks,
        count=len(chunks),
    )


@router.get("/by-hash/{file_hash}/recursive")
async def get_recursive_chunks_by_hash(file_hash: str):
    """Get recursive chunks by file hash."""
    doc = await DocumentRepository.get_by_file_hash(file_hash)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return RecursiveChunksResponse(
        document_id=doc.document_id,
        chunk_type="recursive",
        chunks=doc.recursive_chunks,
        count=len(doc.recursive_chunks),
    )


@router.get("/summary/{document_id}", response_model=DocumentSummary)
async def get_document_summary(document_id: str):
    """
    Get document summary.

    Returns:
        - document_id: Unique identifier
        - source_name: Original filename
        - source_type: pdf, html, youtube, etc.
        - created_at: ISO timestamp
        - chunks_count: Total chunks
    """
    doc = await DocumentRepository.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_count = (
        (doc.passages_count or 0)
        + (doc.sections_count or 0)
        + (doc.recursive_chunks_count or 0)
    )

    return DocumentSummary(
        document_id=doc.document_id,
        source_name=doc.source_name,
        source_type=doc.source_type,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        chunks_count=chunks_count,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(limit: int = 50):
    """
    List all documents.

    Returns:
        - documents: List of {document_id, source_name, source_type, created_at, chunks_count}
        - total: Total count
    """
    logger.info(f"GET /documents?limit={limit}")
    docs = await DocumentRepository.list_recent(limit)

    documents = []
    for doc in docs:
        chunks_count = (
            (doc.passages_count or 0)
            + (doc.sections_count or 0)
            + (doc.recursive_chunks_count or 0)
        )
        documents.append(
            DocumentSummary(
                document_id=doc.document_id,
                source_name=doc.source_name,
                source_type=doc.source_type,
                created_at=doc.created_at.isoformat() if doc.created_at else "",
                chunks_count=chunks_count,
            )
        )

    return DocumentListResponse(
        documents=documents,
        total=len(documents),
    )

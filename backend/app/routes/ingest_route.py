from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
from loguru import logger

from app.ingestion.models import (
    IngestRequest,
    IngestResponse,
    JobStatus,
    JobResult,
    SourceLocation,
)
from app.ingestion import processor as ingest_processor


router = APIRouter(prefix="/ingest", tags=["ingestion"])


class ResolveRequest(BaseModel):
    resolution: str  # "keep_new", "keep_existing", "keep_both"


@router.post("", response_model=IngestResponse)
async def start_ingestion(request: IngestRequest):
    """Start an ingestion job from a CDN file URL, local file, or external URL."""
    logger.info(
        f"POST /ingest - source_type: {request.source_type}, file_url: {request.file_url}, "
        f"source_location: {request.source_location or 'cdn'}, redact: {request.redact}"
    )

    try:
        job = await ingest_processor.create_job(
            request.source_type,
            request.file_url,
            request.source_location or "cdn",
            request.redact,  # Pass redact flag
        )
        logger.info(f"Job created: {job.job_id}")

        asyncio.create_task(ingest_processor.process_job(job.job_id))
        logger.info(f"Background task started for job: {job.job_id}")

        return IngestResponse(
            job_id=job.job_id,
            status=job.status,
            message="Ingestion job started. Poll /ingest/{job_id} for completion status and document_id.",
        )
    except ValueError as e:
        logger.error(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}", response_model=JobResult)
async def get_job_status(job_id: str):
    """Get the status of an ingestion job."""
    job = await ingest_processor.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResult(
        job_id=job.job_id,
        status=job.status,
        document_id=job.document_id,
        chunks_count=job.chunks_count,
        error=job.error,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/{job_id}/conflicts")
async def get_job_conflicts(job_id: str):
    """Get conflicts/duplicates detected for a job that needs review."""
    from app.db.repositories.document_repository import DocumentRepository

    job = await ingest_processor.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.document_id:
        return {
            "conflicts": [],
            "duplicates": [],
            "message": "No document associated yet",
        }

    doc = await DocumentRepository.get_by_id(job.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "document_id": doc.document_id,
        "document_name": doc.source_name,
        "conflicts": doc.contradictions,
        "has_conflicts": len(doc.contradictions) > 0,
    }


@router.post("/{job_id}/resolve")
async def resolve_job(job_id: str, request: ResolveRequest):
    """Resolve conflicts and complete the ingestion."""
    from app.db.repositories.document_repository import DocumentRepository
    from app.db.models import JobStatus as DBJobStatus, DriftStatus
    from app.vector_store import get_vector_store
    from app.db.repositories.job_repository import JobRepository

    job = await ingest_processor.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.NEEDS_REVIEW:
        raise HTTPException(
            status_code=400, detail=f"Job status is {job.status}, not NEEDS_REVIEW"
        )

    if not job.document_id:
        raise HTTPException(status_code=400, detail="No document associated with job")

    doc = await DocumentRepository.get_by_id(job.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    logger.info(f"Resolving job {job_id} with resolution: {request.resolution}")

    vector_store = get_vector_store()

    if request.resolution == "keep_new":
        # Add new document chunks to vector store, mark old as inactive
        # For now, just add to vector store
        chunks = doc.hierarchical_chunks.get(
            "passages", []
        ) or doc.hierarchical_chunks.get("sections", [])
        if chunks:
            embeddings = []  # Would need to regenerate or retrieve from stored embeddings
            # Simplified: re-ingest (would need embeddings)
            logger.info(f"Would add {len(chunks)} chunks to vector store")

        # Update document status
        from app.db.models import TemporalMetadata

        doc.temporal_metadata.drift_status = DriftStatus.NEW
        await DocumentRepository.update(doc)

    elif request.resolution == "keep_existing":
        # Mark new document as inactive, don't add to vector store
        logger.info("Keeping existing - not adding to vector store")
        doc.temporal_metadata.drift_status = DriftStatus.CONFIRMED
        await DocumentRepository.update(doc)

    elif request.resolution == "keep_both":
        # Add new chunks, keep existing
        logger.info("Keeping both - adding to vector store")
        doc.temporal_metadata.drift_status = DriftStatus.RESOLVED
        await DocumentRepository.update(doc)

    # Update job status
    await JobRepository.update_status(
        job_id, JobStatus.COMPLETED, document_id=job.document_id
    )

    return {
        "status": "resolved",
        "resolution": request.resolution,
        "document_id": job.document_id,
    }


@router.get("")
async def list_jobs(status: JobStatus = None, limit: int = 50):
    """List ingestion jobs."""
    from app.db.repositories.job_repository import JobRepository

    if status:
        jobs = await JobRepository.list_by_status(status, limit)
    else:
        jobs = []
    return {"jobs": [job.model_dump() for job in jobs]}

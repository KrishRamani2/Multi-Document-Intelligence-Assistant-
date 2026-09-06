from typing import Optional, List
from datetime import datetime
from loguru import logger

from app.db.connection import get_database
from app.db.models import IngestJobModel, JobStatus


class JobRepository:
    collection_name = "ingest_jobs"

    @classmethod
    def get_collection(cls):
        return get_database()[cls.collection_name]

    @classmethod
    async def create(cls, job: IngestJobModel) -> IngestJobModel:
        logger.info(f"Creating job: {job.job_id}")
        collection = cls.get_collection()
        await collection.insert_one(job.model_dump())
        logger.info(f"Job created in DB: {job.job_id}")
        return job

    @classmethod
    async def get_by_id(cls, job_id: str) -> Optional[IngestJobModel]:
        logger.info(f"get_by_id: {job_id}")
        collection = cls.get_collection()
        doc = await collection.find_one({"job_id": job_id})
        if doc:
            doc.pop("_id", None)
            logger.info(f"Found job: {job_id}")
            return IngestJobModel(**doc)
        logger.info(f"Job not found: {job_id}")
        return None

    @classmethod
    async def update_status(
        cls,
        job_id: str,
        status: JobStatus,
        error: Optional[str] = None,
        document_id: Optional[str] = None,
        chunks_count: Optional[int] = None,
        file_hash: Optional[str] = None,
        local_file_path: Optional[str] = None,
    ):
        logger.info(f"update_status: {job_id} -> {status}")
        collection = cls.get_collection()
        update_data = {
            "status": status.value,
            "completed_at": datetime.now()
            if status in [JobStatus.COMPLETED, JobStatus.FAILED]
            else None,
        }
        if error:
            update_data["error"] = error
        if document_id:
            update_data["document_id"] = document_id
        if chunks_count is not None:
            update_data["chunks_count"] = chunks_count
        if file_hash:
            update_data["file_hash"] = file_hash
        if local_file_path:
            update_data["local_file_path"] = local_file_path

        await collection.update_one({"job_id": job_id}, {"$set": update_data})
        logger.info(f"Status updated: {job_id} -> {status}")

    @classmethod
    async def get_by_file_hash(cls, file_hash: str) -> Optional[IngestJobModel]:
        logger.info(f"get_by_file_hash: {file_hash[:16]}...")
        collection = cls.get_collection()
        doc = await collection.find_one(
            {"file_hash": file_hash, "status": JobStatus.COMPLETED}
        )
        if doc:
            doc.pop("_id", None)
            logger.info(f"Found job by hash: {doc['job_id']}")
            return IngestJobModel(**doc)
        logger.info(f"No job found for hash")
        return None

    @classmethod
    async def list_by_status(
        cls, status: JobStatus, limit: int = 50
    ) -> List[IngestJobModel]:
        logger.info(f"list_by_status: {status}, limit: {limit}")
        collection = cls.get_collection()
        cursor = collection.find({"status": status.value}).limit(limit)
        jobs = []
        async for doc in cursor:
            doc.pop("_id", None)
            jobs.append(IngestJobModel(**doc))
        logger.info(f"Found {len(jobs)} jobs")
        return jobs

from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceLocation(str, Enum):
    CDN = "cdn"  # Default: download from internal CDN using UUID
    LOCAL = "local"  # Local file path (no download)
    URL = "url"  # External URL (no download, just fetch)


class IngestRequest(BaseModel):
    source_type: str
    file_url: str
    source_location: Optional[SourceLocation] = None  # Defaults to "cdn"
    redact: Optional[bool] = False  # Enable PII redaction


class IngestResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str
    document_id: Optional[str] = None  # Returned if file already exists (cached)


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    document_id: Optional[str] = None
    chunks_count: Optional[int] = None
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

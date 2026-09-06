from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"  # New status for contradictions


class DriftStatus(str, Enum):
    """Status of document in temporal context."""

    NEW = "new"  # Never compared
    CONFIRMED = "confirmed"  # Agrees with existing knowledge
    CONTRADICTION = "contradiction"  # Contradicts existing knowledge
    NEEDS_REVIEW = "needs_review"  # User needs to decide
    RESOLVED = "resolved"  # User made a choice


class ConflictType(str, Enum):
    """Type of contradiction detected."""

    DIRECT = "direct"  # Explicitly contradicts
    PARTIAL = "partial"  # Partially contradicts
    EVOLVING = "evolving"  # Updates/evolves existing info


class NLILabel(str, Enum):
    """NLI model labels."""

    ENTAILMENT = "entailment"  # Agrees
    CONTRADICTION = "contradiction"
    NEUTRAL = "neutral"


class SourceType(str, Enum):
    PDF = "pdf"
    HTML = "html"
    YOUTUBE = "youtube"
    AUDIO = "audio"
    IMAGE = "image"
    CSV = "csv"
    JSON = "json"
    MARKDOWN = "md"
    TEXT = "text"


class ChunkType(str, Enum):
    """Chunk types available for retrieval."""

    # Hierarchical (semantic)
    SECTIONS = "sections"
    PASSAGES = "passages"
    SENTENCES = "sentences"
    # Recursive (character-based)
    RECURSIVE = "recursive"
    # All
    ALL = "all"


class TemporalMetadata(BaseModel):
    """Metadata for temporal drift tracking."""

    drift_status: DriftStatus = DriftStatus.NEW
    version: int = 1
    parent_document_id: Optional[str] = None  # If this replaced an older version
    previous_versions: List[str] = []  # List of older document_ids
    created_at: datetime = Field(default_factory=datetime.now)
    last_verified_at: datetime = Field(default_factory=datetime.now)
    verified_by: Optional[str] = None  # user_id or "auto"


class ContradictionRecord(BaseModel):
    """Record of a contradiction between documents."""

    id: str  # UUID
    new_chunk_id: str
    new_document_id: str
    existing_chunk_id: str
    existing_document_id: str
    existing_document_name: str
    conflict_type: ConflictType
    nli_label: NLILabel
    nli_confidence: float
    cosine_similarity: float
    resolution: Optional[str] = None  # "keep_new", "keep_existing", "keep_both"
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None


class ChunkMetadata(BaseModel):
    """Metadata for individual chunks."""

    chunk_id: str
    is_active: bool = True  # For version tracking
    drift_status: DriftStatus = DriftStatus.NEW
    version: int = 1
    contradiction_ids: List[str] = []  # IDs of contradiction records


class SourceLocation(str, Enum):
    CDN = "cdn"
    LOCAL = "local"
    URL = "url"


class IngestJobModel(BaseModel):
    job_id: str
    source_type: str
    file_url: str
    source_location: Optional[str] = "cdn"  # "cdn", "local", "url"
    redact: bool = False  # Enable PII redaction
    status: JobStatus = JobStatus.PENDING

    file_hash: Optional[str] = None
    local_file_path: Optional[str] = None

    document_id: Optional[str] = None
    chunks_count: Optional[int] = None

    error: Optional[str] = None

    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    class Config:
        use_enum_values = True


class EmbeddingInfo(BaseModel):
    """Information about embeddings for a document."""

    generated: bool = False
    provider: Optional[str] = None  # huggingface, openai, gemini
    model: Optional[str] = None
    dimensions: Optional[int] = None
    chunks_embedded: Optional[int] = None
    file_path: Optional[str] = None  # Path to embeddings JSON file


class DocumentModel(BaseModel):
    document_id: str
    source_type: str
    source_name: str
    source_url: Optional[str] = None

    # File info
    file_hash: str
    file_size: int
    local_path: Optional[str] = None

    # Hierarchical chunks (section -> passage -> sentence)
    hierarchical_chunks: Dict[str, Any] = Field(default_factory=dict)
    sections_count: int = 0
    passages_count: int = 0
    sentences_count: int = 0

    # Recursive character chunks
    recursive_chunks: List[Dict[str, Any]] = Field(default_factory=list)
    recursive_chunks_count: int = 0

    # Embeddings
    embedding_info: Optional[EmbeddingInfo] = None

    # Temporal drift tracking
    temporal_metadata: TemporalMetadata = Field(default_factory=TemporalMetadata)
    chunk_metadata: Dict[str, ChunkMetadata] = Field(
        default_factory=dict
    )  # chunk_id -> metadata
    contradictions: List[ContradictionRecord] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


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


class ElementType(str, Enum):
    TITLE = "Title"
    NARRATIVE_TEXT = "NarrativeText"
    TABLE = "Table"
    TABLE_CHUNK = "TableChunk"
    LIST_ITEM = "ListItem"
    IMAGE = "Image"
    PAGE_BREAK = "PageBreak"
    HEADING = "Heading"
    CODE = "Code"
    FORMULA = "Formula"


class ChunkLevel(str, Enum):
    SECTION = "section"  # Parent: full section with headings
    PASSAGE = "passage"  # Child: paragraph-sized chunk
    SENTENCE = "sentence"  # Child: individual sentences


class DocumentMetadata(BaseModel):
    source_type: SourceType
    source_name: str
    source_url: Optional[str] = None
    author: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    language: Optional[str] = "en"
    page_count: Optional[int] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None

    # Source-specific metadata
    pdf_metadata: Optional[Dict[str, Any]] = None
    html_metadata: Optional[Dict[str, Any]] = None
    youtube_metadata: Optional[Dict[str, Any]] = None
    audio_metadata: Optional[Dict[str, Any]] = None
    image_metadata: Optional[Dict[str, Any]] = None
    csv_metadata: Optional[Dict[str, Any]] = None
    json_metadata: Optional[Dict[str, Any]] = None
    markdown_metadata: Optional[Dict[str, Any]] = None

    # Extra raw data from APIs (transcripts, etc.)
    extra_data: Optional[Dict[str, Any]] = None


class DocumentElement(BaseModel):
    element_id: str
    element_type: ElementType
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Position info
    page_number: Optional[int] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None


class Chunk(BaseModel):
    chunk_id: str
    text: str
    level: ChunkLevel

    # Hierarchy
    parent_chunk_id: Optional[str] = None
    child_chunk_ids: List[str] = Field(default_factory=list)
    chunk_ids: List[str] = Field(default_factory=list)  # For SECTION -> passage mapping

    # Position info - exact character positions in source document
    start_char: int
    end_char: int
    page_number: Optional[int] = None

    # Metadata
    element_types: List[ElementType] = Field(default_factory=list)
    heading_path: Optional[str] = None  # e.g., "Introduction > Background > Problem"
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # For embeddings
    embedding: Optional[List[float]] = None


class Document(BaseModel):
    document_id: str
    source_type: SourceType
    source_name: str
    source_url: Optional[str] = None

    # Original elements from partitioning
    elements: List[DocumentElement] = Field(default_factory=list)

    # Hierarchical chunks
    section_chunks: List[Chunk] = Field(default_factory=list)  # Level.SECTION
    passage_chunks: List[Chunk] = Field(default_factory=list)  # Level.PASSAGE
    sentence_chunks: List[Chunk] = Field(default_factory=list)  # Level.SENTENCE

    metadata: DocumentMetadata

    # PII detection results
    pii_detected: bool = False
    pii_redacted: bool = False
    pii_report: Optional[Dict[str, Any]] = None

    created_at: datetime = Field(default_factory=datetime.now)


class IngestionResult(BaseModel):
    document: Document
    chunks_count: int
    sections_count: int
    passages_count: int
    sentences_count: int
    pii_found: bool
    processing_time_seconds: float
    errors: List[str] = Field(default_factory=list)

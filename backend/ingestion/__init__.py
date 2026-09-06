from ingestion.models import (
    SourceType,
    ElementType,
    ChunkLevel,
    DocumentMetadata,
    DocumentElement,
    Chunk,
    Document,
    IngestionResult,
)
from ingestion.base_extractor import BaseExtractor, ExtractorFactory
from ingestion.chunker import HierarchicalChunker
from ingestion.middleware import ChunksMiddleware, MiddlewareConfig


def __getattr__(name):
    """Lazy load extractors to avoid dependency issues."""
    if name == "extractors":
        import ingestion.extractors

        return ingestion.extractors
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "SourceType",
    "ElementType",
    "ChunkLevel",
    "DocumentMetadata",
    "DocumentElement",
    "Chunk",
    "Document",
    "IngestionResult",
    "BaseExtractor",
    "ExtractorFactory",
    "HierarchicalChunker",
    "ChunksMiddleware",
    "MiddlewareConfig",
]

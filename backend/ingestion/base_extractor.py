from abc import ABC, abstractmethod
from typing import Protocol, Optional, Any, List
from pathlib import Path
from datetime import datetime

from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    DocumentMetadata,
    Chunk,
    ChunkLevel,
    ElementType,
)


class SourceMetadata(Protocol):
    pass


class BaseExtractor(ABC):
    """Abstract base class for all document extractors."""

    @property
    @abstractmethod
    def source_type(self) -> SourceType:
        """Return the source type this extractor handles."""
        pass

    @abstractmethod
    def extract(self, source: str | Path) -> Document:
        """
        Extract content from a source and return a Document.

        Args:
            source: File path, URL, or other source identifier

        Returns:
            Document with elements and metadata
        """
        pass

    @abstractmethod
    def validate(self, source: str | Path) -> bool:
        """
        Validate if the source is accessible and of the expected type.

        Args:
            source: Source to validate

        Returns:
            True if valid, False otherwise
        """
        pass

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """
        Get source-specific metadata. Override in subclasses.

        Args:
            source: Source to get metadata from

        Returns:
            Dictionary of metadata
        """
        return {}

    def _create_document(
        self,
        source_name: str,
        source_url: Optional[str],
        elements: List[DocumentElement],
        metadata: dict[str, Any],
    ) -> Document:
        """Helper to create a Document with generated ID."""
        import uuid

        source_type = self.source_type

        doc_metadata = DocumentMetadata(
            source_type=source_type,
            source_name=source_name,
            source_url=source_url,
            **metadata,
        )

        return Document(
            document_id=str(uuid.uuid4()),
            source_type=source_type,
            source_name=source_name,
            source_url=source_url,
            elements=elements,
            metadata=doc_metadata,
        )

    def _map_element_type(self, unstructured_type: str) -> ElementType:
        """Map unstructured element types to our ElementType enum."""
        mapping = {
            "Title": ElementType.TITLE,
            "NarrativeText": ElementType.NARRATIVE_TEXT,
            "Table": ElementType.TABLE,
            "TableChunk": ElementType.TABLE_CHUNK,
            "ListItem": ElementType.LIST_ITEM,
            "Image": ElementType.IMAGE,
            "PageBreak": ElementType.PAGE_BREAK,
            "Heading": ElementType.HEADING,
            "Code": ElementType.CODE,
            "Formula": ElementType.FORMULA,
        }
        return mapping.get(unstructured_type, ElementType.NARRATIVE_TEXT)

    def _parse_page_number(self, metadata: dict) -> Optional[int]:
        """Extract page number from element metadata."""
        if hasattr(metadata, "page_number") and metadata.page_number:
            return metadata.page_number
        if isinstance(metadata, dict):
            return metadata.get("page_number")
        return None


class ExtractorFactory:
    """Factory to get the appropriate extractor for a source type."""

    _extractors: dict[SourceType, type[BaseExtractor]] = {}

    @classmethod
    def register(cls, source_type: SourceType, extractor_class: type[BaseExtractor]):
        """Register an extractor class for a source type."""
        cls._extractors[source_type] = extractor_class

    @classmethod
    def get_extractor(cls, source_type: SourceType) -> BaseExtractor:
        """Get an instance of the extractor for the given source type."""
        if source_type not in cls._extractors:
            raise ValueError(f"No extractor registered for {source_type}")
        return cls._extractors[source_type]()

    @classmethod
    def detect_type(cls, source: str | Path) -> Optional[SourceType]:
        """Detect source type from file extension or URL."""
        source_str = str(source)

        if source_str.startswith(("http://", "https://")):
            if "youtube.com" in source_str or "youtu.be" in source_str:
                return SourceType.YOUTUBE
            if source_str.endswith(".pdf"):
                return SourceType.PDF
            return SourceType.HTML

        path = Path(source)
        ext = path.suffix.lower().lstrip(".")

        type_map = {
            "pdf": SourceType.PDF,
            "html": SourceType.HTML,
            "htm": SourceType.HTML,
            "md": SourceType.MARKDOWN,
            "markdown": SourceType.MARKDOWN,
            "json": SourceType.JSON,
            "csv": SourceType.CSV,
            "txt": SourceType.TEXT,
            "mp3": SourceType.AUDIO,
            "wav": SourceType.AUDIO,
            "m4a": SourceType.AUDIO,
            "flac": SourceType.AUDIO,
            "png": SourceType.IMAGE,
            "jpg": SourceType.IMAGE,
            "jpeg": SourceType.IMAGE,
            "tiff": SourceType.IMAGE,
            "bmp": SourceType.IMAGE,
            "heic": SourceType.IMAGE,
        }

        return type_map.get(ext)

    @classmethod
    def extract(cls, source: str | Path) -> Document:
        """
        Convenience method to extract from a source by auto-detecting type.

        Args:
            source: File path or URL

        Returns:
            Document with extracted content and chunks
        """
        source_type = cls.detect_type(source)

        if not source_type:
            raise ValueError(f"Could not detect source type for: {source}")

        extractor = cls.get_extractor(source_type)

        if not extractor.validate(source):
            raise ValueError(f"Validation failed for: {source}")

        return extractor.extract(source)

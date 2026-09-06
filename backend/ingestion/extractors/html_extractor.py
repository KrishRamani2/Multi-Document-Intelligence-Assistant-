from pathlib import Path
from typing import Optional, List, Any
import uuid

from unstructured.partition.html import partition_html

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class HtmlExtractor(BaseExtractor):
    """Extractor for HTML/web pages using unstructured library."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.HTML

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid HTML file or URL."""
        source_str = str(source)

        if source_str.startswith(("http://", "https://")):
            return True

        path = Path(source)
        if not path.exists():
            return False

        return path.suffix.lower() in (".html", ".htm")

    def extract(self, source: str | Path) -> Document:
        """Extract content from an HTML file or URL."""
        source_str = str(source)
        is_url = source_str.startswith(("http://", "https://"))

        metadata = self._get_html_metadata(source_str)

        if is_url:
            elements = self._partition_html_url(source_str)
            source_name = self._extract_domain(source_str)
        else:
            elements = self._partition_html_file(Path(source))
            source_name = Path(source).name

        doc = self._create_document(
            source_name=source_name,
            source_url=source_str if is_url else None,
            elements=elements,
            metadata={"html_metadata": metadata},
        )

        return doc

    def _partition_html_file(self, path: Path) -> List[DocumentElement]:
        """Partition HTML file using unstructured."""
        elements = partition_html(
            filename=str(path),
            include_page_breaks=False,
        )
        return self._convert_elements(elements)

    def _partition_html_url(self, url: str) -> List[DocumentElement]:
        """Partition HTML from URL using unstructured."""
        elements = partition_html(
            url=url,
            include_page_breaks=False,
        )
        return self._convert_elements(elements)

    def _convert_elements(self, elements) -> List[DocumentElement]:
        """Convert unstructured elements to DocumentElement."""
        doc_elements = []
        char_offset = 0

        for elem in elements:
            text = str(elem)
            if not text.strip():
                continue

            element_type = self._map_element_type(elem.category)

            doc_element = DocumentElement(
                element_id=str(uuid.uuid4()),
                element_type=element_type,
                text=text,
                metadata=self._extract_element_metadata(elem),
                page_number=self._get_page_number(elem),
                start_char=char_offset,
                end_char=char_offset + len(text),
            )

            char_offset += len(text) + 1
            doc_elements.append(doc_element)

        return doc_elements

    def _extract_element_metadata(self, elem) -> dict[str, Any]:
        """Extract metadata from an unstructured element."""
        metadata = {}

        if hasattr(elem.metadata, "link_urls"):
            metadata["link_urls"] = elem.metadata.link_urls
        if hasattr(elem.metadata, "link_texts"):
            metadata["link_texts"] = elem.metadata.link_texts

        return metadata

    def _get_page_number(self, elem) -> Optional[int]:
        """Get page number from element metadata."""
        if hasattr(elem.metadata, "page_number"):
            return elem.metadata.page_number
        return None

    def _get_html_metadata(self, source: str) -> dict[str, Any]:
        """Get HTML-specific metadata."""
        return {
            "extracted_at": str(Path(source).name),
        }

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.netloc or url

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get HTML-specific metadata."""
        return self._get_html_metadata(str(source))

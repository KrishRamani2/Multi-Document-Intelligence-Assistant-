from pathlib import Path
from typing import Optional, List, Any
import uuid

from unstructured.partition.md import partition_md

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class MarkdownExtractor(BaseExtractor):
    """Extractor for Markdown files using unstructured."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.MARKDOWN

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid Markdown file."""
        path = Path(source)

        if not path.exists():
            return False

        return path.suffix.lower() in (".md", ".markdown")

    def extract(self, source: str | Path) -> Document:
        """Extract content from a Markdown file."""
        path = Path(source)

        if not self.validate(source):
            raise ValueError(f"Invalid Markdown source: {source}")

        metadata = self._get_markdown_metadata(path)
        elements = self._partition_markdown(path)

        doc = self._create_document(
            source_name=path.name,
            source_url=None,
            elements=elements,
            metadata={"markdown_metadata": metadata},
        )

        return doc

    def _partition_markdown(self, path: Path) -> List[DocumentElement]:
        """Partition Markdown using unstructured."""
        elements = partition_md(filename=str(path))

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
                start_char=char_offset,
                end_char=char_offset + len(text),
            )

            char_offset += len(text) + 1
            doc_elements.append(doc_element)

        return doc_elements

    def _get_markdown_metadata(self, path: Path) -> dict[str, Any]:
        """Get Markdown file metadata."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            lines = content.split("\n")

            headings = [l for l in lines if l.strip().startswith("#")]
            links = content.count("](")
            images = content.count("![")
            code_blocks = content.count("```")

            return {
                "total_lines": len(lines),
                "heading_count": len(headings),
                "link_count": links,
                "image_count": images,
                "code_block_count": code_blocks,
            }
        except Exception as e:
            return {"error": str(e)}

    def _extract_element_metadata(self, elem) -> dict[str, Any]:
        """Extract metadata from an unstructured element."""
        metadata = {}

        if hasattr(elem.metadata, "link_urls"):
            metadata["link_urls"] = elem.metadata.link_urls

        return metadata

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get Markdown-specific metadata."""
        path = Path(source)
        return self._get_markdown_metadata(path)

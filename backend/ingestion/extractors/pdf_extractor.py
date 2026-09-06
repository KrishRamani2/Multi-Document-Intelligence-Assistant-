import os
from pathlib import Path
from typing import Optional, List, Any
import uuid
from dotenv import load_dotenv

load_dotenv()

from unstructured.partition.api import partition_via_api

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    DocumentMetadata,
    ElementType,
)


class PdfExtractor(BaseExtractor):
    """Extractor for PDF documents using Unstructured API or local processing."""

    def __init__(self, use_api: bool = True, use_unstructured_chunking: bool = False):
        self._use_api = use_api
        self._use_unstructured_chunking = use_unstructured_chunking
        self._api_key = os.getenv("UNSTRUCTURED_API_KEY")
        self._api_url = os.getenv(
            "UNSTRUCTURED_API_URL", "https://platform.unstructuredapp.io/api/v1"
        )

    @property
    def source_type(self) -> SourceType:
        return SourceType.PDF

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid PDF file."""
        path = Path(source)

        if not path.exists():
            return False

        if path.suffix.lower() != ".pdf":
            return False

        try:
            with open(path, "rb") as f:
                header = f.read(5)
                return header == b"%PDF-"
        except Exception:
            return False

    def extract(self, source: str | Path) -> Document:
        """Extract content from a PDF file."""
        path = Path(source)

        if not self.validate(source):
            raise ValueError(f"Invalid PDF source: {source}")

        metadata = self._get_pdf_metadata(path)

        if self._use_api and self._api_key:
            elements = self._partition_via_api(path, self._use_unstructured_chunking)
        else:
            elements = self._partition_local(path)

        doc = self._create_document(
            source_name=path.name,
            source_url=None,
            elements=elements,
            metadata={"pdf_metadata": metadata},
        )

        return doc

    def _partition_via_api(
        self, path: Path, use_chunking: bool = False
    ) -> List[DocumentElement]:
        """Partition PDF using Unstructured API with optional chunking."""
        params = {
            "filename": str(path),
            "api_key": self._api_key,
            "api_url": self._api_url,
            "strategy": "auto",
            "infer_table_structure": True,
            "extract_image_block_types": ["Image", "Table"],
        }

        if use_chunking:
            params.update(
                {
                    "chunking_strategy": "by_title",
                    "combine_under_n_chars": 500,
                    "new_after_n_chars": 1500,
                    "max_characters": 2000,
                }
            )

        elements = partition_via_api(**params)
        return self._convert_elements(elements)

    def _partition_local(self, path: Path) -> List[DocumentElement]:
        """Partition PDF using local unstructured library."""
        from unstructured.partition.pdf import partition_pdf

        try:
            elements = partition_pdf(
                filename=str(path),
                strategy="hi_res",
                include_page_breaks=True,
                infer_table_structure=True,
            )
        except Exception:
            try:
                elements = partition_pdf(
                    filename=str(path),
                    strategy="fast",
                    include_page_breaks=True,
                )
            except:
                elements = partition_pdf(
                    filename=str(path),
                    include_page_breaks=True,
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

    def _get_pdf_metadata(self, path: Path) -> dict[str, Any]:
        """Extract PDF-specific metadata using pypdf."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            info = reader.metadata or {}

            return {
                "page_count": len(reader.pages),
                "author": info.get("/Author"),
                "title": info.get("/Title"),
                "subject": info.get("/Subject"),
                "creator": info.get("/Creator"),
                "producer": info.get("/Producer"),
                "creation_date": str(info.get("/CreationDate", "")),
                "is_encrypted": reader.is_encrypted,
            }
        except Exception:
            return {"page_count": 0, "is_encrypted": False}

    def _extract_element_metadata(self, elem) -> dict[str, Any]:
        """Extract metadata from an unstructured element."""
        metadata = {}

        if hasattr(elem.metadata, "text_as_html"):
            metadata["text_as_html"] = elem.metadata.text_as_html

        if hasattr(elem.metadata, "filename"):
            metadata["filename"] = elem.metadata.filename

        if hasattr(elem.metadata, "image_path"):
            metadata["image_path"] = elem.metadata.image_path

        if hasattr(elem.metadata, "image_mimetype"):
            metadata["image_mimetype"] = elem.metadata.image_mimetype

        return metadata

    def _get_page_number(self, elem) -> Optional[int]:
        """Get page number from element metadata."""
        if hasattr(elem.metadata, "page_number"):
            return elem.metadata.page_number
        return None

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get PDF-specific metadata."""
        path = Path(source)
        return self._get_pdf_metadata(path)

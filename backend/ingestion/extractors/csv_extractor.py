from pathlib import Path
from typing import Optional, List, Any
import uuid

from unstructured.partition.csv import partition_csv

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class CsvExtractor(BaseExtractor):
    """Extractor for CSV files using unstructured."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.CSV

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid CSV file."""
        path = Path(source)

        if not path.exists():
            return False

        return path.suffix.lower() == ".csv"

    def extract(self, source: str | Path) -> Document:
        """Extract content from a CSV file."""
        path = Path(source)

        if not self.validate(source):
            raise ValueError(f"Invalid CSV source: {source}")

        metadata = self._get_csv_metadata(path)
        elements = self._partition_csv(path)

        doc = self._create_document(
            source_name=path.name,
            source_url=None,
            elements=elements,
            metadata={"csv_metadata": metadata},
        )

        return doc

    def _partition_csv(self, path: Path) -> List[DocumentElement]:
        """Partition CSV using unstructured."""
        elements = partition_csv(filename=str(path))

        doc_elements = []
        char_offset = 0

        for elem in elements:
            text = str(elem)
            if not text.strip():
                continue

            doc_element = DocumentElement(
                element_id=str(uuid.uuid4()),
                element_type=ElementType.TABLE,
                text=text,
                metadata=self._extract_element_metadata(elem),
                page_number=1,
                start_char=char_offset,
                end_char=char_offset + len(text),
            )

            char_offset += len(text) + 1
            doc_elements.append(doc_element)

        return doc_elements

    def _get_csv_metadata(self, path: Path) -> dict[str, Any]:
        """Get CSV file metadata."""
        import csv

        try:
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                rows = list(reader)

                if not rows:
                    return {"row_count": 0, "column_count": 0}

                header = rows[0] if rows else []

                return {
                    "row_count": len(rows),
                    "column_count": len(header),
                    "columns": header,
                    "delimiter": ",",
                    "has_header": True,
                    "encoding": "utf-8",
                }
        except Exception as e:
            return {"error": str(e)}

    def _extract_element_metadata(self, elem) -> dict[str, Any]:
        """Extract metadata from an unstructured element."""
        metadata = {}

        if hasattr(elem.metadata, "text_as_html"):
            metadata["text_as_html"] = elem.metadata.text_as_html

        return metadata

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get CSV-specific metadata."""
        path = Path(source)
        return self._get_csv_metadata(path)

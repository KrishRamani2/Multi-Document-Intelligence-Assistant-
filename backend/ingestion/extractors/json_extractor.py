from pathlib import Path
from typing import Optional, List, Any, Union
import uuid
import json

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class JsonExtractor(BaseExtractor):
    """Extractor for JSON files."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.JSON

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid JSON file."""
        path = Path(source)

        if not path.exists():
            return False

        if path.suffix.lower() != ".json":
            return False

        try:
            with open(path, "r") as f:
                json.load(f)
            return True
        except Exception:
            return False

    def extract(self, source: str | Path) -> Document:
        """Extract content from a JSON file."""
        path = Path(source)

        if not self.validate(source):
            raise ValueError(f"Invalid JSON source: {source}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        metadata = self._get_json_metadata(data)
        elements = self._parse_json_to_elements(data, path.name)

        doc = self._create_document(
            source_name=path.name,
            source_url=None,
            elements=elements,
            metadata={"json_metadata": metadata},
        )

        return doc

    def _parse_json_to_elements(
        self,
        data: Any,
        filename: str,
        parent_key: str = "",
    ) -> List[DocumentElement]:
        """Parse JSON into document elements."""
        elements = []
        char_offset = 0

        if isinstance(data, dict):
            for key, value in data.items():
                current_key = f"{parent_key}.{key}" if parent_key else key

                if isinstance(value, (dict, list)):
                    nested_elements = self._parse_json_to_elements(
                        value, filename, current_key
                    )
                    elements.extend(nested_elements)
                else:
                    text = f"{key}: {value}"
                    element = DocumentElement(
                        element_id=str(uuid.uuid4()),
                        element_type=ElementType.NARRATIVE_TEXT,
                        text=text,
                        metadata={
                            "json_path": current_key,
                            "data_type": type(value).__name__,
                            "file": filename,
                        },
                        start_char=char_offset,
                        end_char=char_offset + len(text),
                    )
                    char_offset += len(text) + 1
                    elements.append(element)

        elif isinstance(data, list):
            for i, item in enumerate(data):
                current_key = f"{parent_key}[{i}]"

                if isinstance(item, (dict, list)):
                    nested_elements = self._parse_json_to_elements(
                        item, filename, current_key
                    )
                    elements.extend(nested_elements)
                else:
                    text = f"[{i}]: {item}"
                    element = DocumentElement(
                        element_id=str(uuid.uuid4()),
                        element_type=ElementType.NARRATIVE_TEXT,
                        text=text,
                        metadata={
                            "json_path": current_key,
                            "data_type": type(item).__name__,
                            "file": filename,
                        },
                        start_char=char_offset,
                        end_char=char_offset + len(text),
                    )
                    char_offset += len(text) + 1
                    elements.append(element)

        return elements

    def _get_json_metadata(self, data: Any) -> dict[str, Any]:
        """Get JSON file metadata."""

        def analyze(obj, depth=0):
            if isinstance(obj, dict):
                return {
                    "type": "object",
                    "keys": list(obj.keys()),
                    "depth": depth,
                    "node_count": len(obj),
                }
            elif isinstance(obj, list):
                return {
                    "type": "array",
                    "length": len(obj),
                    "depth": depth,
                    "node_count": len(obj),
                }
            else:
                return {
                    "type": type(obj).__name__,
                    "depth": depth,
                }

        return analyze(data)

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get JSON-specific metadata."""
        path = Path(source)

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._get_json_metadata(data)
        except Exception as e:
            return {"error": str(e)}

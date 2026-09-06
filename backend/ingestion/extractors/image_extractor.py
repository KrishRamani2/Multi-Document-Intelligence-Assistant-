from pathlib import Path
from typing import Optional, List, Any
import uuid
import base64

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class ImageExtractor(BaseExtractor):
    """Extractor for images using Gemini API for description."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.IMAGE

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid image file or URL."""
        source_str = str(source)

        if source_str.startswith(("http://", "https://")):
            return True

        path = Path(source)
        if not path.exists():
            return False

        image_extensions = {
            ".png",
            ".jpg",
            ".jpeg",
            ".tiff",
            ".bmp",
            ".heic",
            ".webp",
            ".gif",
            ".webp",
        }
        return path.suffix.lower() in image_extensions

    def extract(self, source: str | Path) -> Document:
        """Extract content from an image file using Gemini API."""
        import os
        from dotenv import load_dotenv

        load_dotenv()

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        path = Path(source)
        source_str = str(source)

        is_url = source_str.startswith(("http://", "https://"))

        if not is_url and not self.validate(source):
            raise ValueError(f"Invalid image source: {source}")

        if not is_url:
            metadata = self._get_image_metadata(path)
            image_data = self._encode_image(path)
        else:
            metadata = {"source_url": source_str}
            image_data = None

        description = self._describe_image(source_str, api_key, image_data)

        elements = self._create_elements_from_description(
            description, path.name if not is_url else source_str
        )

        doc = self._create_document(
            source_name=path.name
            if not is_url
            else self._extract_name_from_url(source_str),
            source_url=source_str if is_url else None,
            elements=elements,
            metadata={"image_metadata": metadata, "extra_data": description},
        )

        return doc

    def _encode_image(self, path: Path) -> str:
        """Encode image to base64."""
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _describe_image(
        self, source: str, api_key: str, image_data: Optional[str] = None
    ) -> dict:
        """Use Gemini API to describe the image."""
        import google.genai as genai

        client = genai.Client(api_key=api_key)

        if image_data:
            from PIL import Image
            import io

            img = Image.open(io.BytesIO(base64.b64decode(image_data)))

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    img,
                    "Describe this image in detail. Include any text visible, objects, colors, and any other relevant details.",
                ],
            )
            text_description = response.text
        else:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    f"Describe this image in detail from URL: {source}. Include any text visible, objects, colors, and any other relevant details.",
                ],
            )
            text_description = response.text

        return {
            "description": text_description,
            "model": "gemini-2.0-flash",
        }

    def _create_elements_from_description(
        self,
        description: dict,
        filename: str,
    ) -> List[DocumentElement]:
        """Create document elements from image description."""
        elements = []
        char_offset = 0

        text = description.get("description", "")

        element = DocumentElement(
            element_id=str(uuid.uuid4()),
            element_type=ElementType.NARRATIVE_TEXT,
            text=text,
            metadata={
                "image_file": filename,
                "type": "gemini_description",
                "model": description.get("model"),
            },
            start_char=char_offset,
            end_char=char_offset + len(text),
        )
        elements.append(element)

        return elements

    def _extract_name_from_url(self, url: str) -> str:
        """Extract name from URL."""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        path = parsed.path
        return path.split("/")[-1] if path else url

    def _get_image_metadata(self, path: Path) -> dict[str, Any]:
        """Get image file metadata."""
        try:
            from PIL import Image

            with Image.open(path) as img:
                width, height = img.size
                return {
                    "width": width,
                    "height": height,
                    "format": img.format,
                    "mode": img.mode,
                    "size_bytes": path.stat().st_size,
                }
        except Exception:
            return {
                "format": path.suffix.lower().lstrip("."),
            }

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get image-specific metadata."""
        path = Path(source)
        return self._get_image_metadata(path)

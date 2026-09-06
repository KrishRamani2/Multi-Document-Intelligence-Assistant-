from pathlib import Path
from typing import Optional, List, Any
import uuid

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class AudioExtractor(BaseExtractor):
    """Extractor for audio files using AssemblyAI for transcription."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.AUDIO

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid audio file or URL."""
        source_str = str(source)

        if source_str.startswith(("http://", "https://")):
            return True

        path = Path(source)
        if not path.exists():
            return False

        audio_extensions = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".wma"}
        return path.suffix.lower() in audio_extensions

    def extract(self, source: str | Path) -> Document:
        """Extract content from an audio file."""
        import os
        from dotenv import load_dotenv

        load_dotenv()

        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            raise ValueError("ASSEMBLYAI_API_KEY not found in environment")

        import assemblyai as aai

        aai.settings.api_key = api_key

        path = Path(source)
        source_str = str(source)

        is_url = source_str.startswith(("http://", "https://"))

        if not is_url and not self.validate(source):
            raise ValueError(f"Invalid audio source: {source}")

        if not is_url:
            metadata = self._get_audio_metadata(path)
        else:
            metadata = {"format": "url", "source_url": source_str}

        transcript_data = self._transcribe_audio(source_str)

        elements = self._create_elements_from_transcript(
            transcript_data, path.name if not is_url else source_str
        )

        doc = self._create_document(
            source_name=path.name
            if not is_url
            else self._extract_name_from_url(source_str),
            source_url=source_str if is_url else None,
            elements=elements,
            metadata={"audio_metadata": metadata, "extra_data": transcript_data},
        )

        return doc

    def _transcribe_audio(self, source: str) -> dict:
        """Transcribe audio using AssemblyAI."""
        import assemblyai as aai

        config = aai.TranscriptionConfig(auto_chapters=True)
        transcriber = aai.Transcriber()

        transcript = transcriber.transcribe(source, config)

        if transcript.error:
            raise ValueError(f"Transcription error: {transcript.error}")

        return {
            "chapters": [
                {
                    "headline": chapter.headline,
                    "summary": chapter.summary,
                    "start": chapter.start,
                    "end": chapter.end,
                }
                for chapter in (transcript.chapters or [])
            ],
            "words": [
                {
                    "text": word.text,
                    "start": word.start,
                    "end": word.end,
                    "confidence": word.confidence,
                }
                for word in (transcript.words or [])
            ],
            "text": transcript.text,
        }

    def _create_elements_from_transcript(
        self,
        transcript_data: dict,
        filename: str,
    ) -> List[DocumentElement]:
        """Create document elements from transcript with timestamps."""
        elements = []
        char_offset = 0

        # Add chapters as elements
        chapters = transcript_data.get("chapters", [])
        for chapter in chapters:
            text = f"[{chapter['headline']}] {chapter['summary']}"

            element = DocumentElement(
                element_id=str(uuid.uuid4()),
                element_type=ElementType.NARRATIVE_TEXT,
                text=text,
                metadata={
                    "audio_file": filename,
                    "timestamp_start_ms": chapter.get("start", 0),
                    "timestamp_end_ms": chapter.get("end", 0),
                    "type": "chapter",
                },
                start_char=char_offset,
                end_char=char_offset + len(text),
            )
            char_offset += len(text) + 1
            elements.append(element)

        # Add each word with timestamp as separate element
        words = transcript_data.get("words", [])
        for word in words:
            text = word.get("text", "").strip()
            if not text:
                continue

            start_ms = word.get("start", 0)
            end_ms = word.get("end", 0)

            start_sec = start_ms / 1000.0
            mins = int(start_sec // 60)
            secs = int(start_sec % 60)
            timestamp = f"[{mins:02d}:{secs:02d}]"

            element = DocumentElement(
                element_id=str(uuid.uuid4()),
                element_type=ElementType.NARRATIVE_TEXT,
                text=f"{timestamp} {text}",
                metadata={
                    "audio_file": filename,
                    "timestamp_start_ms": start_ms,
                    "timestamp_end_ms": end_ms,
                    "timestamp_formatted": timestamp,
                    "type": "word_with_timestamp",
                },
                start_char=char_offset,
                end_char=char_offset + len(text) + len(timestamp) + 1,
            )
            char_offset += len(text) + len(timestamp) + 2
            elements.append(element)

        return elements

    def _extract_name_from_url(self, url: str) -> str:
        """Extract name from URL."""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        path = parsed.path
        return path.split("/")[-1] if path else url

    def _get_audio_metadata(self, path: Path) -> dict[str, Any]:
        """Get audio file metadata."""
        return {
            "format": path.suffix.lower().lstrip("."),
            "filename": path.name,
            "size_bytes": path.stat().st_size,
        }

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """Get audio-specific metadata."""
        path = Path(source)
        return self._get_audio_metadata(path)

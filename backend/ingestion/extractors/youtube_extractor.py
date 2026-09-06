from pathlib import Path
from typing import Optional, List, Any
import uuid
import re
import requests

from ingestion.base_extractor import BaseExtractor
from ingestion.models import (
    SourceType,
    Document,
    DocumentElement,
    ElementType,
)


class YoutubeExtractor(BaseExtractor):
    """Extractor for YouTube videos using yt-dlp for metadata and transcripts."""

    @property
    def source_type(self) -> SourceType:
        return SourceType.YOUTUBE

    def validate(self, source: str | Path) -> bool:
        """Validate if the source is a valid YouTube URL."""
        source_str = str(source)

        patterns = [
            r"youtube\.com/watch\?v=",
            r"youtu\.be/",
            r"youtube\.com/shorts/",
            r"youtube\.com/embed/",
        ]

        return any(re.search(p, source_str) for p in patterns)

    def extract(self, source: str | Path) -> Document:
        """Extract content from a YouTube video."""
        import yt_dlp

        source_str = str(source)

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(source_str, download=False)

        video_id = info.get("id", "")
        title = info.get("title", "Untitled")
        description = info.get("description")
        channel = info.get("uploader", "")
        channel_id = info.get("uploader_id")
        duration = info.get("duration", 0)
        publish_date = info.get("upload_date")
        view_count = info.get("view_count")
        like_count = info.get("like_count")

        transcript = self._get_transcript(info, source_str)

        if not transcript and duration > 0:
            transcript = self._get_transcript_via_assemblyai(source_str)

        if not transcript and description:
            transcript = self._create_transcript_from_description(description, duration)

        metadata = {
            "video_id": video_id,
            "title": title,
            "description": description,
            "channel_name": channel,
            "channel_id": channel_id,
            "duration_seconds": duration,
            "publish_date": publish_date,
            "view_count": view_count,
            "like_count": like_count,
            "is_caption_available": bool(transcript),
        }

        elements = self._create_elements_from_transcript(transcript, video_id, title)

        return self._create_document(
            source_name=f"{video_id}_{title[:50]}",
            source_url=source_str,
            elements=elements,
            metadata={
                "youtube_metadata": metadata,
                "extra_data": {"transcript": transcript},
            },
        )

    def _get_transcript(self, info: dict, url: str) -> List[dict]:
        """Get transcript/captions from video - downloads actual subtitle data."""
        import yt_dlp

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["en", "en-US"],
            "skip_download": True,
            "outtmpl": "/tmp/youtube_subs",
            "quiet": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            subtitles = info.get("subtitles") or info.get("automatic_captions")

            if not subtitles:
                return []

            for lang in ["en", "en-US", "en-GB"]:
                if lang in subtitles:
                    sub_formats = subtitles[lang]
                    for fmt in sub_formats:
                        if fmt.get("ext") == "json3":
                            return self._download_and_parse_subtitle(fmt.get("url"))

            for lang in list(subtitles.keys())[:1]:
                sub_formats = subtitles[lang]
                for fmt in sub_formats:
                    if fmt.get("ext") == "json3":
                        return self._download_and_parse_subtitle(fmt.get("url"))

        except Exception as e:
            print(f"Error getting transcript: {e}")

        return []

    def _download_and_parse_subtitle(self, url: str) -> List[dict]:
        """Download and parse JSON3 subtitle format."""
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            events = data.get("events", [])
            transcript = []

            for event in events:
                start = event.get("tStartMs", 0)
                duration = event.get("dDurationMs", 0)

                segs = event.get("segs", [])
                text = ""
                for seg in segs:
                    text += seg.get("utf8", "")

                text = text.strip()
                if text:
                    transcript.append(
                        {
                            "start": start,
                            "text": text,
                            "duration": duration,
                        }
                    )

            return transcript

        except Exception as e:
            print(f"Error parsing subtitle: {e}")
            return []

    def _get_transcript_via_assemblyai(self, url: str) -> List[dict]:
        """Fallback: Get transcript via AssemblyAI."""
        import os
        from dotenv import load_dotenv

        load_dotenv()

        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            return []

        try:
            import assemblyai as aai

            aai.settings.api_key = api_key

            config = aai.TranscriptionConfig(auto_chapters=True)
            transcriber = aai.Transcriber()
            transcript = transcriber.transcribe(url, config)

            if transcript.error:
                return []

            words = transcript.words or []

            transcript_list = []
            for word in words:
                transcript_list.append(
                    {
                        "start": word.start,
                        "text": word.text,
                        "duration": (word.end - word.start)
                        if word.end and word.start
                        else 0,
                    }
                )

            return transcript_list

        except Exception as e:
            print(f"AssemblyAI transcription error: {e}")
            return []

    def _create_elements_from_transcript(
        self,
        transcript: List[dict],
        video_id: str,
        title: str,
    ) -> List[DocumentElement]:
        """Create document elements from transcript with timestamps."""
        elements = []
        char_offset = 0

        if not transcript:
            return elements

        for i, entry in enumerate(transcript):
            start_ms = entry.get("start", 0)
            duration = entry.get("duration", 0)
            text = entry.get("text", "").strip()

            if not text:
                continue

            start_sec = start_ms / 1000.0
            mins = int(start_sec // 60)
            secs = int(start_sec % 60)
            timestamp = f"[{mins:02d}:{secs:02d}]"

            element = DocumentElement(
                element_id=str(uuid.uuid4()),
                element_type=ElementType.NARRATIVE_TEXT,
                text=f"{timestamp} {text}",
                metadata={
                    "video_id": video_id,
                    "video_title": title,
                    "timestamp_start_ms": start_ms,
                    "timestamp_end_ms": start_ms + duration,
                    "timestamp_formatted": timestamp,
                    "type": "transcript_with_timestamp",
                },
                start_char=char_offset,
                end_char=char_offset + len(text) + len(timestamp) + 1,
            )

            char_offset += len(text) + len(timestamp) + 2
            elements.append(element)

        return elements

    def _create_transcript_from_description(
        self, description: str, duration: int
    ) -> List[dict]:
        """Create pseudo-transcript from video description."""
        if not description:
            return []

        transcript = []
        lines = description.split("\n")
        time_increment = duration // max(len(lines), 1) if duration > 0 else 30

        for i, line in enumerate(lines):
            line = line.strip()
            if line and len(line) > 10:
                start_ms = (i * time_increment) * 1000
                transcript.append(
                    {
                        "start": start_ms,
                        "text": line,
                        "duration": time_increment * 1000,
                    }
                )

        return transcript

    def get_metadata(self, source: str | Path) -> dict[str, Any]:
        """YouTube-specific metadata."""
        import yt_dlp

        source_str = str(source)

        ydl_opts = {"quiet": True, "no_warnings": True}

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(source_str, download=False)

        return {
            "video_id": info.get("id"),
            "title": info.get("title"),
            "channel_name": info.get("uploader"),
            "duration_seconds": info.get("duration"),
        }

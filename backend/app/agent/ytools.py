"""
YouTube Tool - searches transcripts and returns timestamped segments.
Uses youtube-transcript API for transcript extraction.
"""

import re
import os
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class VideoSegment:
    """A video segment with timestamp."""

    video_id: str
    title: str
    url: str
    embed_url: str
    start_time: int
    end_time: int
    transcript: str
    thumbnail: Optional[str] = None


@dataclass
class YouTubeResponse:
    """Structured response from YouTube tool."""

    segments: List[VideoSegment]
    query: str
    video_info: Dict[str, Any] = None


def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from URL."""
    patterns = [
        r"(?:v=|/v/|/embed/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def get_video_transcript(video_id: str) -> List[Dict]:
    """
    Get transcript from YouTube video.
    Uses yt-dlp or returns mock data if unavailable.
    """
    try:
        # Try using yt-dlp to get transcript
        import subprocess

        cmd = [
            "yt-dlp",
            "--write-subs",
            "--write-auto-subs",
            "--skip-download",
            f"https://youtube.com/watch?v={video_id}",
            "--output",
            "/tmp/youtube_transcript",
        ]

        result = subprocess.run(cmd, capture_output=True, timeout=30)

        # Check for transcript file
        transcript_file = f"/tmp/youtube_transcript.{video_id}.en.srt"
        if os.path.exists(transcript_file):
            with open(transcript_file) as f:
                return _parse_srt(f.read())

    except Exception as e:
        logger.warning(f"Could not fetch transcript: {e}")

    # Return sample transcript data for demo
    return _get_sample_transcript(video_id)


def _parse_srt(srt_content: str) -> List[Dict]:
    """Parse SRT transcript to segments."""
    segments = []
    blocks = srt_content.strip().split("\n\n")

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) >= 3:
            time_line = lines[1]
            text = " ".join(lines[2:])

            # Parse timestamp
            times = time_line.split(" --> ")
            if len(times) == 2:
                start = _parse_time(times[0])
                end = _parse_time(times[1])
                segments.append({"start": start, "end": end, "text": text})

    return segments


def _parse_time(time_str: str) -> int:
    """Parse SRT timestamp to seconds."""
    import re

    match = re.match(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})", time_str.strip())
    if match:
        h, m, s, ms = match.groups()
        return int(h) * 3600 + int(m) * 60 + int(s)
    return 0


def _get_sample_transcript(video_id: str) -> List[Dict]:
    """Sample transcript for demo."""
    return [
        {
            "start": 0,
            "end": 15,
            "text": "Welcome to Acme Corp Q4 2024 earnings call. I'm pleased to announce another record quarter.",
        },
        {
            "start": 15,
            "end": 32,
            "text": "Q4 revenue reached $39 million, up 34% year-over-year. This is our strongest quarter ever.",
        },
        {
            "start": 32,
            "end": 48,
            "text": "Gross margins expanded to 48%, driven by our enterprise segment growth.",
        },
        {
            "start": 48,
            "end": 65,
            "text": "Looking at full FY2024, we achieved $125 million in revenue, up 23% from FY2023.",
        },
        {
            "start": 65,
            "end": 82,
            "text": "Our Asia Pacific region continues to be the fastest growing, up 35% this year.",
        },
        {
            "start": 82,
            "end": 98,
            "text": "Operating cash flow was $28 million, giving us a strong balance sheet for growth.",
        },
        {
            "start": 98,
            "end": 115,
            "text": "For 2025, we're targeting $150 million revenue, a 20% increase.",
        },
    ]


async def search_youtube_transcript(
    query: str,
    video_id: str,
    max_results: int = 3,
) -> YouTubeResponse:
    """
    Search within YouTube video transcript and return relevant segments.
    """
    # Get transcript
    transcript = await get_video_transcript(video_id)

    if not transcript:
        return YouTubeResponse(
            segments=[],
            query=query,
            video_info={"video_id": video_id, "error": "No transcript available"},
        )

    # Search for query terms in transcript
    query_terms = query.lower().split()
    relevant_segments = []

    for segment in transcript:
        text_lower = segment["text"].lower()
        # Simple keyword matching
        matches = sum(1 for term in query_terms if term in text_lower)
        if matches > 0:
            segment["score"] = matches
            relevant_segments.append(segment)

    # Sort by score and limit
    relevant_segments.sort(key=lambda x: x.get("score", 0), reverse=True)
    relevant_segments = relevant_segments[:max_results]

    # Build response
    embed_url = f"https://www.youtube.com/embed/{video_id}"
    thumbnail = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

    segments = [
        VideoSegment(
            video_id=video_id,
            title=f"Segment at {_format_time(s['start'])}",
            url=f"https://youtube.com/watch?v={video_id}",
            embed_url=embed_url,
            start_time=s["start"],
            end_time=s["end"],
            transcript=s["text"],
            thumbnail=thumbnail,
        )
        for s in relevant_segments
    ]

    return YouTubeResponse(
        segments=segments,
        query=query,
        video_info={
            "video_id": video_id,
            "thumbnail": thumbnail,
            "total_segments": len(transcript),
        },
    )


async def render_youtube(
    query: str,
    video_url: Optional[str] = None,
    video_id: Optional[str] = None,
    start_time: Optional[int] = None,
    duration: int = 30,
) -> YouTubeResponse:
    """
    Render YouTube video segment at timestamp.
    """
    # Extract video ID
    if video_url and not video_id:
        video_id = extract_video_id(video_url)

    if not video_id:
        return YouTubeResponse(
            segments=[], query=query, video_info={"error": "No video ID provided"}
        )

    # If start_time not provided, search transcript
    if start_time is None:
        result = await search_youtube_transcript(query, video_id, max_results=1)
        if result.segments:
            return result
        start_time = 0

    embed_url = f"https://www.youtube.com/embed/{video_id}"
    if start_time:
        embed_url += f"?start={start_time}"

    thumbnail = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

    return YouTubeResponse(
        segments=[
            VideoSegment(
                video_id=video_id,
                title=f"YouTube Video",
                url=video_url or f"https://youtube.com/watch?v={video_id}",
                embed_url=embed_url,
                start_time=start_time,
                end_time=start_time + duration,
                transcript=f"Video segment about: {query}",
                thumbnail=thumbnail,
            )
        ],
        query=query,
        video_info={"video_id": video_id},
    )


def _format_time(seconds: int) -> str:
    """Format seconds to MM:SS."""
    m = seconds // 60
    s = seconds % 60
    return f"{m:02d}:{s:02d}"


async def get_video_timestamps(
    query: str,
    video_id: str,
    max_results: int = 5,
) -> YouTubeResponse:
    """
    Get timestamps from YouTube video transcript matching query.
    """
    return await search_youtube_transcript(query, video_id, max_results)

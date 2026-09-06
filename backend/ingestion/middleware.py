from typing import List, Optional, Set
from dataclasses import dataclass, field
import hashlib
import re

from ingestion.models import Chunk, Document


@dataclass
class MiddlewareConfig:
    """Configuration for all middleware stages."""

    # Duplicate detection
    dedupe_enabled: bool = True
    dedupe_threshold: float = 0.98

    # Temporal processing
    temporal_enabled: bool = False

    # Redaction
    redact_enabled: bool = False
    redact_patterns: List[str] = field(
        default_factory=lambda: [
            # Email
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            # Indian Phone: +91, 0xx, 10 digits (various formats)
            r"\+91[\s.-]?\d{5}[\s.-]?\d{5}",  # +91 98765 43210
            r"\b0\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b",  # 0123 456 7890
            r"\b\d{10}\b",  # 9876543210
            r"\(\+91\)[\s.-]?\d{5}[\s.-]?\d{5]",  # (+91) 98765 43210
            # Aadhaar Card (12 digits, space/group)
            r"\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b",
            # PAN Card (AAAAA1234A format)
            r"\b[A-Z]{5}\d{4}[A-Z]{1}\b",
            # Indian PIN Code (6 digits)
            r"\b\d{6}\b",
            # US Phone
            r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",
            # SSN (US)
            r"\b\d{3}[-]\d{2}[-]\d{4}\b",
            # Credit Card
            r"\b\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}\b",
            # Passport
            r"\b[A-Z]{1,2}\d{6,9}\b",
        ]
    )


class DuplicateMiddleware:
    """Detects and removes duplicate chunks based on similarity threshold."""

    def __init__(self, threshold: float = 0.98):
        self.threshold = threshold

    def process(self, chunks: List[Chunk]) -> List[Chunk]:
        """Remove duplicate chunks based on text similarity."""
        if not chunks:
            return chunks

        unique_chunks = []
        seen_hashes: Set[str] = set()
        duplicates_found = []

        for chunk in chunks:
            normalized = self._normalize_text(chunk.text)
            text_hash = self._get_hash(normalized)

            if text_hash in seen_hashes:
                duplicates_found.append(chunk.chunk_id)
                continue

            is_duplicate = False
            for seen_chunk in unique_chunks:
                similarity = self._calculate_similarity(
                    normalized, self._normalize_text(seen_chunk.text)
                )
                if similarity >= self.threshold:
                    duplicates_found.append(chunk.chunk_id)
                    is_duplicate = True
                    break

            if not is_duplicate:
                unique_chunks.append(chunk)
                seen_hashes.add(text_hash)

        # Store duplicate info for reporting
        self._last_duplicates = duplicates_found
        return unique_chunks

    def get_duplicates_count(self) -> int:
        """Get count of duplicates found in last process call."""
        return len(getattr(self, "_last_duplicates", []))

    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison."""
        return " ".join(text.lower().split())

    def _get_hash(self, text: str) -> str:
        """Get hash of normalized text."""
        return hashlib.md5(text.encode()).hexdigest()

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple similarity between two texts."""
        if not text1 or not text2:
            return 0.0

        # Simple character-based Jaccard similarity
        set1 = set(text1.split())
        set2 = set(text2.split())

        if not set1 or not set2:
            return 0.0

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        return intersection / union if union > 0 else 0.0


class TemporalMiddleware:
    """Adds temporal metadata to chunks based on document timestamps."""

    def __init__(self):
        pass

    def process(self, document: Document) -> Document:
        """Add temporal metadata to document chunks."""
        # Use document created_at or current time
        doc_date = document.metadata.created_at or document.created_at

        if not doc_date:
            from datetime import datetime

            doc_date = datetime.now()

        doc_date_str = (
            doc_date.isoformat() if hasattr(doc_date, "isoformat") else str(doc_date)
        )

        for chunk in document.section_chunks:
            if chunk.metadata is None:
                chunk.metadata = {}
            chunk.metadata["temporal_doc_date"] = doc_date_str

        for chunk in document.passage_chunks:
            if chunk.metadata is None:
                chunk.metadata = {}
            chunk.metadata["temporal_doc_date"] = doc_date_str

        for chunk in document.sentence_chunks:
            if chunk.metadata is None:
                chunk.metadata = {}
            chunk.metadata["temporal_doc_date"] = doc_date_str

        return document


class RedactMiddleware:
    """Redacts sensitive information from chunk text based on patterns."""

    def __init__(self, patterns: Optional[List[str]] = None, enabled: bool = True):
        self.enabled = enabled
        self.patterns = patterns or [
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
            r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",  # Phone
            r"\b\d{3}[-]\d{2}[-]\d{4}\b",  # SSN
            r"\b\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}\b",  # Credit card
        ]
        self.compiled_patterns = [
            (re.compile(p, re.IGNORECASE), p) for p in self.patterns
        ]

    def process(self, document: Document) -> Document:
        """Redact sensitive information from document chunks."""
        if not self.enabled:
            return document

        redaction_count = 0
        redactions = []

        for chunk in (
            document.section_chunks + document.passage_chunks + document.sentence_chunks
        ):
            for pattern, pattern_name in self.compiled_patterns:
                matches = list(pattern.finditer(chunk.text))
                for match in matches:
                    redaction_count += 1
                    redactions.append(
                        {
                            "chunk_id": chunk.chunk_id,
                            "pattern": pattern_name,
                            "original": match.group(),
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )

            # Replace with redacted text
            result = chunk.text
            for pattern, _ in self.compiled_patterns:
                result = pattern.sub("[REDACTED]", result)
            chunk.text = result

        # Track redaction in document metadata
        document.pii_redacted = True
        document.pii_report = {
            "redaction_count": redaction_count,
            "redactions": redactions,
        }

        return document

        redaction_count = 0

        def redact_text(text: str) -> str:
            nonlocal redaction_count
            result = text
            for pattern in self.compiled_patterns:
                matches = pattern.findall(result)
                redaction_count += len(matches)
                result = pattern.sub("[REDACTED]", result)
            return result

        # Redact all chunk texts
        for chunk in document.section_chunks:
            chunk.text = redact_text(chunk.text)

        for chunk in document.passage_chunks:
            chunk.text = redact_text(chunk.text)

        for chunk in document.sentence_chunks:
            chunk.text = redact_text(chunk.text)

        # Track redaction in metadata
        document.pii_redacted = True
        document.pii_report = {"redaction_count": redaction_count}

        return document


class ChunksMiddleware:
    """Orchestrates all middleware stages for chunk processing."""

    def __init__(self, config: Optional[MiddlewareConfig] = None):
        self.config = config or MiddlewareConfig()

        self.dedupe = DuplicateMiddleware(threshold=self.config.dedupe_threshold)
        self.temporal = TemporalMiddleware()
        self.redact = RedactMiddleware(
            patterns=self.config.redact_patterns, enabled=self.config.redact_enabled
        )

    def process(self, document: Document) -> Document:
        """Apply all enabled middleware stages."""
        # 1. Deduplicate
        if self.config.dedupe_enabled:
            document.section_chunks = self.dedupe.process(document.section_chunks)
            document.passage_chunks = self.dedupe.process(document.passage_chunks)
            document.sentence_chunks = self.dedupe.process(document.sentence_chunks)

        # 2. Temporal
        if self.config.temporal_enabled:
            document = self.temporal.process(document)

        # 3. Redact
        if self.config.redact_enabled:
            document = self.redact.process(document)

        return document

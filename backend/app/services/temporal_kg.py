"""
Flexible Temporal Knowledge Graph
- Uses patterns or LLM to extract facts
- Stores with timestamps
- Compares for contradictions
"""

import json
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field


@dataclass
class ExtractedFact:
    """A structured fact."""

    id: str = ""
    entity: str = ""
    attribute: str = ""  # e.g., "revenue", "rating"
    value: Any = None
    direction: str = ""  # "increase", "decrease", "neutral"
    confidence: float = 1.0
    document_id: str = ""
    created_at: datetime = None


@dataclass
class ComparisonResult:
    """Result of comparing two facts."""

    attribute: str
    is_contradiction: bool
    document_a_value: Any
    document_b_value: Any
    reason: str


class FlexibleExtractor:
    """Extract facts using configurable patterns or LLM."""

    # Default patterns (can be customized)
    PATTERNS = {
        "revenue": {
            "keywords": ["revenue", "sales", "income"],
            "directions": {
                "increase": ["increased", "grew", "growth", "up", "rose", "surge"],
                "decrease": [
                    "decreased",
                    "declined",
                    "decline",
                    "down",
                    "fell",
                    "drop",
                ],
            },
            "patterns": [
                r"\$?([\d.]+)\s*(billion|million|b|m)?",
                r"([\d]+)%",
            ],
        },
        "rating": {
            "keywords": ["buy", "sell", "hold", "outperform", "underperform"],
            "directions": {
                "positive": ["buy", "outperform", "overweight", "bullish"],
                "negative": ["sell", "underperform", "bearish"],
                "neutral": ["hold", "neutral"],
            },
        },
        "margin": {
            "keywords": ["margin", "profit"],
            "directions": {
                "increase": ["expanded", "improved", "increased"],
                "decrease": ["contracted", "declined", "decreased"],
            },
        },
        "employees": {
            "keywords": ["employees", "headcount", "workforce", "hired", "laid off"],
            "directions": {
                "increase": ["hired", "increased", "grew"],
                "decrease": ["laid off", "reduced", "decreased"],
            },
        },
        "outlook": {
            "keywords": ["outlook", "projection", "forecast", "expected"],
            "directions": {
                "positive": ["positive", "growth", "increase", "up", "upward"],
                "negative": ["negative", "decline", "decrease", "down", "downward"],
            },
        },
    }

    def __init__(self, custom_patterns: Dict = None):
        self.patterns = {**self.PATTERNS, **(custom_patterns or {})}

    def extract(self, text: str, document_id: str = "") -> List[ExtractedFact]:
        """Extract facts from text using patterns."""
        facts = []
        text_lower = text.lower()

        for attr, config in self.patterns.items():
            keywords = config.get("keywords", [])

            # Check if any keyword exists in text
            found = False
            for kw in keywords:
                if kw in text_lower:
                    found = True
                    break

            if not found:
                continue

            # Determine direction
            directions = config.get("directions", {})
            direction = "neutral"

            for dir_name, dir_keywords in directions.items():
                for dk in dir_keywords:
                    if dk in text_lower:
                        direction = dir_name
                        break

            # Extract value (simple number extraction)
            value = None
            patterns = config.get("patterns", [])

            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(1)
                    try:
                        value = float(value.replace(",", ""))
                        if "billion" in text_lower or "b " in text_lower:
                            value *= 1000
                    except:
                        pass
                    break

            fact = ExtractedFact(
                id=str(uuid.uuid4()),
                entity="company",
                attribute=attr,
                value=value or direction,
                direction=direction,
                document_id=document_id,
                created_at=datetime.now(),
            )
            facts.append(fact)

        return facts

    def extract_with_llm(self, text: str, document_id: str = "") -> List[ExtractedFact]:
        """Extract facts using LLM (for more accurate extraction)."""
        # This would call the LLM to extract structured JSON
        # You can customize the prompt
        pass


class TemporalKG:
    """Simple temporal graph storing facts with versions."""

    def __init__(self, extractor: FlexibleExtractor = None):
        self.extractor = extractor or FlexibleExtractor()
        self._facts: Dict[str, List[ExtractedFact]] = {}  # document_id -> facts

    def ingest(
        self, text: str, document_id: str, document_name: str = ""
    ) -> List[ExtractedFact]:
        """Ingest document and extract facts."""
        facts = self.extractor.extract(text, document_id)

        # Add document metadata
        for f in facts:
            f.document_id = document_id

        self._facts[document_id] = facts
        return facts

    def compare(self, doc_a_id: str, doc_b_id: str) -> List[ComparisonResult]:
        """Compare two documents for contradictions."""
        facts_a = self._facts.get(doc_a_id, [])
        facts_b = self._facts.get(doc_b_id, [])

        results = []

        # Index by attribute
        attrs_a = {f.attribute: f for f in facts_a}
        attrs_b = {f.attribute: f for f in facts_b}

        for attr in set(attrs_a.keys()) & set(attrs_b.keys()):
            fact_a = attrs_a[attr]
            fact_b = attrs_b[attr]

            # Compare directions
            if (
                fact_a.direction != fact_b.direction
                and fact_a.direction != "neutral"
                and fact_b.direction != "neutral"
            ):
                results.append(
                    ComparisonResult(
                        attribute=attr,
                        is_contradiction=True,
                        document_a_value=fact_a.value,
                        document_b_value=fact_b.value,
                        reason=f"A: {fact_a.direction}, B: {fact_b.direction}",
                    )
                )

        return results

    def get_facts(self, document_id: str) -> List[ExtractedFact]:
        """Get all facts for a document."""
        return self._facts.get(document_id, [])


# Singleton
_temporal_kg: Optional[TemporalKG] = None


def get_temporal_kg() -> TemporalKG:
    global _temporal_kg
    if _temporal_kg is None:
        _temporal_kg = TemporalKG()
    return _temporal_kg

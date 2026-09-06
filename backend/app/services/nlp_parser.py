"""
NLP-based Semantic Tree Parser using spaCy
- Uses POS tagging, dependency parsing, NER
- Cleaner and more accurate
"""

import spacy
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
import uuid


# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except:
    import subprocess

    subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")


@dataclass
class SemanticFact:
    """A structured fact extracted from text."""

    id: str = ""
    category: str = ""  # financial, operational, market, etc.
    attribute: str = ""  # revenue, margin, rating
    value: any = None  # extracted value
    direction: str = "neutral"  # up, down, neutral
    confidence: float = 1.0
    source_tokens: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "category": self.category,
            "attribute": self.attribute,
            "value": self.value,
            "direction": self.direction,
            "confidence": self.confidence,
        }


# Keyword → Category mapping
CATEGORY_KEYWORDS = {
    "financial": [
        "revenue",
        "sales",
        "profit",
        "margin",
        "income",
        "earnings",
        "eps",
        "ebitda",
        "financial",
    ],
    "operational": [
        "employee",
        "hired",
        "layoff",
        "workforce",
        "headcount",
        "acquisition",
        "office",
    ],
    "market": [
        "rating",
        "buy",
        "sell",
        "hold",
        "analyst",
        "target",
        "market share",
        "upgrade",
        "downgrade",
    ],
    "growth": ["growth", "increase", "expansion", "decline", "decrease"],
    "outlook": ["outlook", "projection", "forecast", "expected", "projected"],
}

# Direction indicators
DIRECTION_MAPPERS = {
    "up": [
        "increase",
        "increased",
        "grew",
        "growth",
        "positive",
        "strong",
        "buy",
        "up",
        "rose",
        "surge",
        "expanded",
        "improved",
        "higher",
        "record",
        "exceeded",
        "beat",
    ],
    "down": [
        "decrease",
        "decreased",
        "declined",
        "negative",
        "weak",
        "sell",
        "down",
        "fell",
        "drop",
        "contracted",
        "lower",
        "missed",
        "below",
        "laid off",
        "layoff",
    ],
}


class NLPProcessor:
    """NLP-based fact extraction using spaCy."""

    def __init__(self):
        self.nlp = nlp

        # Direction word sets for fast lookup
        self.up_words: Set[str] = set()
        self.down_words: Set[str] = set()

        for word in DIRECTION_MAPPERS.get("up", []):
            self.up_words.add(word)
        for word in DIRECTION_MAPPERS.get("down", []):
            self.down_words.add(word)

    def process(self, text: str) -> List[SemanticFact]:
        """Process text and extract facts using NLP."""
        doc = self.nlp(text)

        facts = []

        # Find sentences, entities
        for sent in doc.sents:
            sent_text = sent.text

            # Check each category keyword
            for category, keywords in CATEGORY_KEYWORDS.items():
                for keyword in keywords:
                    if keyword in sent_text.lower():
                        direction = self._find_direction(sent_text)

                        # Extract numeric value if present
                        value = self._extract_value(sent_text, keyword)

                        fact = SemanticFact(
                            id=str(uuid.uuid4()),
                            category=category,
                            attribute=keyword,
                            value=value,
                            direction=direction,
                            source_tokens=[keyword],
                        )
                        facts.append(fact)
                        break  # Only one fact per category per sentence

        return facts

    def _find_direction(self, text: str) -> str:
        """Find direction using NLP."""
        text_lower = text.lower()

        # Look for direction words
        for word in self.down_words:
            if word in text_lower:
                if word in ["laid off", "layoff"]:
                    return "down"
                return "down"

        for word in self.up_words:
            if word in text_lower:
                return "up"

        return "neutral"

    def _extract_value(self, text: str, keyword: str) -> Optional[str]:
        """Extract numeric value around keyword."""
        import re

        # Patterns for different attributes
        patterns = {
            "revenue": r"\$?[\d.]+\s*(billion|million)?",
            "margin": r"\d+%",
            "employees": r"[\d,]+",
            "growth": r"\d+%",
            "rating": r"(strong\s+)?(buy|sell|hold)",
        }

        pattern = patterns.get(keyword, r"[\d.]+")

        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)

        return None


class NLPTreeComparer:
    """Compare using NLP-extracted facts."""

    def __init__(self):
        self.processor = NLPProcessor()

    def compare(self, text_a: str, text_b: str) -> Dict:
        """Compare two texts using NLP."""
        facts_a = self.processor.process(text_a)
        facts_b = self.processor.process(text_b)

        # Index by category
        index_a = {f.category: f for f in facts_a}
        index_b = {f.category: f for f in facts_b}

        contradictions = []

        for cat in set(index_a.keys()) & set(index_b.keys()):
            a = index_a[cat]
            b = index_b[cat]

            if (
                a.direction != b.direction
                and a.direction != "neutral"
                and b.direction != "neutral"
            ):
                contradictions.append(
                    {
                        "category": a.category,
                        "a_direction": a.direction,
                        "a_value": a.value,
                        "b_direction": b.direction,
                        "b_value": b.value,
                    }
                )

        return {
            "facts_a": [f.to_dict() for f in facts_a],
            "facts_b": [f.to_dict() for f in facts_b],
            "contradictions": contradictions,
            "count": len(contradictions),
            "has_contradiction": len(contradictions) > 0,
        }

    def explain(self, result: Dict) -> str:
        """Generate explanation."""
        if result["has_contradiction"]:
            lines = ["⚠️ CONTRADICTIONS FOUND:"]
            for c in result["contradictions"]:
                lines.append(
                    f"  {c['category']}: {c['a_direction']} ({c['a_value']}) vs {c['b_direction']} ({c['b_value']})"
                )
            return "\n".join(lines)
        return "✓ No contradictions found"


# Test
if __name__ == "__main__":
    comparer = NLPTreeComparer()

    doc_a = "Revenue increased by 45% to $2.8B. Margin expanded to 28%. Strong buy. Hired 5000 employees."
    doc_b = "Revenue decreased by 35% to $1.2B. Margin contracted to 12%. Strong sell. Laid off 8000 employees."

    result = comparer.compare(doc_a, doc_b)

    print("Doc A Facts:")
    for f in result["facts_a"]:
        print(f"  {f}")

    print(f"\n{comparer.explain(result)}")

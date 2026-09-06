"""
Semantic Tree Parser - Detects direction around keywords
"""

import re
import uuid
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class Node:
    category: str
    attribute: str
    value: str
    direction: str


DIRECTION_KEYWORDS = {
    "up": [
        "increased",
        "grew",
        "expanded",
        "improved",
        "positive",
        "strong",
        "buy",
        "up",
        "rose",
        "surge",
        "growth",
        "higher",
        "record",
    ],
    "down": [
        "decreased",
        "declined",
        "contracted",
        "negative",
        "weak",
        "sell",
        "down",
        "fell",
        "drop",
        "decline",
        "lower",
        "laid off",
        "layoff",
    ],
}


def find_direction(text: str, keywords: List[str], window: int = 100) -> str:
    """Find direction by looking around keywords."""
    text_lower = text.lower()

    for kw in keywords:
        idx = text_lower.find(kw)
        if idx < 0:
            continue

        # Get context window
        start = max(0, idx - window)
        end = min(len(text_lower), idx + len(kw) + window)
        context = text_lower[start:end]

        # Check direction keywords in context
        for down_kw in DIRECTION_KEYWORDS["down"]:
            if down_kw in context:
                return "down"
        for up_kw in DIRECTION_KEYWORDS["up"]:
            if up_kw in context:
                return "up"

    return "neutral"


class Parser:
    """Parse text into nodes."""

    CATEGORIES = {
        "financial": {
            "keywords": [
                "revenue",
                "sales",
                "margin",
                "profit",
                "income",
                "earnings",
                "financial",
            ],
            "patterns": {
                "revenue": r"[\$]?([\d.]+)\s*(billion|million)?",
                "margin": r"(\d+)%",
            },
        },
        "rating": {
            "keywords": [
                "rating",
                "buy",
                "sell",
                "hold",
                "analyst",
                "upgrade",
                "downgrade",
            ],
            "patterns": {
                "rating": r"(strong\s+)?(buy|sell|hold)",
            },
        },
        "operations": {
            "keywords": [
                "employee",
                "hired",
                "layoff",
                "headcount",
                "workforce",
                "hiring",
            ],
            "patterns": {
                "hiring": r"(hired|laid off|added|reduced)\s*([\d,]+)",
            },
        },
        "outlook": {
            "keywords": ["outlook", "projection", "forecast", "expected", "projected"],
            "patterns": {},
        },
    }

    def parse(self, text: str) -> List[Node]:
        nodes = []
        text_lower = text.lower()

        for category, config in self.CATEGORIES.items():
            keywords = config["keywords"]

            # Skip if no keywords found
            if not any(kw in text_lower for kw in keywords):
                continue

            # Parse patterns
            for attr, pattern in config.get("patterns", {}).items():
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(0)
                else:
                    value = attr

                direction = find_direction(text, keywords, window=50)
                nodes.append(Node(category, attr, value, direction))

            # If no patterns but has keywords - check direction anyway
            if not config.get("patterns"):
                direction = find_direction(text, keywords, window=100)
                nodes.append(Node(category, category, category, direction))

        return nodes


class Comparer:
    """Compare parsed documents."""

    def __init__(self):
        self.parser = Parser()

    def compare(self, text_a: str, text_b: str) -> Dict:
        nodes_a = self.parser.parse(text_a)
        nodes_b = self.parser.parse(text_b)

        index_a = {(n.category, n.attribute): n for n in nodes_a}
        index_b = {(n.category, n.attribute): n for n in nodes_b}

        contradictions = []

        for key in set(index_a.keys()) & set(index_b.keys()):
            a = index_a[key]
            b = index_b[key]

            if (
                a.direction != b.direction
                and a.direction != "neutral"
                and b.direction != "neutral"
            ):
                contradictions.append(
                    {
                        "category": a.category,
                        "attribute": a.attribute,
                        "a_direction": a.direction,
                        "b_direction": b.direction,
                    }
                )

        return {
            "nodes_a": [
                {
                    "category": n.category,
                    "attribute": n.attribute,
                    "value": n.value,
                    "direction": n.direction,
                }
                for n in nodes_a
            ],
            "nodes_b": [
                {
                    "category": n.category,
                    "attribute": n.attribute,
                    "value": n.value,
                    "direction": n.direction,
                }
                for n in nodes_b
            ],
            "contradictions": contradictions,
            "has_contradiction": len(contradictions) > 0,
            "count": len(contradictions),
        }


# Test
if __name__ == "__main__":
    c = Comparer()

    doc_a = "Revenue increased by 45% to $2.8B. Margin expanded to 28%. Strong buy. Hired 5000 employees."
    doc_b = "Revenue decreased by 35% to $1.2B. Margin contracted to 12%. Strong sell. Laid off 8000 employees."

    result = c.compare(doc_a, doc_b)

    print("Doc A:", result["nodes_a"])
    print("Doc B:", result["nodes_b"])
    print(f"\nContradictions ({result['count']}):")
    for cx in result["contradictions"]:
        print(
            f"  {cx['category']}.{cx['attribute']}: {cx['a_direction']} vs {cx['b_direction']}"
        )

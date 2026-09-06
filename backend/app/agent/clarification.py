"""
Clarification Agent - handles ambiguous queries.
Asks users clarifying questions to resolve ambiguity.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class ClarificationQuestion:
    """A clarification question."""

    question: str
    context: str  # Why this question is needed
    missing_info: str  # What information is missing
    options: Optional[List[str]] = None  # For multiple choice


@dataclass
class ClarificationResponse:
    """Structured response from Clarification Agent."""

    needs_clarification: bool
    questions: List[ClarificationQuestion]
    resolved_query: Optional[str] = None  # If resolved
    ambiguity_reason: Optional[str] = None


# Common ambiguity patterns with their questions
AMBIGUITY_PATTERNS = {
    "revenue": {
        "question": "Whose revenue are you asking about?",
        "options": ["Company name", "Region", "Product line", "Overall"],
        "context": "Revenue could refer to different entities",
    },
    "growth": {
        "question": "What time period should I use for the growth analysis?",
        "options": [
            "Quarter over Quarter (QoQ)",
            "Year over Year (YoY)",
            "Month over Month (MoM)",
            "Custom range",
        ],
        "context": "Growth needs a baseline for comparison",
    },
    "performance": {
        "question": "Which performance metrics are you interested in?",
        "options": [
            "Revenue",
            "Profit",
            "Customer metrics",
            "Operational metrics",
            "All metrics",
        ],
        "context": "Performance could mean different things",
    },
    "compare": {
        "question": "What would you like to compare?",
        "options": ["Regions", "Time periods", "Products", "Competitors"],
        "context": "Comparison needs two or more entities",
    },
    "sales": {
        "question": "Which sales figures?",
        "options": ["Total sales", "Product-wise", "Region-wise", "By channel"],
        "context": "Sales can be broken down many ways",
    },
    "data": {
        "question": "What data type?",
        "options": ["Financial", "Operational", "Customer", "Marketing", "All"],
        "context": "Need to know data type for proper analysis",
    },
    "chart": {
        "question": "What chart type?",
        "options": [
            "Line (trends)",
            "Bar (comparison)",
            "Pie (composition)",
            "Scatter (correlation)",
        ],
        "context": "Different charts show different insights",
    },
    "top": {
        "question": "How many items?",
        "options": ["Top 3", "Top 5", "Top 10", "Custom"],
        "context": "Need to know how many to show",
    },
    "it": {
        "question": "What does 'it' refer to?",
        "options": None,
        "context": "Pronoun reference is unclear",
    },
    "that": {
        "question": "What are you referring to?",
        "options": None,
        "context": "Reference is ambiguous",
    },
}


async def detect_ambiguity(
    query: str, context: Optional[Dict] = None
) -> ClarificationResponse:
    """
    Detect ambiguity in a query.

    Args:
        query: User query
        context: Optional context (chat history, documents, etc.)

    Returns:
        ClarificationResponse with questions if needed
    """
    query_lower = query.lower()
    questions = []

    # Check each ambiguity pattern
    for key, pattern in AMBIGUITY_PATTERNS.items():
        if key in query_lower:
            # Check if context provides the answer
            if context and context.get(key):
                continue

            # Check if it's actually ambiguous (not explicitly stated)
            if not _is_explicit(key, query_lower):
                questions.append(
                    ClarificationQuestion(
                        question=pattern["question"],
                        options=pattern["options"],
                        context=pattern["context"],
                        missing_info=key,
                    )
                )

    # Check for missing time period - only for time-sensitive queries
    time_sensitive = any(
        kw in query_lower for kw in ["growth", "increase", "compare", "trend", "over"]
    )
    if time_sensitive and not _has_time_period(query_lower):
        if not context or not context.get("time_period"):
            questions.append(
                ClarificationQuestion(
                    question="What time period should I analyze?",
                    options=["FY 2024", "Q4 2023", "Last 12 months", "Custom range"],
                    context="Time period needed for analysis",
                    missing_info="time_period",
                )
            )

    # Check for missing comparison reference - only for comparison queries
    if any(kw in query_lower for kw in ["compare", "vs", "versus"]):
        if not context or not context.get("comparison_base"):
            questions.append(
                ClarificationQuestion(
                    question="What should I compare against?",
                    options=[
                        "Previous period",
                        "Same period last year",
                        "Target",
                        "Custom",
                    ],
                    context="Comparison needs a baseline",
                    missing_info="comparison_base",
                )
            )

    return ClarificationResponse(
        needs_clarification=len(questions) > 0,
        questions=questions,
        ambiguity_reason=", ".join([q.missing_info for q in questions])
        if questions
        else None,
    )


async def resolve_with_context(
    query: str,
    answers: Dict[str, str],
) -> ClarificationResponse:
    """
    Resolve query with user's answers to clarification questions.

    Args:
        query: Original query
        answers: User's answers to clarification questions

    Returns:
        ClarificationResponse with resolved query
    """
    resolved = query

    # Incorporate answers into query
    for key, answer in answers.items():
        # Simple substitution
        if key == "time_period":
            if "time_period" not in resolved.lower():
                resolved = f"{resolved} for {answer}"
        elif key == "comparison_base":
            if "comparison" not in resolved.lower():
                resolved = f"{resolved} compared to {answer}"
        else:
            # General substitution
            if answer not in resolved.lower():
                resolved = f"{resolved} {answer}"

    return ClarificationResponse(
        needs_clarification=False,
        questions=[],
        resolved_query=resolved,
    )


def _is_explicit(term: str, query: str) -> bool:
    """Check if term is explicitly defined in query."""
    # If term is followed by specific info, it's explicit
    term_pos = query.find(term)
    if term_pos == -1:
        return True

    # Check next 20 chars for specificity
    remaining = query[term_pos : term_pos + 30]
    explicit_indicators = ["of", "for", "in", "the", "is", "are", "by"]

    for indicator in explicit_indicators:
        if indicator in remaining:
            return True

    return False


def _has_time_period(query: str) -> bool:
    """Check if query has an explicit time period."""
    time_terms = [
        "fy",
        "q1",
        "q2",
        "q3",
        "q4",
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024",
        "2025",
        "year",
        "quarter",
        "month",
        "period",
    ]

    return any(term in query for term in time_terms)


async def ask_clarification(
    query: str,
    context: Optional[Dict] = None,
) -> ClarificationResponse:
    """
    Main clarification function.

    Args:
        query: User query
        context: Optional context

    Returns:
        ClarificationResponse with questions or resolved query
    """
    return await detect_ambiguity(query, context)

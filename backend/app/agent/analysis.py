"""
Analysis Agent - decomposes queries and plans execution.
Determines if query needs multi-hop reasoning and routes to appropriate tools.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
from loguru import logger


class QueryType(Enum):
    """Types of queries the agent can handle."""

    FACTUAL = "factual"  # Simple factual question
    ANALYTICAL = "analytical"  # Requires data analysis
    COMPARISON = "comparison"  # Comparing multiple things
    TREND = "trend"  # Historical analysis
    EXPLANATION = "explanation"  # Requires explanation
    MULTI_HOP = "multi_hop"  # Requires multiple pieces of info
    AMBIGUOUS = "ambiguous"  # Needs clarification
    VIDEO = "video"  # YouTube content
    VISUALIZATION = "visualization"  # Needs chart


class ToolRoute(Enum):
    """Tools to route to."""

    RAG = "rag"  # Standard RAG
    RAG_HYBRID = "rag_hybrid"  # Hybrid RAG
    RAG_MULTI_QUERY = "rag_multi_query"  # Multi-query
    DATA_ANALYST = "data_analyst"  # Data analysis + charts
    YOUTUBE = "youtube"  # YouTube rendering
    CLARIFICATION = "clarification"  # Needs user input


@dataclass
class SubQuery:
    """A decomposed sub-query."""

    query: str
    tool_route: ToolRoute
    priority: int  # 1 = execute first
    dependencies: List[str] = None  # IDs of queries this depends on


@dataclass
class QueryPlan:
    """Plan for executing a query."""

    original_query: str
    query_type: QueryType
    is_multi_hop: bool
    needs_clarification: bool
    sub_queries: List[SubQuery]
    recommended_tools: List[ToolRoute]
    reasoning: str  # Why this plan was chosen


@dataclass
class AnalysisResponse:
    """Structured response from Analysis Agent."""

    plan: QueryPlan
    clarification_questions: List[str] = None
    error: Optional[str] = None


async def analyze_query(query: str, context: Optional[Dict] = None) -> AnalysisResponse:
    """
    Analyze a user query and create execution plan.

    Args:
        query: User's question
        context: Optional context (chat history, documents, etc.)

    Returns:
        AnalysisResponse with plan and any clarification questions
    """
    query_lower = query.lower()

    # Determine query type
    query_type = _determine_query_type(query_lower)

    # Check if multi-hop
    is_multi_hop = _is_multi_hop(query_lower)

    # Check for ambiguity
    needs_clarification, clar_questions = _check_clarification(query_lower, context)

    # Create sub-queries if multi-hop
    sub_queries = _create_sub_queries(query, query_type, is_multi_hop)

    # Determine recommended tools
    recommended_tools = _determine_tools(query_type, is_multi_hop)

    # Build reasoning
    reasoning = _build_reasoning(query_type, is_multi_hop, recommended_tools)

    plan = QueryPlan(
        original_query=query,
        query_type=query_type,
        is_multi_hop=is_multi_hop,
        needs_clarification=needs_clarification,
        sub_queries=sub_queries,
        recommended_tools=recommended_tools,
        reasoning=reasoning,
    )

    return AnalysisResponse(
        plan=plan,
        clarification_questions=clar_questions if needs_clarification else None,
    )


def _determine_query_type(query: str) -> QueryType:
    """Determine the type of query."""
    # Check for video content
    if any(kw in query for kw in ["video", "youtube", "watch", "clip"]):
        return QueryType.VIDEO

    # Check for visualization
    if any(
        kw in query
        for kw in ["chart", "graph", "plot", "visualize", "show me", "display", "draw"]
    ):
        return QueryType.VISUALIZATION

    # Check for analytical
    if any(
        kw in query
        for kw in ["analyze", "analysis", "kpi", "metric", "trend", "growth"]
    ):
        return QueryType.ANALYTICAL

    # Check for comparison
    if any(kw in query for kw in ["compare", "vs", "versus", "between", "difference"]):
        return QueryType.COMPARISON

    # Check for trend
    if any(
        kw in query
        for kw in ["over time", "historical", "quarterly", "yearly", "growth"]
    ):
        return QueryType.TREND

    # Check for multi-hop indicators
    if any(kw in query for kw in ["and then", "therefore", "because", "so"]):
        return QueryType.MULTI_HOP

    # Check for factual
    if any(kw in query for kw in ["what is", "who is", "when", "where", "define"]):
        return QueryType.FACTUAL

    return QueryType.EXPLANATION


def _is_multi_hop(query: str) -> bool:
    """Determine if query requires multi-hop reasoning."""
    # Complex queries requiring multiple pieces of info
    multi_hop_indicators = [
        " and ",
        " then ",
        " therefore ",
        " because ",
        " so ",
        " after that",
        " first, ",
        " also",
        " besides",
    ]

    # Check for multiple questions
    question_count = query.count("?")
    if question_count > 1:
        return True

    # Check for conjunction indicators
    if any(indicator in query for indicator in multi_hop_indicators):
        return True

    # Check for comparative/superlative that implies reasoning
    if any(kw in query for kw in ["best", "top", "leading", "compared to"]):
        return True

    return False


def _check_clarification(query: str, context: Optional[Dict]) -> tuple[bool, List[str]]:
    """Check if query needs clarification."""
    questions = []
    needs_clarification = False

    # Check for ambiguity
    ambiguous_terms = {
        "it": "What does 'it' refer to?",
        "that": "What are you referring to?",
        "they": "Which specific items?",
        "revenue": " Whose revenue? Which time period?",
        "growth": "Compared to what period?",
        "performance": "Which performance metrics?",
        "data": "What specific data?",
        "result": "Which result?",
    }

    for term, question in ambiguous_terms.items():
        if f" {term}" in query or f" {term}s" in query:
            # Check if it's actually ambiguous (not in a specific context)
            if context is None or context.get("last_topic") != term:
                questions.append(question)
                needs_clarification = True

    # Check for missing time period
    time_indicators = ["quarter", "year", "month", "period", "fy"]
    has_time = any(ind in query for ind in time_indicators)
    if not has_time and any(kw in query for kw in ["compare", "growth", "increase"]):
        questions.append("For which time period?")
        needs_clarification = True

    return needs_clarification, questions


def _create_sub_queries(
    query: str, query_type: QueryType, is_multi_hop: bool
) -> List[SubQuery]:
    """Create sub-queries for multi-hop queries."""
    if not is_multi_hop:
        return [
            SubQuery(
                query=query,
                tool_route=ToolRoute.RAG_HYBRID,
                priority=1,
            )
        ]

    # Split compound queries
    sub_queries = []

    # Simple splitting on "and"
    parts = query.split(" and ")
    for i, part in enumerate(parts):
        tool = ToolRoute.RAG_HYBRID
        if any(kw in part.lower() for kw in ["chart", "graph", "visual"]):
            tool = ToolRoute.DATA_ANALYST
        elif any(kw in part.lower() for kw in ["video", "youtube"]):
            tool = ToolRoute.YOUTUBE

        sub_queries.append(
            SubQuery(
                query=part.strip(),
                tool_route=tool,
                priority=i + 1,
            )
        )

    return sub_queries


def _determine_tools(query_type: QueryType, is_multi_hop: bool) -> List[ToolRoute]:
    """Determine recommended tools for query type."""
    tool_mapping = {
        QueryType.FACTUAL: [ToolRoute.RAG_HYBRID],
        QueryType.EXPLANATION: [ToolRoute.RAG_HYBRID],
        QueryType.COMPARISON: [ToolRoute.RAG_HYBRID, ToolRoute.DATA_ANALYST],
        QueryType.TREND: [ToolRoute.RAG_HYBRID, ToolRoute.DATA_ANALYST],
        QueryType.ANALYTICAL: [ToolRoute.DATA_ANALYST, ToolRoute.RAG_HYBRID],
        QueryType.MULTI_HOP: [ToolRoute.RAG_HYBRID],
        QueryType.VIDEO: [ToolRoute.YOUTUBE],
        QueryType.VISUALIZATION: [ToolRoute.DATA_ANALYST],
    }

    tools = tool_mapping.get(query_type, [ToolRoute.RAG_HYBRID])

    if is_multi_hop:
        tools = [ToolRoute.RAG_MULTI_QUERY] + list(tools)

    return tools


def _build_reasoning(
    query_type: QueryType, is_multi_hop: bool, tools: List[ToolRoute]
) -> str:
    """Build reasoning explanation."""
    reasoning = f"Query classified as {query_type.value}"

    if is_multi_hop:
        reasoning += ", requiring multi-step analysis"

    tool_names = [t.value for t in tools]
    reasoning += f". Recommended tools: {', '.join(tool_names)}"

    return reasoning


async def plan_execution(
    query: str,
    context: Optional[Dict] = None,
) -> QueryPlan:
    """
    Planning function - creates execution plan from analysis.

    Args:
        query: User query
        context: Optional context

    Returns:
        QueryPlan for execution
    """
    response = await analyze_query(query, context)
    return response.plan

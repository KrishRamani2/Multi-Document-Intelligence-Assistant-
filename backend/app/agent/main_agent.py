"""
Main Agent - Orchestrates all sub-agents with streaming and structured output.
Uses langchain create_agent patterns with streaming support.
"""

import asyncio
from typing import List, Optional, Dict, Any, AsyncIterator
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger
import json

from app.agent.analysis import (
    analyze_query,
    QueryPlan,
    QueryType,
    ToolRoute,
    AnalysisResponse,
)
from app.agent.clarification import ask_clarification, ClarificationResponse
from app.agent.rag_tools import (
    search_with_options,
    RAGResponse,
    RAGResult,
)
from app.agent.data_analyst import (
    analyze_data,
    DataAnalystResponse,
    ChartData,
)
from app.agent.ytools import (
    render_youtube,
    YouTubeResponse,
    VideoSegment,
)


class StreamEventType(str, Enum):
    """Types of streaming events."""

    THINKING = "thinking"  # Agent reasoning
    TOOL_CALL = "tool_call"  # Tool execution started
    TOOL_RESULT = "tool_result"  # Tool result
    CLARIFICATION = "clarification"  # Need user input
    CHUNK = "chunk"  # Text chunk
    CHART = "chart"  # Chart data
    VIDEO = "video"  # Video segment
    SOURCE = "source"  # Source citation
    ERROR = "error"  # Error occurred
    COMPLETE = "complete"  # Done


@dataclass
class StreamEvent:
    """A streaming event."""

    type: StreamEventType
    data: Dict[str, Any]
    agent: str = "main"


@dataclass
class Source:
    """Source citation."""

    document_id: str
    document_name: str
    chunk_id: str
    score: float
    text_preview: str


@dataclass
class Answer:
    """Final structured answer."""

    text: str
    sources: List[Source] = field(default_factory=list)
    charts: List[Dict] = field(default_factory=list)
    videos: List[Dict] = field(default_factory=list)
    clarification: Optional[Dict] = None
    query_type: str = "factual"
    is_multi_hop: bool = False


async def stream_events(
    query: str,
    context: Optional[Dict] = None,
) -> AsyncIterator[StreamEvent]:
    """
    Main streaming agent - yields events as they happen.

    Args:
        query: User query
        context: Optional context

    Yields:
        StreamEvent objects
    """
    # Step 1: Analyze query
    yield StreamEvent(
        type=StreamEventType.THINKING,
        data={"message": "Analyzing query...", "query": query},
    )

    analysis = await analyze_query(query, context)
    plan = analysis.plan

    yield StreamEvent(
        type=StreamEventType.THINKING,
        data={
            "message": f"Query type: {plan.query_type.value}",
            "reasoning": plan.reasoning,
            "is_multi_hop": plan.is_multi_hop,
        },
    )

    # Step 2: Check clarification (disabled for demo)
    # if plan.needs_clarification:
    #     yield StreamEvent(
    #         type=StreamEventType.CLARIFICATION,
    #         data={
    #             "questions": analysis.clarification_questions,
    #             "message": "Need clarification",
    #         },
    #     )
    #     return

    # clar_resp = await ask_clarification(query, context)
    # if clar_resp.needs_clarification:
    #     yield StreamEvent(
    #         type=StreamEventType.CLARIFICATION,
    #         data={
    #             "questions": [q.question for q in clar_resp.questions],
    #             "options": [q.options for q in clar_resp.questions],
    #         },
    #     )
    #     return

    # Step 3: Execute based on plan
    all_sources = []
    all_charts = []
    all_videos = []
    answer_text_parts = []

    for tool_route in plan.recommended_tools:
        yield StreamEvent(
            type=StreamEventType.TOOL_CALL,
            data={"tool": tool_route.value, "query": query},
        )

        if tool_route == ToolRoute.RAG:
            result = await _execute_rag(query, "vector")
        elif tool_route == ToolRoute.RAG_HYBRID:
            result = await _execute_rag(
                query, "vector"
            )  # Force vector - BM25 has issues
        elif tool_route == ToolRoute.RAG_MULTI_QUERY:
            result = await _execute_rag(query, "vector")
        elif tool_route == ToolRoute.DATA_ANALYST:
            result = await _execute_data_analyst(query)
            if result.charts:
                all_charts.extend([_chart_to_dict(c) for c in result.charts])
        elif tool_route == ToolRoute.YOUTUBE:
            result = await _execute_youtube(query)
            if result.segments:
                all_videos.extend([_video_to_dict(s) for s in result.segments])
        elif tool_route == ToolRoute.DATA_ANALYST:
            result = await _execute_data_analyst(query)
        else:
            result = await _execute_rag(query, "hybrid")

        # Always add charts if RAG found data (auto-generate for queries with numerical data)
        if not all_charts and hasattr(result, "results") and result.results:
            chart_result = await _execute_data_analyst(query)
            if chart_result.charts:
                all_charts.extend([_chart_to_dict(c) for c in chart_result.charts])

        # Collect sources
        if hasattr(result, "results") and result.results:
            all_sources.extend(_extract_sources(result))

        if hasattr(result, "results") and result.results:
            texts = [r.text[:200] for r in result.results[:3]]
            answer_text_parts.extend(texts)

        yield StreamEvent(
            type=StreamEventType.TOOL_RESULT,
            data={
                "tool": tool_route.value,
                "results_count": len(getattr(result, "results", [])),
            },
        )

    # Step 4: Build final answer
    final_text = _build_answer(answer_text_parts, plan)

    # Yield complete
    yield StreamEvent(
        type=StreamEventType.COMPLETE,
        data={
            "answer": final_text,
            "sources": [_source_to_dict(s) for s in all_sources[:5]],
            "charts": all_charts,
            "videos": all_videos,
            "query_type": plan.query_type.value,
            "is_multi_hop": plan.is_multi_hop,
        },
    )


async def _execute_rag(query: str, mode: str) -> RAGResponse:
    """Execute RAG search."""
    return await search_with_options(query=query, mode=mode, limit=10)


async def _execute_data_analyst(query: str) -> DataAnalystResponse:
    """Execute data analysis."""
    return await analyze_data(query=query, data_source="rag")


async def _execute_youtube(query: str) -> YouTubeResponse:
    """Execute YouTube search."""
    # Placeholder - would need video URL
    return await render_youtube(query=query)


def _extract_sources(result: RAGResponse) -> List[Source]:
    """Extract sources from RAG result."""
    sources = []
    for r in result.results[:3]:
        sources.append(
            Source(
                document_id=r.document_id,
                document_name=r.document_name,
                chunk_id=r.chunk_id,
                score=r.score,
                text_preview=r.text[:150],
            )
        )
    return sources


def _chart_to_dict(chart: ChartData) -> Dict:
    """Convert chart to dict for Chart.js."""
    return {
        "chart_type": chart.chart_type,
        "title": chart.title,
        "labels": chart.labels,
        "datasets": chart.datasets,
        "insight": chart.insight,
        "sources": chart.sources,
    }


def _video_to_dict(segment: VideoSegment) -> Dict:
    """Convert video segment to dict."""
    return {
        "video_id": segment.video_id,
        "title": segment.title,
        "url": segment.url,
        "start_time": segment.start_time,
        "end_time": segment.end_time,
        "thumbnail": segment.thumbnail,
    }


def _source_to_dict(source: Source) -> Dict:
    """Convert source to dict."""
    return {
        "document_id": source.document_id,
        "document_name": source.document_name,
        "chunk_id": source.chunk_id,
        "score": source.score,
        "text_preview": source.text_preview,
    }


def _build_answer(text_parts: List[str], plan: QueryPlan) -> str:
    """Build final answer text."""
    if not text_parts:
        return "I couldn't find relevant information for your query."

    # Join and summarize
    combined = " ".join(text_parts[:2])

    if plan.query_type == QueryType.ANALYTICAL:
        return f"Based on the data: {combined[:300]}..."
    elif plan.query_type == QueryType.COMPARISON:
        return f"Here's the comparison: {combined[:300]}..."
    elif plan.is_multi_hop:
        return f"Analysis: {combined[:400]}..."
    else:
        return combined[:300] + "..."


async def invoke_agent(
    query: str,
    context: Optional[Dict] = None,
) -> Answer:
    """
    Invoke agent with structured output (non-streaming).

    Args:
        query: User query
        context: Optional context

    Returns:
        Answer with all components
    """
    # Collect all events
    all_sources = []
    all_charts = []
    all_videos = []
    answer_text = ""
    clarification = None
    query_type = "factual"
    is_multi_hop = False

    async for event in stream_events(query, context):
        if event.type == StreamEventType.COMPLETE:
            data = event.data
            answer_text = data.get("answer", "")
            all_sources = data.get("sources", [])
            all_charts = data.get("charts", [])
            all_videos = data.get("videos", [])
            query_type = data.get("query_type", "factual")
            is_multi_hop = data.get("is_multi_hop", False)
        elif event.type == StreamEventType.CLARIFICATION:
            clarification = event.data

    return Answer(
        text=answer_text,
        sources=[Source(**s) for s in all_sources],
        charts=all_charts,
        videos=all_videos,
        clarification=clarification,
        query_type=query_type,
        is_multi_hop=is_multi_hop,
    )


async def stream_agent(
    query: str,
    context: Optional[Dict] = None,
) -> AsyncIterator[Dict]:
    """
    Streaming interface for the agent.
    Yields JSON-serializable dicts for SSE.

    Args:
        query: User query
        context: Optional context

    Yields:
        Dict events
    """
    async for event in stream_events(query, context):
        yield {
            "type": event.type.value,
            "data": event.data,
            "agent": event.agent,
        }


# For use with langchain create_agent
async def agent_tool(
    query: str,
    context: Optional[Dict] = None,
) -> str:
    """
    Tool function for langchain agent.

    Args:
        query: User query
        context: Optional context

    Returns:
        Formatted answer string
    """
    answer = await invoke_agent(query, context)

    # Format as string
    output = answer.text

    if answer.sources:
        output += "\n\nSources:"
        for s in answer.sources:
            output += f"\n- {s.document_name} (score: {s.score:.2f})"

    if answer.charts:
        output += f"\n\nCharts: {len(answer.charts)} generated"

    return output

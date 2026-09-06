"""
Agent System - Multi-agent orchestration with streaming.
"""

from app.agent.main_agent import (
    stream_events,
    invoke_agent,
    stream_agent,
    agent_tool,
    StreamEvent,
    StreamEventType,
    Answer,
    Source,
)
from app.agent.analysis import (
    analyze_query,
    plan_execution,
    QueryPlan,
    QueryType,
    ToolRoute,
    SubQuery,
    AnalysisResponse,
)
from app.agent.clarification import (
    ask_clarification,
    detect_ambiguity,
    ClarificationQuestion,
    ClarificationResponse,
)
from app.agent.rag_tools import (
    search_with_options,
    vector_search,
    hybrid_search,
    multi_query_search,
    metadata_filtered_search,
    RAGResult,
    RAGResponse,
)
from app.agent.ytools import (
    render_youtube,
    search_youtube_transcript,
    get_video_timestamps,
    VideoSegment,
    YouTubeResponse,
)
from app.agent.data_analyst import (
    analyze_data,
    get_chart_config,
    ChartData,
    DataAnalystResponse,
)

__all__ = [
    # Main agent
    "stream_events",
    "invoke_agent",
    "stream_agent",
    "agent_tool",
    "StreamEvent",
    "StreamEventType",
    "Answer",
    "Source",
    # Analysis
    "analyze_query",
    "plan_execution",
    "QueryPlan",
    "QueryType",
    "ToolRoute",
    "SubQuery",
    "AnalysisResponse",
    # Clarification
    "ask_clarification",
    "detect_ambiguity",
    "ClarificationQuestion",
    "ClarificationResponse",
    # RAG tools
    "search_with_options",
    "vector_search",
    "hybrid_search",
    "multi_query_search",
    "metadata_filtered_search",
    "RAGResult",
    "RAGResponse",
    # YouTube
    "render_youtube",
    "search_youtube_transcript",
    "get_video_timestamps",
    "VideoSegment",
    "YouTubeResponse",
    # Data Analyst
    "analyze_data",
    "get_chart_config",
    "ChartData",
    "DataAnalystResponse",
]

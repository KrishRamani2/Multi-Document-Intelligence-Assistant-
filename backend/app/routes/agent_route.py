"""
Agent API Route - Streaming multi-agent interface.
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from loguru import logger

from app.agent import stream_agent, invoke_agent, StreamEventType


router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    """Request to agent."""

    query: str
    context: Optional[Dict[str, Any]] = None
    stream: bool = True  # Enable streaming by default


class AgentResponse(BaseModel):
    """Non-streaming response."""

    answer: str
    sources: List[Dict[str, Any]]
    charts: List[Dict[str, Any]]
    videos: List[Dict[str, Any]]
    query_type: str
    is_multi_hop: bool
    clarification: Optional[Dict[str, Any]] = None


@router.post("/invoke")
async def invoke(request: AgentRequest):
    """
    Invoke agent without streaming.
    Returns structured response with answer, sources, charts, videos.
    """
    logger.info(f"Agent invoke: {request.query}")

    try:
        answer = await invoke_agent(request.query, request.context)

        return AgentResponse(
            answer=answer.text,
            sources=[
                {
                    "document_id": s.document_id,
                    "document_name": s.document_name,
                    "score": s.score,
                    "text_preview": s.text_preview,
                }
                for s in answer.sources
            ],
            charts=answer.charts,
            videos=answer.videos,
            query_type=answer.query_type,
            is_multi_hop=answer.is_multi_hop,
            clarification=answer.clarification,
        )
    except Exception as e:
        logger.error(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream(request: AgentRequest):
    """
    Stream agent responses with SSE.

    Yields events:
    - thinking: Agent reasoning
    - tool_call: Tool execution started
    - tool_result: Tool result received
    - clarification: Need user input
    - chunk: Text chunk (for display)
    - chart: Chart data (for visualization)
    - video: Video segment (for embed)
    - source: Source citation
    - complete: Final answer with all data
    """
    logger.info(f"Agent stream: {request.query}")

    async def event_generator():
        try:
            async for event in stream_agent(request.query, request.context):
                # Format as SSE
                data = json.dumps(event)
                yield f"data: {data}\n\n"

                # Small delay for responsiveness
                await asyncio.sleep(0.01)
        except Exception as e:
            logger.error(f"Stream error: {e}")
            error_event = json.dumps(
                {
                    "type": "error",
                    "data": {"message": str(e)},
                    "agent": "main",
                }
            )
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/widgets")
async def get_widget_types():
    """
    Get available widget types for the UI.
    """
    return {
        "widgets": [
            {
                "type": "text",
                "description": "Plain text display",
                "data_fields": ["text"],
            },
            {
                "type": "chart",
                "description": "Plotly chart visualization",
                "data_fields": ["chart_type", "title", "data", "layout"],
            },
            {
                "type": "video",
                "description": "YouTube video embed",
                "data_fields": ["url", "start_time", "thumbnail"],
            },
            {
                "type": "sources",
                "description": "Source citations",
                "data_fields": ["document_name", "score", "text_preview"],
            },
            {
                "type": "clarification",
                "description": "Clarification questions",
                "data_fields": ["questions", "options"],
            },
        ],
        "events": [
            {"name": "thinking", "description": "Agent reasoning"},
            {"name": "tool_call", "description": "Tool starting"},
            {"name": "tool_result", "description": "Tool completed"},
            {"name": "clarification", "description": "Need user input"},
            {"name": "chunk", "description": "Text for display"},
            {"name": "chart", "description": "Chart for visualization"},
            {"name": "video", "description": "Video embed"},
            {"name": "source", "description": "Source citation"},
            {"name": "complete", "description": "Final answer"},
        ],
    }

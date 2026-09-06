from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from loguru import logger

from app.vector_store import get_vector_store
from app.retrieval.hybrid_search import HybridRetriever
from app.retrieval.multi_query import MultiQueryRetriever
from embeddings.service import (
    HuggingFaceEmbedder,
    GeminiEmbedder,
    EmbeddingService,
    OpenAIEmbedder,
)


def get_embedder():
    """Get embedder based on environment config."""
    provider = os.getenv("EMBEDDING_PROVIDER", "gemini")
    if provider == "gemini":
        return GeminiEmbedder()
    elif provider == "openai":
        return OpenAIEmbedder(dimensions=512)
    else:
        return HuggingFaceEmbedder()


router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    document_id: Optional[str] = None

    # Hybrid search options
    use_hybrid: bool = True  # Enable hybrid (BM25 + vector)
    vector_weight: float = 0.5  # Weight for vector (0-1)
    bm25_weight: float = 0.5  # Weight for BM25 (0-1)
    use_rrf: bool = True  # Use Reciprocal Rank Fusion

    # Multi-query options
    use_multi_query: bool = False  # Generate query variations

    # Limits
    limit: int = 10
    vector_top_k: int = 20
    bm25_top_k: int = 20

    # Metadata filters
    chunk_type: Optional[str] = None  # filter by chunk_type
    heading_path_contains: Optional[str] = None  # filter by heading


class SearchResponse(BaseModel):
    query: str
    results: List[dict]
    meta: dict


@router.post("", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """
    Hybrid search combining BM25 + Vector search.

    Also supports:
    - Multi-query: Generate variations and search all
    - Metadata filtering: Filter by chunk_type, heading_path

    ## Hybrid Search

    Combines keyword search (BM25) with semantic search (vectors):
    - vector_weight + bm25_weight = 1.0 (should)
    - use_rrf=True uses Reciprocal Rank Fusion (recommended)
    - use_rrf=False uses weighted score combination

    ## Metadata Filtering

    Filter results by:
    - chunk_type: "section", "passage", "sentence", "recursive"
    - heading_path_contains: "Introduction" matches "Introduction > Overview"
    """
    logger.info(
        f"Search: '{request.query}', hybrid={request.use_hybrid}, weights=({request.vector_weight},{request.bm25_weight})"
    )

    try:
        vector_store = get_vector_store()

        # Check if store has data FIRST (before trying to get embedder)
        stats = await vector_store.get_stats()
        if stats["total_chunks"] == 0:
            return SearchResponse(
                query=request.query,
                results=[],
                meta={
                    "mode": "empty",
                    "message": "No documents indexed. Ingest a document first.",
                },
            )

        # Now try to get embedder (after confirming we have data)
        embedder = get_embedder()

        # Build metadata filter
        metadata_filter = {}
        if request.chunk_type:
            metadata_filter["chunk_type"] = request.chunk_type
        if request.heading_path_contains:
            # We'll filter after getting results (not stored in vector)
            pass

        # Get chunks from vector store for BM25 indexing
        stats = await vector_store.get_stats()

        # Build hybrid retriever
        retriever = HybridRetriever(vector_store, embedder)

        # Index current chunks for BM25
        # In production, you'd maintain a separate BM25 index
        # For now, we'll do a simple search
        all_chunks = []
        # Note: Vector store doesn't expose all chunks - this is a limitation
        # In production, you'd store chunks in DB with searchable text

        # Multi-query retriever (generates variations, searches all, combines)
        if request.use_multi_query:
            logger.info("Using multi-query retriever")
            mq_retriever = MultiQueryRetriever(vector_store, embedder)
            mq_result = await mq_retriever.retrieve(
                query=request.query,
                document_id=request.document_id,
                num_variations=4,
                top_k_per_variation=request.vector_top_k,
                final_top_k=request.limit,
            )
            results = mq_result["results"]
            mode = "multi_query"
            meta_info = {
                "mode": mode,
                "variations": mq_result["variations"],
                "total_unique_chunks": mq_result["meta"]["total_unique_chunks"],
            }
        # Hybrid search
        if request.use_hybrid:
            # Try hybrid, but fall back to vector-only if BM25 fails
            try:
                results = await retriever.search(
                    query=request.query,
                    document_id=request.document_id,
                    vector_weight=request.vector_weight,
                    bm25_weight=request.bm25_weight,
                    vector_top_k=request.vector_top_k,
                    bm25_top_k=request.bm25_top_k,
                    final_top_k=request.limit,
                    metadata_filter=metadata_filter if metadata_filter else None,
                    use_rrf=request.use_rrf,
                )
            except Exception as e:
                logger.warning(f"Hybrid search failed, falling back to vector: {e}")
                # Fallback to pure vector search
                query_embedding = embedder.embed([request.query])[0]
                results = await vector_store.search(
                    query_embedding=query_embedding,
                    limit=request.limit,
                    document_id=request.document_id,
                )
                results = [
                    {
                        "chunk_id": r.chunk_id,
                        "text": r.text,
                        "document_id": r.document_id,
                        "document_name": r.document_name,
                        "score": round(r.score, 4),
                        "chunk_type": r.chunk_type,
                        "heading_path": r.heading_path,
                        "level": r.level,
                        "start_char": r.start_char,
                        "end_char": r.end_char,
                        "tables": r.tables,
                        "images": r.images,
                        "source": "vector",
                    }
                    for r in results
                ]
                mode = "vector_fallback"
            else:
                mode = "hybrid"

            # Post-filter heading_path
            if request.heading_path_contains:
                results = [
                    r
                    for r in results
                    if request.heading_path_contains.lower()
                    in r.get("heading_path", "").lower()
                ]

            return SearchResponse(
                query=request.query,
                results=results,
                meta=meta_info,
            )

        # Simple vector search
        query_embedding = embedder.embed([request.query])[0]
        results = await vector_store.search(
            query_embedding=query_embedding,
            limit=request.limit,
            document_id=request.document_id,
        )

        formatted = []
        for r in results:
            # Post-filter heading
            if (
                request.heading_path_contains
                and request.heading_path_contains.lower()
                not in (r.heading_path or "").lower()
            ):
                continue
            formatted.append(
                {
                    "chunk_id": r.chunk_id,
                    "text": r.text,
                    "document_id": r.document_id,
                    "document_name": r.document_name,
                    "score": round(r.score, 4),
                    "chunk_type": r.chunk_type,
                    "heading_path": r.heading_path,
                    "source": "vector",
                    # Additional metadata
                    "level": r.level,
                    "start_char": r.start_char,
                    "end_char": r.end_char,
                    "tables": r.tables if hasattr(r, "tables") else [],
                    "images": r.images if hasattr(r, "images") else [],
                }
            )

        return SearchResponse(
            query=request.query,
            results=formatted,
            meta={"mode": "vector_only"},
        )

    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_vector_stats():
    """Get vector store statistics."""
    try:
        vector_store = get_vector_store()
        stats = await vector_store.get_stats()

        # Get embedding provider info
        import os

        embed_provider = os.getenv("EMBEDDING_PROVIDER", "gemini")

        return {
            "total_vectors": stats["total_chunks"],
            "total_documents": stats["documents"],
            "embedding_provider": embed_provider,
            "status": "ready" if stats["total_chunks"] > 0 else "empty",
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

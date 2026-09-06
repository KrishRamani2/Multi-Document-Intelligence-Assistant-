"""
RAG Tools for the agent system.
Provides all RAG retrieval modes: vector, hybrid, multi-query, metadata filtering.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class RAGResult:
    """Structured RAG search result."""

    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str
    level: Optional[str] = None
    heading_path: Optional[str] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    tables: Optional[List[Dict]] = None
    images: Optional[List[Dict]] = None
    sources: Optional[List[str]] = None


@dataclass
class RAGResponse:
    """Structured response from RAG search."""

    results: List[RAGResult]
    mode: str  # "vector", "hybrid", "multi_query"
    query: str
    variations: Optional[List[Dict]] = None  # For multi-query
    meta: Dict[str, Any] = None


async def vector_search(
    query: str,
    document_id: Optional[str] = None,
    limit: int = 10,
) -> RAGResponse:
    """
    Simple vector similarity search.

    Args:
        query: Search query
        document_id: Optional filter to specific document
        limit: Number of results

    Returns:
        RAGResponse with results and metadata
    """
    from app.routes.search_route import get_embedder, get_vector_store

    embedder = get_embedder()
    vector_store = get_vector_store()

    query_embedding = embedder.embed([query])[0]
    search_results = await vector_store.search(
        query_embedding=query_embedding,
        limit=limit,
        document_id=document_id,
    )

    results = [
        RAGResult(
            chunk_id=r.chunk_id,
            text=r.text,
            document_id=r.document_id,
            document_name=r.document_name,
            score=r.score,
            chunk_type=r.chunk_type,
            level=r.level,
            heading_path=r.heading_path,
            start_char=r.start_char,
            end_char=r.end_char,
            tables=r.tables,
            images=r.images,
            sources=[r.document_id],
        )
        for r in search_results
    ]

    return RAGResponse(
        results=results,
        mode="vector",
        query=query,
    )


async def hybrid_search(
    query: str,
    document_id: Optional[str] = None,
    vector_weight: float = 0.5,
    bm25_weight: float = 0.5,
    use_rrf: bool = True,
    limit: int = 10,
    vector_top_k: int = 20,
    bm25_top_k: int = 20,
) -> RAGResponse:
    """
    Hybrid search combining BM25 + vector with RRF.

    Args:
        query: Search query
        document_id: Optional filter to specific document
        vector_weight: Weight for vector (0-1)
        bm25_weight: Weight for BM25 (0-1)
        use_rrf: Use Reciprocal Rank Fusion
        limit: Final number of results
        vector_top_k: Results from vector search
        bm25_top_k: Results from BM25

    Returns:
        RAGResponse with results and metadata
    """
    from app.routes.search_route import get_embedder
    from app.retrieval.hybrid_search import HybridRetriever
    from app.vector_store import get_vector_store

    embedder = get_embedder()
    vector_store = get_vector_store()
    retriever = HybridRetriever(vector_store, embedder)

    search_results = await retriever.search(
        query=query,
        document_id=document_id,
        vector_weight=vector_weight,
        bm25_weight=bm25_weight,
        vector_top_k=vector_top_k,
        bm25_top_k=bm25_top_k,
        final_top_k=limit,
        use_rrf=use_rrf,
    )

    results = [
        RAGResult(
            chunk_id=r["chunk_id"],
            text=r["text"],
            document_id=r["document_id"],
            document_name=r["document_name"],
            score=r["score"],
            chunk_type=r.get("chunk_type", "unknown"),
            level=r.get("level"),
            heading_path=r.get("heading_path"),
            start_char=r.get("start_char"),
            end_char=r.get("end_char"),
            tables=r.get("tables"),
            images=r.get("images"),
            sources=[r["document_id"]],
        )
        for r in search_results
    ]

    return RAGResponse(
        results=results,
        mode="hybrid",
        query=query,
    )


async def multi_query_search(
    query: str,
    document_id: Optional[str] = None,
    num_variations: int = 4,
    limit: int = 10,
) -> RAGResponse:
    """
    Multi-query search: generates variations, searches all, combines.

    Args:
        query: Search query
        document_id: Optional filter to specific document
        num_variations: Number of query variations to generate
        limit: Final number of results

    Returns:
        RAGResponse with results and generated variations
    """
    from app.routes.search_route import get_embedder
    from app.retrieval.multi_query import MultiQueryRetriever
    from app.vector_store import get_vector_store

    embedder = get_embedder()
    vector_store = get_vector_store()
    mq_retriever = MultiQueryRetriever(vector_store, embedder)

    mq_result = await mq_retriever.retrieve(
        query=query,
        document_id=document_id,
        num_variations=num_variations,
        top_k_per_variation=5,
        final_top_k=limit,
    )

    results = [
        RAGResult(
            chunk_id=r["chunk_id"],
            text=r["text"],
            document_id=r["document_id"],
            document_name=r["document_name"],
            score=r["score"],
            chunk_type=r.get("chunk_type", "unknown"),
            heading_path=r.get("heading_path"),
            sources=[r["document_id"]],
        )
        for r in mq_result["results"]
    ]

    return RAGResponse(
        results=results,
        mode="multi_query",
        query=query,
        variations=mq_result.get("variations"),
        meta={
            "total_unique_chunks": mq_result["meta"]["total_unique_chunks"],
            "variations_searched": mq_result["meta"]["variations_searched"],
        },
    )


async def metadata_filtered_search(
    query: str,
    document_id: Optional[str] = None,
    chunk_type: Optional[str] = None,
    heading_path_contains: Optional[str] = None,
    limit: int = 10,
) -> RAGResponse:
    """
    Search with metadata filtering.

    Args:
        query: Search query
        document_id: Optional filter to specific document
        chunk_type: Filter by chunk type (section, passage, sentence)
        heading_path_contains: Filter by heading path
        limit: Number of results

    Returns:
        RAGResponse with filtered results
    """
    from app.routes.search_route import get_embedder
    from app.vector_store import get_vector_store

    embedder = get_embedder()
    vector_store = get_vector_store()

    query_embedding = embedder.embed([query])[0]
    all_results = await vector_store.search(
        query_embedding=query_embedding,
        limit=limit * 2,  # Get more to filter
        document_id=document_id,
    )

    filtered = []
    for r in all_results:
        if chunk_type and r.chunk_type != chunk_type:
            continue
        if (
            heading_path_contains
            and heading_path_contains.lower() not in (r.heading_path or "").lower()
        ):
            continue
        filtered.append(r)
        if len(filtered) >= limit:
            break

    results = [
        RAGResult(
            chunk_id=r.chunk_id,
            text=r.text,
            document_id=r.document_id,
            document_name=r.document_name,
            score=r.score,
            chunk_type=r.chunk_type,
            level=r.level,
            heading_path=r.heading_path,
            start_char=r.start_char,
            end_char=r.end_char,
            tables=r.tables,
            images=r.images,
            sources=[r.document_id],
        )
        for r in filtered
    ]

    return RAGResponse(
        results=results,
        mode="metadata_filtered",
        query=query,
    )


async def search_with_options(
    query: str,
    document_id: Optional[str] = None,
    mode: str = "hybrid",  # "vector", "hybrid", "multi_query"
    chunk_type: Optional[str] = None,
    heading_path_contains: Optional[str] = None,
    limit: int = 10,
) -> RAGResponse:
    """
    Unified search with mode selection.

    Args:
        query: Search query
        document_id: Optional filter to specific document
        mode: Search mode - "vector", "hybrid", "multi_query"
        chunk_type: Filter by chunk type
        heading_path_contains: Filter by heading
        limit: Number of results

    Returns:
        RAGResponse with results
    """
    if mode == "vector":
        return await vector_search(query, document_id, limit)
    elif mode == "hybrid":
        return await hybrid_search(query, document_id, limit=limit)
    elif mode == "multi_query":
        return await multi_query_search(query, document_id, limit=limit)
    else:
        # Default to hybrid
        return await hybrid_search(query, document_id, limit=limit)

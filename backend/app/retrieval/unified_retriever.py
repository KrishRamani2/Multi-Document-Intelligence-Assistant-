"""
Unified Retriever - Stitch together all RAG components
"""

import asyncio
import time
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class RetrievalResult:
    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str
    heading_path: Optional[str] = None
    source: str = ""  # Which retriever returned this


@dataclass
class RetrievalMetrics:
    query: str
    mode: str
    embedder: str
    top_k: int
    retrieval_time_ms: float
    embedding_time_ms: float
    search_time_ms: float
    num_results: int
    results: List[RetrievalResult]


class UnifiedRetriever:
    """
    Unify all retrieval strategies:
    - basic: Simple vector search
    - hybrid: BM25 + Vector with RRF
    - multi_query: Query variations + rerank
    - multi_vector: Multiple chunk types
    """

    RETRIEVAL_MODES = ["basic", "hybrid", "multi_query", "multi_vector"]

    def __init__(
        self,
        vector_store,
        embedder,
        use_bm25: bool = False,
        use_cross_encoder: bool = False,
    ):
        self._vector_store = vector_store
        self._embedder = embedder
        self._use_bm25 = use_bm25
        self._use_cross_encoder = use_cross_encoder
        self._cross_encoder = None

        self._hybrid_retriever = None
        self._multi_query_retriever = None
        self._multi_vector_retriever = None

        if use_bm25:
            from app.retrieval.hybrid_search import HybridRetriever

            self._hybrid_retriever = HybridRetriever(vector_store, embedder)

        from app.retrieval.multi_query import MultiQueryRetriever
        from app.retrieval.multi_vector import MultiVectorRetriever

        self._multi_query_retriever = MultiQueryRetriever(vector_store, embedder)
        self._multi_vector_retriever = MultiVectorRetriever(vector_store)

        if use_cross_encoder:
            try:
                from app.retrieval.multi_query import CrossEncoderReranker

                self._cross_encoder = CrossEncoderReranker()
            except Exception as e:
                logger.warning(f"Cross-encoder not available: {e}")

    async def retrieve(
        self,
        query: str,
        mode: str = "basic",
        top_k: int = 10,
        document_id: Optional[str] = None,
        return_metrics: bool = True,
    ) -> Dict[str, Any]:
        """
        Retrieve documents using specified mode.

        Args:
            query: Search query
            mode: Retrieval mode (basic, hybrid, multi_query, multi_vector)
            top_k: Number of results to return
            document_id: Optional filter to specific document
            return_metrics: Include timing metrics

        Returns:
            Dict with 'results' and optionally 'metrics'
        """
        if mode not in self.RETRIEVAL_MODES:
            raise ValueError(f"Unknown mode: {mode}. Use: {self.RETRIEVAL_MODES}")

        start_time = time.time()

        if mode == "basic":
            return await self._retrieve_basic(
                query, top_k, document_id, return_metrics, start_time
            )
        elif mode == "hybrid":
            return await self._retrieve_hybrid(
                query, top_k, document_id, return_metrics, start_time
            )
        elif mode == "multi_query":
            return await self._retrieve_multi_query(
                query, top_k, document_id, return_metrics, start_time
            )
        elif mode == "multi_vector":
            return await self._retrieve_multi_vector(
                query, top_k, document_id, return_metrics, start_time
            )

    async def _retrieve_basic(
        self,
        query: str,
        top_k: int,
        document_id: Optional[str],
        return_metrics: bool,
        start_time: float,
    ) -> Dict[str, Any]:
        """Basic vector search."""
        emb_start = time.time()
        query_embedding = self._embedder.embed([query])[0]
        emb_time = (time.time() - emb_start) * 1000

        search_start = time.time()
        results = await self._vector_store.search(
            query_embedding=query_embedding,
            limit=top_k,
            document_id=document_id,
        )
        search_time = (time.time() - search_start) * 1000

        retrieval_time = (time.time() - start_time) * 1000

        retrieval_results = [
            RetrievalResult(
                chunk_id=r.chunk_id,
                text=r.text,
                document_id=r.document_id,
                document_name=r.document_name,
                score=r.score,
                chunk_type=r.chunk_type,
                heading_path=r.heading_path,
                source="vector",
            )
            for r in results
        ]

        output = {"results": retrieval_results}
        if return_metrics:
            output["metrics"] = RetrievalMetrics(
                query=query,
                mode="basic",
                embedder=getattr(self._embedder, "model", "unknown"),
                top_k=top_k,
                retrieval_time_ms=retrieval_time,
                embedding_time_ms=emb_time,
                search_time_ms=search_time,
                num_results=len(retrieval_results),
                results=retrieval_results,
            )

        return output

    async def _retrieve_hybrid(
        self,
        query: str,
        top_k: int,
        document_id: Optional[str],
        return_metrics: bool,
        start_time: float,
    ) -> Dict[str, Any]:
        """Hybrid BM25 + Vector search."""
        if not self._hybrid_retriever:
            logger.warning("Hybrid not enabled, falling back to basic")
            return await self._retrieve_basic(
                query, top_k, document_id, return_metrics, start_time
            )

        emb_start = time.time()
        query_embedding = self._embedder.embed([query])[0]
        emb_time = (time.time() - emb_start) * 1000

        search_start = time.time()
        results = await self._hybrid_retriever.search(
            query=query,
            query_embedding=query_embedding,
            vector_top_k=top_k,
            final_top_k=top_k,
            document_id=document_id,
        )
        search_time = (time.time() - search_start) * 1000

        retrieval_time = (time.time() - start_time) * 1000

        retrieval_results = [
            RetrievalResult(
                chunk_id=r.get("chunk_id", ""),
                text=r.get("text", ""),
                document_id=r.get("document_id", ""),
                document_name=r.get("document_name", ""),
                score=r.get("score", 0.0),
                chunk_type=r.get("chunk_type", ""),
                heading_path=r.get("heading_path"),
                source=r.get("source", "hybrid"),
            )
            for r in results
        ]

        output = {"results": retrieval_results}
        if return_metrics:
            output["metrics"] = RetrievalMetrics(
                query=query,
                mode="hybrid",
                embedder=getattr(self._embedder, "model", "unknown"),
                top_k=top_k,
                retrieval_time_ms=retrieval_time,
                embedding_time_ms=emb_time,
                search_time_ms=search_time,
                num_results=len(retrieval_results),
                results=retrieval_results,
            )

        return output

    async def _retrieve_multi_query(
        self,
        query: str,
        top_k: int,
        document_id: Optional[str],
        return_metrics: bool,
        start_time: float,
    ) -> Dict[str, Any]:
        """Multi-query with variations."""
        if not self._multi_query_retriever:
            return await self._retrieve_basic(
                query, top_k, document_id, return_metrics, start_time
            )

        search_start = time.time()
        output = await self._multi_query_retriever.retrieve(
            query=query,
            document_id=document_id,
            num_variations=4,
            top_k_per_variation=top_k // 2,
            final_top_k=top_k,
        )
        search_time = (time.time() - search_start) * 1000
        retrieval_time = (time.time() - start_time) * 1000

        raw_results = output.get("results", [])
        retrieval_results = [
            RetrievalResult(
                chunk_id=r.get("chunk_id", ""),
                text=r.get("text", ""),
                document_id=r.get("document_id", ""),
                document_name=r.get("document_name", ""),
                score=r.get("score", 0.0),
                chunk_type=r.get("chunk_type", ""),
                heading_path=r.get("heading_path"),
                source="multi_query",
            )
            for r in raw_results
        ]

        final_output = {
            "results": retrieval_results,
            "variations": output.get("variations", []),
        }
        if return_metrics:
            final_output["metrics"] = RetrievalMetrics(
                query=query,
                mode="multi_query",
                embedder=getattr(self._embedder, "model", "unknown"),
                top_k=top_k,
                retrieval_time_ms=retrieval_time,
                embedding_time_ms=0,  # Included in search
                search_time_ms=search_time,
                num_results=len(retrieval_results),
                results=retrieval_results,
            )

        return final_output

    async def _retrieve_multi_vector(
        self,
        query: str,
        top_k: int,
        document_id: Optional[str],
        return_metrics: bool,
        start_time: float,
    ) -> Dict[str, Any]:
        """Multi-vector with chunk type diversity."""
        if not self._multi_vector_retriever:
            return await self._retrieve_basic(
                query, top_k, document_id, return_metrics, start_time
            )

        emb_start = time.time()
        query_embedding = self._embedder.embed([query])[0]
        emb_time = (time.time() - emb_start) * 1000

        search_start = time.time()
        results = await self._multi_vector_retriever.retrieve(
            query_embedding=query_embedding,
            document_id=document_id,
            chunk_types=["section", "passage", "sentence"],
            top_k_per_type=top_k // 2,
            final_top_k=top_k,
        )
        search_time = (time.time() - search_start) * 1000

        retrieval_time = (time.time() - start_time) * 1000

        retrieval_results = [
            RetrievalResult(
                chunk_id=r.chunk_id,
                text=r.text,
                document_id=r.document_id,
                document_name=r.document_name,
                score=r.score,
                chunk_type=r.chunk_type,
                heading_path=r.heading_path,
                source="multi_vector",
            )
            for r in results
        ]

        output = {"results": retrieval_results}
        if return_metrics:
            output["metrics"] = RetrievalMetrics(
                query=query,
                mode="multi_vector",
                embedder=getattr(self._embedder, "model", "unknown"),
                top_k=top_k,
                retrieval_time_ms=retrieval_time,
                embedding_time_ms=emb_time,
                search_time_ms=search_time,
                num_results=len(retrieval_results),
                results=retrieval_results,
            )

        return output

    def get_embedder(self):
        return self._embedder

    def get_vector_store(self):
        return self._vector_store

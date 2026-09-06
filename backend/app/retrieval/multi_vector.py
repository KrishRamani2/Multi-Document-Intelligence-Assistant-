"""
Multi-Vector Retriever
Retrieves from multiple chunk types and combines/reranks results
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class MultiVectorResult:
    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str  # section, passage, sentence, recursive
    heading_path: Optional[str] = None
    source_chunk_type: str = ""  # which vector was retrieved from


class MultiVectorRetriever:
    """Retrieve from multiple chunk types and combine results."""

    def __init__(self, vector_store):
        self._vector_store = vector_store

    async def retrieve(
        self,
        query_embedding: List[float],
        document_id: Optional[str] = None,
        chunk_types: List[str] = None,
        top_k_per_type: int = 5,
        final_top_k: int = 10,
    ) -> List[MultiVectorResult]:
        """
        Retrieve from multiple chunk types and combine.

        Args:
            query_embedding: The query vector
            document_id: Optional filter to specific document
            chunk_types: Which types to search (default: all)
            top_k_per_type: Results to get from each type
            final_top_k: Final combined results

        Returns:
            Combined and reranked results from all chunk types
        """
        if chunk_types is None:
            chunk_types = ["section", "passage", "sentence", "recursive"]

        logger.info(f"Multi-vector检索: {chunk_types}, top_k={top_k_per_type}")

        # For now, we search once and tag results by chunk type
        # In production, you'd index each chunk type separately
        all_results = []

        # Search the vector store
        results = await self._vector_store.search(
            query_embedding=query_embedding,
            limit=top_k_per_type * len(chunk_types),
            document_id=document_id,
        )

        # Tag each result with its chunk type (from metadata)
        for r in results:
            all_results.append(
                MultiVectorResult(
                    chunk_id=r.chunk_id,
                    text=r.text,
                    document_id=r.document_id,
                    document_name=r.document_name,
                    score=r.score,
                    chunk_type=r.chunk_type,
                    heading_path=r.heading_path,
                    source_chunk_type=r.chunk_type,
                )
            )

        # Sort by score and return top_k
        all_results.sort(key=lambda x: x.score, reverse=True)
        return all_results[:final_top_k]

    async def retrieve_with_diversity(
        self,
        query_embedding: List[float],
        document_id: Optional[str] = None,
        chunk_types: List[str] = None,
        top_k_per_type: int = 3,
        final_top_k: int = 10,
    ) -> List[MultiVectorResult]:
        """
        Retrieve with diversity - ensure results come from different chunk types.
        Useful for getting a overview of the document at different granularities.
        """
        if chunk_types is None:
            chunk_types = ["section", "passage", "sentence", "recursive"]

        # Get results from each chunk type
        type_results: Dict[str, List[MultiVectorResult]] = {}

        results = await self._vector_store.search(
            query_embedding=query_embedding,
            limit=top_k_per_type * len(chunk_types),
            document_id=document_id,
        )

        for r in results:
            ct = r.chunk_type
            if ct not in type_results:
                type_results[ct] = []
            type_results[ct].append(
                MultiVectorResult(
                    chunk_id=r.chunk_id,
                    text=r.text,
                    document_id=r.document_id,
                    document_name=r.document_name,
                    score=r.score,
                    chunk_type=r.chunk_type,
                    heading_path=r.heading_path,
                    source_chunk_type=r.chunk_type,
                )
            )

        # Interleave results from each type for diversity
        combined = []
        max_len = max(len(v) for v in type_results.values()) if type_results else 0

        for i in range(max_len):
            for ct in chunk_types:
                if i < len(type_results.get(ct, [])):
                    combined.append(type_results[ct][i])

        # Apply score boost for higher-level chunks (sections > passages > sentences)
        score_boost = {
            "section": 1.1,
            "passage": 1.0,
            "sentence": 0.9,
            "recursive": 0.95,
        }

        for r in combined:
            r.score *= score_boost.get(r.chunk_type, 1.0)

        combined.sort(key=lambda x: x.score, reverse=True)
        return combined[:final_top_k]


class Reranker:
    """Rerank retrieved results using additional signals."""

    @staticmethod
    def rerank_by_position(
        results: List[MultiVectorResult], boost_early: float = 1.1
    ) -> List[MultiVectorResult]:
        """Boost results that appear earlier in their document."""
        position_boost = {}

        for r in results:
            # Get position from chunk_id (assume ordered) - simple heuristic
            try:
                # Extract number from chunk_id like "chunk-001"
                num = int(
                    "".join(filter(str.isdigit, r.chunk_id.split("-")[-1])) or "0"
                )
                # Earlier chunks get boost
                boost = boost_early if num < 10 else 1.0
                position_boost[r.chunk_id] = boost
            except:
                position_boost[r.chunk_id] = 1.0

        for r in results:
            r.score *= position_boost.get(r.chunk_id, 1.0)

        results.sort(key=lambda x: x.score, reverse=True)
        return results

    @staticmethod
    def rerank_by_length(
        results: List[MultiVectorResult], target_length: int = 500
    ) -> List[MultiVectorResult]:
        """Boost chunks closer to target length (useful for LLM context)."""
        for r in results:
            length = len(r.text)
            # Closer to target length = higher score
            length_score = 1.0 - (abs(length - target_length) / (target_length * 2))
            r.score *= max(0.5, length_score)

        results.sort(key=lambda x: x.score, reverse=True)
        return results

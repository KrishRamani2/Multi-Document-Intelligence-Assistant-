"""
Multi-Query Retriever
Generate query variations, search all, combine/rerank results
"""

import asyncio
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from loguru import logger


@dataclass
class QueryVariation:
    """A generated variation of the original query."""

    text: str
    type: str  # " paraphrase", "subquestion", "keyword", "original"


@dataclass
class RetrievedChunk:
    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str
    heading_path: Optional[str] = None
    query_variation: str = ""  # Which variation found this


class QueryVariationGenerator:
    """Generate variations of a query for better retrieval."""

    def __init__(self):
        pass  # Could use LLM for better variations, keeping simple for now

    def generate(self, query: str, num_variations: int = 4) -> List[QueryVariation]:
        """Generate query variations."""
        variations = [QueryVariation(text=query, type="original")]

        # Simple rule-based variations
        q = query.lower()

        # Paraphrase patterns
        if "what" in q or "how" in q:
            variations.append(QueryVariation(text=query + "?", type="paraphrase"))
            variations.append(
                QueryVariation(text=f"Information about {query}", type="paraphrase")
            )

        # Keyword extraction (simple)
        words = [w for w in q.split() if len(w) > 3]
        if words:
            keywords = " ".join(words[:3])
            variations.append(QueryVariation(text=keywords, type="keyword"))

        # Sub-questions (for "X Y" -> "What is X about Y?")
        if " " in query:
            parts = query.split()
            if len(parts) >= 2:
                variations.append(
                    QueryVariation(
                        text=f"Tell me about {parts[-1]}", type="subquestion"
                    )
                )

        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for v in variations:
            if v.text.lower() not in seen:
                seen.add(v.text.lower())
                unique_variations.append(v)

        return unique_variations[:num_variations]


class MultiQueryRetriever:
    """Generate variations, search all, combine results."""

    def __init__(self, vector_store, embedder):
        self._vector_store = vector_store
        self._embedder = embedder
        self._variation_gen = QueryVariationGenerator()

    async def retrieve(
        self,
        query: str,
        document_id: Optional[str] = None,
        num_variations: int = 4,
        top_k_per_variation: int = 5,
        final_top_k: int = 10,
        rerank: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate variations, search each, combine results.

        Args:
            query: Original user query
            document_id: Optional filter to specific document
            num_variations: How many variations to generate
            top_k_per_variation: Results per variation
            final_top_k: Final combined results
            rerank: Whether to apply score normalization

        Returns:
            Dict with results, variations, and meta info
        """
        # 1. Generate variations
        variations = self._variation_gen.generate(query, num_variations)
        logger.info(f"Generated {len(variations)} query variations")

        # 2. Embed all variations
        variation_texts = [v.text for v in variations]
        embeddings = self._embedder.embed(variation_texts)

        # 3. Search each variation concurrently
        async def search_variation(variation: QueryVariation, emb):
            results = await self._vector_store.search(
                query_embedding=emb,
                limit=top_k_per_variation,
                document_id=document_id,
            )
            # Tag results with which variation found them
            for r in results:
                r.query_variation = variation.text
            return results

        tasks = [search_variation(v, e) for v, e in zip(variations, embeddings)]
        all_results = await asyncio.gather(*tasks)

        # 4. Combine results (deduplicate by chunk_id, combine scores)
        combined: Dict[str, Dict] = {}

        for variation_results in all_results:
            for r in variation_results:
                chunk_key = r.chunk_id

                if chunk_key not in combined:
                    combined[chunk_key] = {
                        "chunk_id": r.chunk_id,
                        "text": r.text,
                        "document_id": r.document_id,
                        "document_name": r.document_name,
                        "score": 0.0,
                        "chunk_type": r.chunk_type,
                        "heading_path": r.heading_path,
                        "found_by_variations": [],
                    }

                # Add score (average across variations)
                combined[chunk_key]["score"] += r.score
                combined[chunk_key]["found_by_variations"].append(r.query_variation)

        # 5. Normalize scores (average) and sort
        final_results = []
        for chunk_data in combined.values():
            chunk_data["score"] /= len(variations)  # Average
            chunk_data["found_by_variations"] = list(
                set(chunk_data["found_by_variations"])
            )
            final_results.append(chunk_data)

        final_results.sort(key=lambda x: x["score"], reverse=True)

        return {
            "original_query": query,
            "variations": [{"text": v.text, "type": v.type} for v in variations],
            "results": final_results[:final_top_k],
            "meta": {
                "total_unique_chunks": len(combined),
                "variations_searched": len(variations),
                "final_returned": min(final_top_k, len(final_results)),
            },
        }


class CrossEncoderReranker:
    """Use cross-encoder to rerank results (more accurate but slower)."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        from sentence_transformers import CrossEncoder

        self._model = CrossEncoder(model_name)
        logger.info(f"Loaded reranker: {model_name}")

    async def rerank(
        self,
        query: str,
        results: List[Dict],
        top_k: int = 10,
    ) -> List[Dict]:
        """Rerank results using cross-encoder scores."""
        if not results:
            return []

        # Create query-document pairs
        pairs = [(query, r["text"]) for r in results]

        # Get scores
        scores = self._model.predict(pairs)

        # Add rerank scores and resort
        for i, (r, score) in enumerate(zip(results, scores)):
            r["rerank_score"] = float(score)
            r["original_score"] = r["score"]
            r["score"] = float(score)  # Replace with rerank score

        results.sort(key=lambda x: x["rerank_score"], reverse=True)

        return results[:top_k]

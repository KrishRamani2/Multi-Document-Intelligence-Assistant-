"""
Hybrid Search - combines BM25 + Vector + Metadata filtering
"""

import math
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass
from loguru import logger


@dataclass
class BM25Result:
    chunk_id: str
    text: str
    score: float
    document_id: str = ""
    document_name: str = ""


class BM25:
    """BM25 ranking function for keyword search."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._corpus = []
        self._doc_lengths = []
        self._avg_doc_length = 0
        self._doc_freqs = {}  # term -> doc frequency
        self._total_docs = 0

    def index(self, documents: List[Dict[str, Any]]):
        """Build BM25 index from documents."""
        self._corpus = documents
        self._total_docs = len(documents)
        self._doc_lengths = []
        self._doc_freqs = {}

        for doc in documents:
            text = doc.get("text", "")
            tokens = self._tokenize(text)
            self._doc_lengths.append(len(tokens))

            # Count document frequencies
            seen = set()
            for token in tokens:
                if token not in seen:
                    self._doc_freqs[token] = self._doc_freqs.get(token, 0) + 1
                    seen.add(token)

        self._avg_doc_length = sum(self._doc_lengths) / max(1, self._total_docs)
        logger.info(f"BM25 indexed {self._total_docs} documents")

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization."""
        return text.lower().split()

    def score(self, query: str, top_k: int = 10) -> List[BM25Result]:
        """Score documents against query."""
        query_tokens = self._tokenize(query)

        if not query_tokens or not self._corpus:
            return []

        scores = []

        for i, doc in enumerate(self._corpus):
            doc_tokens = self._tokenize(doc.get("text", ""))
            doc_len = self._doc_lengths[i]

            score = 0.0
            for term in query_tokens:
                if term in doc_tokens:
                    tf = doc_tokens.count(term)
                    idf = math.log(
                        (self._total_docs - self._doc_freqs.get(term, 0) + 0.5)
                        / (self._doc_freqs.get(term, 0) + 0.5)
                        + 1
                    )

                    # BM25 formula
                    numerator = tf * (self.k1 + 1)
                    denominator = tf + self.k1 * (
                        1 - self.b + self.b * doc_len / self._avg_doc_length
                    )
                    score += idf * numerator / denominator

            if score > 0:
                scores.append(
                    BM25Result(
                        chunk_id=doc.get("chunk_id", ""),
                        text=doc.get("text", "")[:200],
                        score=score,
                        document_id=doc.get("document_id", ""),
                        document_name=doc.get("document_name", ""),
                    )
                )

        scores.sort(key=lambda x: x.score, reverse=True)
        return scores[:top_k]


class HybridRetriever:
    """Combine BM25 + Vector + Metadata filtering."""

    def __init__(self, vector_store, embedder):
        self._vector_store = vector_store
        self._embedder = embedder
        self._bm25_index: Dict[str, BM25] = {}  # document_id -> BM25
        self._all_chunks: List[Dict] = []
        self._bm25: Optional[BM25] = None

    async def load_chunks_from_store(self):
        """Load all chunks from vector store for BM25 indexing."""
        # Get stats to check if we have data
        stats = await self._vector_store.get_stats()
        if stats.get("total_chunks", 0) == 0:
            logger.warning("No chunks in vector store to load")
            return

        # Vector store doesn't expose all chunks directly
        # This is a limitation - in production, store chunks in DB
        logger.warning("Chunk loading not implemented - using vector-only search")

    def index_for_bm25(self, chunks: List[Dict]):
        """Index chunks for BM25 search."""
        self._all_chunks = chunks
        # Build BM25 index
        self._bm25 = BM25()
        self._bm25.index(chunks)

    async def search(
        self,
        query: str,
        document_id: Optional[str] = None,
        # Weights
        vector_weight: float = 0.5,
        bm25_weight: float = 0.5,
        # Limits
        vector_top_k: int = 20,
        bm25_top_k: int = 20,
        final_top_k: int = 10,
        # Metadata filter
        metadata_filter: Optional[Dict[str, Any]] = None,
        # RRF (Reciprocal Rank Fusion)
        use_rrf: bool = True,
    ) -> List[Dict]:
        """
        Hybrid search combining BM25 + Vector.

        Args:
            query: Search query
            document_id: Optional filter to specific document
            vector_weight: Weight for vector search (0-1)
            bm25_weight: Weight for BM25 (0-1)
            vector_top_k: Results to get from vector
            bm25_top_k: Results to get from BM25
            final_top_k: Final combined results
            metadata_filter: Filter by chunk metadata
            use_rrf: Use reciprocal rank fusion instead of weighted sum
        """
        logger.info(
            f"Hybrid search: query='{query}', vector={vector_weight}, bm25={bm25_weight}"
        )

        # 1. Apply metadata filter if provided
        all_chunks = self._all_chunks
        if metadata_filter:
            all_chunks = self._filter_by_metadata(all_chunks, metadata_filter)
            logger.info(f"Filtered to {len(all_chunks)} chunks")

        # Rebuild BM25 index for filtered chunks
        if all_chunks:
            self._bm25 = BM25()
            self._bm25.index(all_chunks)
        else:
            logger.warning("No chunks for BM25, using vector-only search")
            self._bm25 = None

        # 2. Vector search
        query_embedding = self._embedder.embed([query])[0]

        if document_id:
            # If filtering by document, we need custom logic
            vector_results = await self._vector_store.search(
                query_embedding=query_embedding,
                limit=vector_top_k,
                document_id=document_id,
            )
        else:
            vector_results = await self._vector_store.search(
                query_embedding=query_embedding,
                limit=vector_top_k,
            )

        # 3. BM25 search
        if self._bm25:
            bm25_results = self._bm25.score(query, bm25_top_k)
        else:
            logger.warning("BM25 not indexed, using vector-only results")
            bm25_results = []

        # 4. Combine results
        combined = self._combine_results(
            vector_results,
            bm25_results,
            vector_weight,
            bm25_weight,
            use_rrf,
        )

        return combined[:final_top_k]

    def _filter_by_metadata(
        self, chunks: List[Dict], filters: Dict[str, Any]
    ) -> List[Dict]:
        """Filter chunks by metadata."""
        filtered = []
        for chunk in chunks:
            match = True
            for key, value in filters.items():
                if chunk.get(key) != value:
                    match = False
                    break
            if match:
                filtered.append(chunk)
        return filtered

    def _combine_results(
        self,
        vector_results: List,
        bm25_results: List[BM25Result],
        vector_weight: float,
        bm25_weight: float,
        use_rrf: bool,
    ) -> List[Dict]:
        """Combine results from both retrievers."""

        if use_rrf:
            # Reciprocal Rank Fusion
            k = 60  # RRF parameter

            ranks = {}

            # Add vector results
            for rank, r in enumerate(vector_results):
                key = r.chunk_id
                if key not in ranks:
                    ranks[key] = {"chunk": r, "rrf_score": 0}
                ranks[key]["rrf_score"] += 1 / (k + rank + 1)

            # Add BM25 results
            for rank, r in enumerate(bm25_results):
                key = r.chunk_id
                if key not in ranks:
                    ranks[key] = {"chunk": r, "rrf_score": 0}
                ranks[key]["rrf_score"] += 1 / (k + rank + 1)

            # Sort by RRF score
            sorted_results = sorted(
                ranks.values(), key=lambda x: x["rrf_score"], reverse=True
            )

            results = []
            for item in sorted_results:
                chunk = item["chunk"]
                chunk_id = getattr(chunk, "chunk_id", None)
                if chunk_id:
                    # Vector result
                    results.append(
                        {
                            "chunk_id": chunk_id,
                            "text": chunk.text,
                            "document_id": chunk.document_id,
                            "document_name": chunk.document_name,
                            "score": round(item["rrf_score"], 4),
                            "chunk_type": chunk.chunk_type,
                            "heading_path": chunk.heading_path,
                            "level": getattr(chunk, "level", None),
                            "start_char": getattr(chunk, "start_char", None),
                            "end_char": getattr(chunk, "end_char", None),
                            "tables": getattr(chunk, "tables", None),
                            "images": getattr(chunk, "images", None),
                            "source": "vector",
                        }
                    )
                else:
                    # BM25 result
                    results.append(
                        {
                            "chunk_id": chunk.chunk_id,
                            "text": chunk.text,
                            "document_id": chunk.document_id,
                            "document_name": chunk.document_name,
                            "score": round(item["rrf_score"], 4),
                            "chunk_type": "bm25",
                            "source": "bm25",
                        }
                    )

            return results

        else:
            # Weighted combination
            # Normalize scores
            vector_max = max((r.score for r in vector_results), default=1)
            bm25_max = max((r.score for r in bm25_results), default=1)

            combined = {}

            for r in vector_results:
                key = r.chunk_id
                norm_score = r.score / vector_max if vector_max > 0 else 0
                combined[key] = {
                    "chunk_id": r.chunk_id,
                    "text": r.text,
                    "document_id": r.document_id,
                    "document_name": r.document_name,
                    "score": norm_score * vector_weight,
                    "chunk_type": r.chunk_type,
                    "heading_path": r.heading_path,
                    "source": "vector",
                }

            for r in bm25_results:
                key = r.chunk_id
                norm_score = r.score / bm25_max if bm25_max > 0 else 0
                if key in combined:
                    combined[key]["score"] += norm_score * bm25_weight
                    combined[key]["source"] = "hybrid"
                else:
                    combined[key] = {
                        "chunk_id": r.chunk_id,
                        "text": r.text,
                        "document_id": r.document_id,
                        "document_name": r.document_name,
                        "score": norm_score * bm25_weight,
                        "chunk_type": "bm25",
                        "source": "bm25",
                    }

            return sorted(combined.values(), key=lambda x: x["score"], reverse=True)

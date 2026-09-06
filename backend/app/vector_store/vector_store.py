from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
import numpy as np
from loguru import logger


@dataclass
class SearchResult:
    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str
    heading_path: Optional[str] = None
    level: Optional[str] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    tables: Optional[List[Dict]] = None
    images: Optional[List[Dict]] = None


class VectorStore:
    """Simple in-memory vector store with ingest and search methods."""

    def __init__(self):
        self._embeddings: List[np.ndarray] = []
        self._texts: List[str] = []
        self._metadata: List[Dict[str, Any]] = []

    async def ingest(
        self,
        document_id: str,
        document_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ):
        """Ingest document chunks with embeddings."""
        logger.info(f"Ingesting {len(chunks)} chunks for doc: {document_id}")

        for chunk, embedding in zip(chunks, embeddings):
            self._embeddings.append(np.array(embedding))
            self._texts.append(chunk.get("text", ""))
            self._metadata.append(
                {
                    "chunk_id": chunk.get("chunk_id", ""),
                    "document_id": document_id,
                    "document_name": document_name,
                    "chunk_type": chunk.get("level", "unknown"),
                    "heading_path": chunk.get("heading_path"),
                    "start_char": chunk.get("start_char"),
                    "end_char": chunk.get("end_char"),
                    "tables": chunk.get("tables", []),
                    "images": chunk.get("images", []),
                    "level": chunk.get("level"),
                }
            )

        logger.info(f"Ingested {len(chunks)} chunks. Total: {len(self._texts)}")

    async def search(
        self,
        query_embedding: List[float],
        limit: int = 5,
        document_id: Optional[str] = None,
    ) -> List[SearchResult]:
        """Search for similar chunks using cosine similarity."""
        if not self._embeddings:
            return []

        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        query_normalized = query_vec / query_norm

        results = []
        for i, emb in enumerate(self._embeddings):
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                continue

            emb_normalized = emb / emb_norm
            score = float(np.dot(query_normalized, emb_normalized))

            if document_id and self._metadata[i]["document_id"] != document_id:
                continue

            results.append((i, score))

        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:limit]

        search_results = []
        for idx, score in results:
            meta = self._metadata[idx]
            search_results.append(
                SearchResult(
                    chunk_id=meta["chunk_id"],
                    text=self._texts[idx],
                    document_id=meta["document_id"],
                    document_name=meta["document_name"],
                    score=score,
                    chunk_type=meta["chunk_type"],
                    heading_path=meta.get("heading_path"),
                    level=meta.get("level"),
                    start_char=meta.get("start_char"),
                    end_char=meta.get("end_char"),
                    tables=meta.get("tables", []),
                    images=meta.get("images", []),
                )
            )

        logger.info(f"Found {len(search_results)} results")
        return search_results

    async def delete_document(self, document_id: str):
        """Delete all chunks for a document."""
        indices = [
            i for i, m in enumerate(self._metadata) if m["document_id"] == document_id
        ]
        for i in reversed(indices):
            self._embeddings.pop(i)
            self._texts.pop(i)
            self._metadata.pop(i)
        logger.info(f"Deleted {len(indices)} chunks for doc: {document_id}")

    async def get_stats(self) -> Dict[str, Any]:
        """Get vector store stats."""
        return {
            "total_chunks": len(self._texts),
            "documents": len(set(m["document_id"] for m in self._metadata)),
        }


_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store

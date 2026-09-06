from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger
import os


@dataclass
class SearchResult:
    chunk_id: str
    text: str
    document_id: str
    document_name: str
    score: float
    chunk_type: str
    heading_path: Optional[str] = None


class QdrantVectorStore:
    """Qdrant vector store using langchain-qdrant - in-memory mode."""

    def __init__(self, collection_name: str = "documents"):
        self.collection_name = collection_name
        self._client = None

    def _get_client(self):
        if self._client is None:
            from qdrant_client import QdrantClient

            # Use in-memory mode for simplicity
            self._client = QdrantClient(":memory:")
        return self._client

    async def create_collection(self, vector_size: int = 384):
        """Create collection if not exists."""
        from qdrant_client.http.models import Distance, VectorParams

        client = self._get_client()

        try:
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            logger.info(f"Created collection: {self.collection_name}")
        except Exception:
            pass  # Already exists

    async def add_chunks(
        self,
        document_id: str,
        document_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ):
        """Add document chunks with embeddings to Qdrant."""
        from qdrant_client.http.models import PointStruct
        import uuid

        logger.info(f"Adding {len(chunks)} chunks to Qdrant for doc: {document_id}")

        client = self._get_client()

        # Ensure collection exists
        try:
            from qdrant_client.http.models import Distance, VectorParams

            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
        except Exception:
            pass

        # Create points with valid UUIDs
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            unique_str = f"{document_id}_{chunk.get('chunk_id', str(i))}"
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_str))
            vector = embedding.tolist() if hasattr(embedding, "tolist") else embedding

            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "chunk_id": chunk.get("chunk_id", f"chunk-{i}"),
                        "text": chunk.get("text", ""),
                        "document_id": document_id,
                        "document_name": document_name,
                        "chunk_type": chunk.get("level", "unknown"),
                        "heading_path": chunk.get("heading_path"),
                    },
                )
            )

        client.upsert(collection_name=self.collection_name, points=points)
        logger.info(f"Added {len(points)} points to Qdrant")

    async def search(
        self,
        query_embedding: List[float],
        limit: int = 5,
        document_id: Optional[str] = None,
    ) -> List[SearchResult]:
        """Search for similar chunks."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue

        logger.info(f"Searching Qdrant, limit: {limit}")

        client = self._get_client()

        query_vec = (
            query_embedding.tolist()
            if hasattr(query_embedding, "tolist")
            else query_embedding
        )

        try:
            results = client.search(
                collection_name=self.collection_name,
                query_vector=query_vec,
                limit=limit,
            )
        except Exception as e:
            logger.warning(f"Search failed: {e}, returning empty")
            return []

        search_results = []
        for result in results:
            payload = result.payload if hasattr(result, "payload") else {}
            search_results.append(
                SearchResult(
                    chunk_id=payload.get("chunk_id", "unknown")
                    if payload
                    else "unknown",
                    text=payload.get("text", "") if payload else "",
                    document_id=payload.get("document_id", "") if payload else "",
                    document_name=payload.get("document_name", "") if payload else "",
                    score=result.score,
                    chunk_type=payload.get("chunk_type", "unknown")
                    if payload
                    else "unknown",
                    heading_path=payload.get("heading_path") if payload else None,
                )
            )

        logger.info(f"Found {len(search_results)} results")
        return search_results

    async def delete_document(self, document_id: str):
        """Delete all chunks for a document."""
        logger.info(f"Delete not implemented for in-memory mode")

    async def get_collection_info(self) -> Dict[str, Any]:
        """Get collection info."""
        client = self._get_client()
        try:
            collection = client._collections[self.collection_name]
            return {
                "name": self.collection_name,
                "vectors_count": collection.vectors_count,
                "points_count": collection.points_count,
                "status": "green",
            }
        except Exception as e:
            return {
                "name": self.collection_name,
                "status": "not_found",
                "error": str(e),
            }


# Singleton instance
_vector_store: Optional[QdrantVectorStore] = None


def get_vector_store(collection_name: str = "documents") -> QdrantVectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = QdrantVectorStore(collection_name)
    return _vector_store

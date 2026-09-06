"""
Test Qdrant Vector Store
"""

import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from loguru import logger

from app.vector_store.qdrant_store import get_vector_store, QdrantVectorStore


async def test_qdrant():
    logger.info("Starting Qdrant tests...")

    # Initialize vector store
    vector_store = get_vector_store()

    # 1. Create collection
    logger.info("1. Creating collection...")
    await vector_store.create_collection(vector_size=384)

    # 2. Get collection info
    logger.info("2. Getting collection info...")
    info = await vector_store.get_collection_info()
    logger.info(f"Collection info: {info}")

    # 3. Add test chunks with embeddings
    logger.info("3. Adding test chunks...")

    test_chunks = [
        {
            "chunk_id": "chunk-1",
            "text": "The company revenue grew by 25% in 2024.",
            "level": "passage",
            "heading_path": "Financial Results > Revenue",
            "start_char": 0,
            "end_char": 45,
        },
        {
            "chunk_id": "chunk-2",
            "text": "We expanded to 5 new countries this year.",
            "level": "passage",
            "heading_path": "Expansion > Markets",
            "start_char": 0,
            "end_char": 42,
        },
        {
            "chunk_id": "chunk-3",
            "text": "The new product launch was very successful.",
            "level": "passage",
            "heading_path": "Products > Launch",
            "start_char": 0,
            "end_char": 43,
        },
        {
            "chunk_id": "chunk-4",
            "text": "Revenue increased significantly in Q4.",
            "level": "passage",
            "heading_path": "Financial Results > Q4",
            "start_char": 0,
            "end_char": 40,
        },
        {
            "chunk_id": "chunk-5",
            "text": "The company hired 100 new employees.",
            "level": "passage",
            "heading_path": "Team > Hiring",
            "start_char": 0,
            "end_char": 38,
        },
    ]

    # Generate embeddings for test chunks
    from embeddings.service import HuggingFaceEmbedder

    embedder = HuggingFaceEmbedder()
    texts = [chunk["text"] for chunk in test_chunks]
    embeddings = embedder.embed(texts)

    await vector_store.add_chunks(
        document_id="test-doc-001",
        document_name="test_document.pdf",
        chunks=test_chunks,
        embeddings=embeddings,
    )
    logger.info(f"Added {len(test_chunks)} chunks")

    # 4. Search for "revenue growth"
    logger.info("4. Searching for 'revenue growth'...")
    search_embedding = embedder.embed(["revenue growth"])[0]
    results = await vector_store.search(
        query_embedding=search_embedding,
        limit=3,
    )

    logger.info("Search results:")
    for r in results:
        logger.info(
            f"  - Score: {r.score:.4f}, Text: {r.text[:50]}..., Doc: {r.document_name}"
        )

    # 5. Search with document filter
    logger.info("5. Searching with document filter...")
    results_filtered = await vector_store.search(
        query_embedding=search_embedding,
        limit=3,
        document_id="test-doc-001",
    )

    logger.info("Filtered results:")
    for r in results_filtered:
        logger.info(f"  - Score: {r.score:.4f}, Text: {r.text[:50]}...")

    # 6. Get updated collection info
    logger.info("6. Getting updated collection info...")
    info = await vector_store.get_collection_info()
    logger.info(f"Updated info: {info}")

    # 7. Clean up - delete test document
    logger.info("7. Cleaning up test data...")
    await vector_store.delete_document("test-doc-001")
    logger.info("Deleted test document")

    # Final check
    info = await vector_store.get_collection_info()
    logger.info(f"Final collection info: {info}")

    logger.info("✅ All Qdrant tests passed!")


if __name__ == "__main__":
    asyncio.run(test_qdrant())

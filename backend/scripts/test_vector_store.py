import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.service import HuggingFaceEmbedder
from app.vector_store import get_vector_store


async def main():
    print("Testing Vector Store...")

    # Test embedding
    embedder = HuggingFaceEmbedder()
    embeddings = embedder.embed(["hello world", "foo bar"])
    print(
        f"✓ Embeddings generated: {len(embeddings)} vectors, dim={len(embeddings[0])}"
    )

    # Test vector store
    store = get_vector_store()

    chunks = [
        {
            "chunk_id": "c1",
            "text": "Revenue grew 25% in 2024",
            "level": "passage",
            "heading_path": "Finance > Revenue",
        },
        {
            "chunk_id": "c2",
            "text": "Expanded to 5 new countries",
            "level": "passage",
            "heading_path": "Expansion > Markets",
        },
        {
            "chunk_id": "c3",
            "text": "New product launch successful",
            "level": "passage",
            "heading_path": "Products > Launch",
        },
    ]

    embeddings = embedder.embed([c["text"] for c in chunks])
    await store.ingest("doc-1", "report.pdf", chunks, embeddings)
    print(f"✓ Ingested {len(chunks)} chunks")

    # Search
    query_emb = embedder.embed(["revenue growth"])[0]
    results = await store.search(query_emb, limit=2)

    print(f"✓ Search returned {len(results)} results:")
    for r in results:
        print(f"    score={r.score:.3f} | {r.text[:40]}...")

    stats = await store.get_stats()
    print(f"✓ Stats: {stats}")

    print("\n✅ All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.service import HuggingFaceEmbedder


async def test_drift_detection():
    from app.services.drift_detection import (
        get_drift_service,
        SIMILARITY_THRESHOLD,
        DRIFT_THRESHOLD,
    )

    print(
        f"Testing Drift Detection (similarity >= {SIMILARITY_THRESHOLD}, drift < {DRIFT_THRESHOLD})..."
    )

    embedder = HuggingFaceEmbedder()
    drift_service = get_drift_service()

    # Existing chunks
    existing_chunks = [
        {
            "chunk_id": "e1",
            "text": "Revenue grew 25% in Q4 2024",
            "embedding": embedder.embed(["Revenue grew 25% in Q4 2024"])[0],
            "document_id": "doc-1",
            "document_name": "q4_report.pdf",
        },
        {
            "chunk_id": "e2",
            "text": "The company hired 100 new employees",
            "embedding": embedder.embed(["The company hired 100 new employees"])[0],
            "document_id": "doc-1",
            "document_name": "q4_report.pdf",
        },
    ]
    print(f"✓ Created {len(existing_chunks)} existing chunks")

    # Test 1: Duplicate detection (exact same text)
    print("\n--- Test 1: Duplicate detection (>=0.98) ---")
    new_chunks_dup = [
        {"chunk_id": "n1", "text": "Revenue grew 25% in Q4 2024"},  # Exact duplicate
    ]
    new_embeddings_dup = embedder.embed([c["text"] for c in new_chunks_dup])

    duplicates = drift_service.find_duplicates(
        [(c["chunk_id"], e) for c, e in zip(new_chunks_dup, new_embeddings_dup)],
        {c["chunk_id"]: c["embedding"] for c in existing_chunks},
    )
    print(f"  Duplicates: {len(duplicates)} - {duplicates}")

    # Test 2: New info (no conflict)
    print("\n--- Test 2: New info (no drift) ---")
    new_chunks_new = [
        {"chunk_id": "n2", "text": "The company opened a new office in Tokyo"},
    ]
    new_embeddings_new = embedder.embed([c["text"] for c in new_chunks_new])

    result_new = await drift_service.check_drift(
        new_chunks_new, new_embeddings_new, existing_chunks
    )
    print(
        f"  Conflicts: {result_new.has_conflicts}, Duplicates: {result_new.has_duplicates}"
    )

    # Test 3: Potential contradiction (negative similarity)
    print("\n--- Test 3: Potential contradiction (< -0.3) ---")
    new_chunks_contra = [
        {"chunk_id": "n3", "text": "Revenue declined 30% in Q4"},
    ]
    new_embeddings_contra = embedder.embed([c["text"] for c in new_chunks_contra])

    result_contra = await drift_service.check_drift(
        new_chunks_contra, new_embeddings_contra, existing_chunks
    )
    print(f"  Conflicts: {result_contra.has_conflicts}")
    if result_contra.conflicts:
        c = result_contra.conflicts[0]
        print(f"  → Similarity: {c['similarity']} (negative = opposite)")
        print(f"  → New: '{c['new_text']}'")
        print(f"  → Existing: '{c['existing_text']}'")

    print("\n✅ Tests complete!")


if __name__ == "__main__":
    asyncio.run(test_drift_detection())

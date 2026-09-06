import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.service import HuggingFaceEmbedder
from app.vector_store import get_vector_store


async def test_drift_detection():
    print("Testing Temporal Drift Detection...")

    embedder = HuggingFaceEmbedder()
    store = get_vector_store()

    # Existing knowledge: Company grew revenue
    existing_chunks = [
        {
            "chunk_id": "e1",
            "text": "Revenue grew 25% in Q4 2024",
            "level": "passage",
            "heading_path": "Finance > Q4",
        },
    ]
    existing_emb = embedder.embed([c["text"] for c in existing_chunks])
    await store.ingest("doc-existing", "q4_report.pdf", existing_chunks, existing_emb)
    print(f"✓ Indexed existing knowledge: '{existing_chunks[0]['text']}'")

    # Test 1: New document that agrees (positive similarity)
    print("\n--- Test 1: New info that agrees ---")
    new_agree = [
        {
            "chunk_id": "n1",
            "text": "Company had record profits this year",
            "level": "passage",
        }
    ]
    new_agree_emb = embedder.embed([c["text"] for c in new_agree])
    await store.ingest("doc-new-agree", "news_agree.pdf", new_agree, new_agree_emb)

    results = await store.search(new_agree_emb[0], limit=1, document_id="doc-existing")
    print(f"  New: '{new_agree[0]['text']}'")
    print(f"  Similarity with existing: {results[0].score:.3f}")
    print(f"  → Agreement detected (score > 0)")

    # Reset store for next test
    await store.delete_document("doc-new-agree")

    # Test 2: New document that contradicts (negative similarity)
    print("\n--- Test 2: New info that contradicts ---")
    new_contradict = [
        {
            "chunk_id": "n2",
            "text": "Revenue declined 30% this quarter",
            "level": "passage",
        }
    ]
    new_contradict_emb = embedder.embed([c["text"] for c in new_contradict])
    await store.ingest(
        "doc-new-contra", "news_contradict.pdf", new_contradict, new_contradict_emb
    )

    results = await store.search(
        new_contradict_emb[0], limit=1, document_id="doc-existing"
    )
    print(f"  New: '{new_contradict[0]['text']}'")
    print(f"  Similarity with existing: {results[0].score:.3f}")
    if results[0].score < 0:
        print(f"  → CONTRADICTION detected (negative similarity)")
    else:
        print(f"  → No contradiction")

    # Test 3: Drift detection function
    print("\n--- Test 3: Drift Detection Function ---")

    async def detect_temporal_drift(
        store, new_texts: list[str], threshold: float = -0.1
    ) -> dict:
        """Check if new content contradicts existing knowledge."""
        new_embeddings = embedder.embed(new_texts)

        contradictions = []
        agreements = []

        for i, new_emb in enumerate(new_embeddings):
            results = await store.search(new_emb, limit=3)
            for r in results:
                if r.score < threshold:
                    contradictions.append(
                        {
                            "new_text": new_texts[i],
                            "existing_text": r.text,
                            "similarity": r.score,
                            "document": r.document_name,
                        }
                    )
                elif r.score > 0.5:
                    agreements.append(
                        {
                            "new_text": new_texts[i],
                            "existing_text": r.text,
                            "similarity": r.score,
                            "document": r.document_name,
                        }
                    )

        return {
            "has_contradiction": len(contradictions) > 0,
            "contradictions": contradictions,
            "agreements": agreements,
            "status": "CONTRADICTION"
            if contradictions
            else ("CONFIRMED" if agreements else "NEW"),
        }

    # Test drift detection
    drift_result = await detect_temporal_drift(
        store,
        [
            "Revenue declined significantly this year",
            "The company is doing great and expanding",
        ],
    )

    print(f"  Drift detection result: {drift_result['status']}")
    print(f"  Has contradiction: {drift_result['has_contradiction']}")
    if drift_result["contradictions"]:
        print(f"  Contradictions found: {len(drift_result['contradictions'])}")
        for c in drift_result["contradictions"]:
            print(
                f"    - '{c['new_text']}' vs '{c['existing_text'][:40]}...' (score: {c['similarity']:.3f})"
            )

    print("\n✅ Drift detection test complete!")


if __name__ == "__main__":
    asyncio.run(test_drift_detection())

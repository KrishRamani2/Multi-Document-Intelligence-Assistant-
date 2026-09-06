#!/usr/bin/env python3
"""
Quick RAG Benchmark Runner
========================

Usage:
    python -m evals.run                    # Run all modes, 100 queries
    python -m evals.run --mode basic      # Run specific mode
    python -m evals.run --queries 50    # Run 50 queries
    python -m evals.run --topk 5       # Top 5 results

Examples:
    cd backend && python -m evals.run --mode basic --queries 10
    cd backend && python -m evals.run --modes basic hybrid --topk 10
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def parse_args():
    parser = argparse.ArgumentParser(description="RAG Benchmark Runner")

    parser.add_argument(
        "--modes",
        nargs="+",
        default=["basic", "hybrid", "multi_query", "multi_vector"],
        help="Retrieval modes to benchmark",
    )
    parser.add_argument("--topk", type=int, default=10, help="Top K results")
    parser.add_argument(
        "--queries", type=int, default=100, help="Number of test queries"
    )
    parser.add_argument(
        "--embedder",
        default="openai",
        choices=["openai", "huggingface", "gemini"],
        help="Embedder to use",
    )
    parser.add_argument("--output", type=str, default=None, help="Output file path")

    return parser.parse_args()


async def main():
    args = parse_args()

    print("=" * 60)
    print("RAG Benchmark")
    print("=" * 60)
    print(f"Modes: {args.modes}")
    print(f"Top-K: {args.topk}")
    print(f"Queries: {args.queries}")
    print(f"Embedder: {args.embedder}")
    print()

    from evals.config import TEST_QUERIES
    from evals.benchmark import RAGBenchmark, save_results, print_summary

    from app.vector_store.qdrant_store import get_vector_store
    from embeddings.service import (
        OpenAIEmbedder,
        HuggingFaceEmbedder,
        GeminiEmbedder,
    )
    from app.retrieval.unified_retriever import UnifiedRetriever

    print("Initializing...")

    emb_map = {
        "openai": OpenAIEmbedder,
        "huggingface": HuggingFaceEmbedder,
        "gemini": GeminiEmbedder,
    }

    embedder_cls = emb_map.get(args.embedder, OpenAIEmbedder)
    embedder = embedder_cls()

    vector_store = get_vector_store()
    retriever = UnifiedRetriever(
        vector_store=vector_store,
        embedder=embedder,
        use_bm25=False,
    )

    print("✓ Ready")
    print()

    benchmark = RAGBenchmark(
        retriever=retriever,
        test_queries=TEST_QUERIES,
        embedder=args.embedder,
    )

    results = await benchmark.run_benchmark(
        modes=args.modes,
        top_k_values=[args.topk],
        num_queries=args.queries,
    )

    print_summary(results)

    output_path = args.output or Path(__file__).parent / "results.json"
    save_results(results, str(output_path))

    print("\n✓ Done!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())

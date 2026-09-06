"""
RAG Evaluation Suite
====================

Quick Start:
    cd backend && python -m evals.run --help

Or use the API:
    from evals import run_benchmark
    results = run_benchmark()
"""

import os

TEST_QUERIES = None
BENCHMARK_CONFIG = None


def _lazy_load():
    global TEST_QUERIES, BENCHMARK_CONFIG
    if TEST_QUERIES is None:
        from evals.config import TEST_QUERIES as TQ, BENCHMARK_CONFIG as BC

        TEST_QUERIES = TQ
        BENCHMARK_CONFIG = BC


def run_benchmark(
    modes=None,
    top_k=10,
    num_queries=100,
    embedder="openai",
):
    """
    Run RAG benchmark with default configuration.

    Args:
        modes: List of retrieval modes (default: all)
        top_k: Top K results (default: 10)
        num_queries: Number of queries (default: 100)
        embedder: Embedder to use (default: openai)

    Returns:
        List of benchmark results
    """
    import asyncio

    from evals.benchmark import RAGBenchmark, print_summary, save_results
    from app.vector_store.qdrant_store import get_vector_store
    from embeddings.service import (
        OpenAIEmbedder,
        HuggingFaceEmbedder,
        GeminiEmbedder,
    )
    from app.retrieval.unified_retriever import UnifiedRetriever

    _lazy_load()

    if modes is None:
        modes = ["basic", "hybrid", "multi_query", "multi_vector"]

    async def _run():
        emb_map = {
            "openai": OpenAIEmbedder,
            "huggingface": HuggingFaceEmbedder,
            "gemini": GeminiEmbedder,
        }

        embedder_cls = emb_map.get(embedder, OpenAIEmbedder)

        try:
            embedder = embedder_cls()
        except Exception as e:
            print(f"Failed to load {embedder}: {e}, falling back to OpenAI")
            embedder = OpenAIEmbedder()

        vector_store = get_vector_store()
        retriever = UnifiedRetriever(
            vector_store=vector_store,
            embedder=embedder,
            use_bm25=False,
        )

        benchmark = RAGBenchmark(
            retriever=retriever,
            test_queries=TEST_QUERIES,
            embedder=embedder,
        )

        return await benchmark.run_benchmark(
            modes=modes,
            top_k_values=[top_k],
            num_queries=num_queries,
        )

    results = asyncio.run(_run())
    return results


__all__ = ["run_benchmark"]

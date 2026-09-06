#!/usr/bin/env python3
"""
RAG Benchmark Script using RAGAS
Run: python -m evals.benchmark
"""

import os
import sys
import json
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()


@dataclass
class BenchmarkResult:
    mode: str
    embedder: str
    top_k: int
    num_queries: int

    # Latency metrics (ms)
    avg_retrieval_time_ms: float
    avg_embedding_time_ms: float
    avg_search_time_ms: float
    p50_retrieval_ms: float
    p95_retrieval_ms: float
    p99_retrieval_ms: float

    # Retrieval metrics
    avg_precision_at_k: float
    avg_recall_at_k: float
    mrr: float
    ndcg: float

    # RAGAS metrics (if available)
    ragas_faithfulness: float = 0.0
    ragas_answer_relevance: float = 0.0
    ragas_context_precision: float = 0.0
    ragas_context_recall: float = 0.0

    # Timing
    total_time_seconds: float = 0.0


class RAGBenchmark:
    """
    RAG Benchmark using RAGAS metrics
    """

    def __init__(
        self,
        retriever,
        test_queries: List[Dict],
        embedder="openai",
    ):
        self.retriever = retriever
        self.test_queries = test_queries
        self.embedder = embedder
        self._ragas_available = False
        self._llm = None

        self._check_ragas()

    def _check_ragas(self):
        """Check if RAGAS is available."""
        try:
            import ragas

            self._ragas_available = True
            print("✓ RAGAS available")
        except ImportError:
            print("⚠ RAGAS not installed. Run: pip install ragas")
            print("  Will use custom metrics instead.")

    def _init_llm(self):
        """Initialize LLM for generation."""
        if self._llm is None:
            try:
                from langchain_openai import ChatOpenAI

                self._llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
            except ImportError:
                try:
                    from langchain_community.chat_models import ChatOpenAI

                    self._llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
                except Exception as e:
                    print(f"⚠ Could not initialize LLM: {e}")

    async def run_benchmark(
        self,
        modes: List[str] = ["basic"],
        top_k_values: List[int] = [5, 10, 20],
        num_queries: int = 100,
    ) -> List[BenchmarkResult]:
        """
        Run benchmark for all configurations.
        """
        queries = self.test_queries[:num_queries]
        results = []

        for mode in modes:
            for top_k in top_k_values:
                print(f"\n{'=' * 60}")
                print(f"Running: mode={mode}, top_k={top_k}, queries={len(queries)}")
                print(f"{'=' * 60}")

                start_time = time.time()
                mode_result = await self._run_single_benchmark(queries, mode, top_k)
                mode_result.total_time_seconds = time.time() - start_time

                results.append(mode_result)

        return results

    async def _run_single_benchmark(
        self,
        queries: List[Dict],
        mode: str,
        top_k: int,
    ) -> BenchmarkResult:
        """Run benchmark for a single configuration."""
        retrieval_times = []
        embedding_times = []
        search_times = []

        precisions = []
        recalls = []
        mrrs = []
        ndcgs = []

        ragas_scores = {
            "faithfulness": [],
            "answer_relevancy": [],
            "context_precision": [],
            "context_recall": [],
        }

        for i, query_data in enumerate(queries):
            if i % 10 == 0:
                print(f"  Progress: {i}/{len(queries)}")

            query = query_data["question"]
            ground_truth = query_data.get("ground_truth_docs", [])

            try:
                output = await self.retriever.retrieve(
                    query=query,
                    mode=mode,
                    top_k=top_k,
                )

                metrics = output.get("metrics")
                if metrics:
                    retrieval_times.append(metrics.retrieval_time_ms)
                    embedding_times.append(metrics.embedding_time_ms)
                    search_times.append(metrics.search_time_ms)

                results = output.get("results", [])

                precision, recall = self._calculate_precision_recall(
                    results, ground_truth, top_k
                )
                precisions.append(precision)
                recalls.append(recall)
                mrrs.append(self._calculate_mrr(results, ground_truth))
                ndcgs.append(self._calculate_ndcg(results, ground_truth, top_k))

                if self._ragas_available and i < 5:
                    try:
                        ragas_result = await self._run_ragas_eval(
                            query, results, query_data.get("answer", "")
                        )
                        for key, value in ragas_result.items():
                            ragas_scores[key].append(value)
                    except Exception as e:
                        pass

            except Exception as e:
                print(f"  Error on query {i}: {e}")
                continue

        p_times = sorted(retrieval_times)

        result = BenchmarkResult(
            mode=mode,
            embedder=self.embedder,
            top_k=top_k,
            num_queries=len(queries),
            avg_retrieval_time_ms=sum(retrieval_times) / len(retrieval_times)
            if retrieval_times
            else 0,
            avg_embedding_time_ms=sum(embedding_times) / len(embedding_times)
            if embedding_times
            else 0,
            avg_search_time_ms=sum(search_times) / len(search_times)
            if search_times
            else 0,
            p50_retrieval_ms=p_times[len(p_times) // 2] if p_times else 0,
            p95_retrieval_ms=p_times[int(len(p_times) * 0.95)] if p_times else 0,
            p99_retrieval_ms=p_times[int(len(p_times) * 0.99)] if p_times else 0,
            avg_precision_at_k=sum(precisions) / len(precisions) if precisions else 0,
            avg_recall_at_k=sum(recalls) / len(recalls) if recalls else 0,
            mrr=sum(mrrs) / len(mrrs) if mrrs else 0,
            ndcg=sum(ndcgs) / len(ndcgs) if ndcgs else 0,
            ragas_faithfulness=sum(ragas_scores["faithfulness"])
            / len(ragas_scores["faithfulness"])
            if ragas_scores["faithfulness"]
            else 0,
            ragas_answer_relevance=sum(ragas_scores["answer_relevancy"])
            / len(ragas_scores["answer_relevancy"])
            if ragas_scores["answer_relevancy"]
            else 0,
            ragas_context_precision=sum(ragas_scores["context_precision"])
            / len(ragas_scores["context_precision"])
            if ragas_scores["context_precision"]
            else 0,
            ragas_context_recall=sum(ragas_scores["context_recall"])
            / len(ragas_scores["context_recall"])
            if ragas_scores["context_recall"]
            else 0,
        )

        print(
            f"  Results: P@K={result.avg_precision_at_k:.3f}, R@K={result.avg_recall_at_k:.3f}"
        )
        print(
            f"  Latency: avg={result.avg_retrieval_time_ms:.1f}ms, p50={result.p50_retrieval_ms:.1f}ms"
        )

        if result.ragas_faithfulness > 0:
            print(
                f"  RAGAS: faithfulness={result.ragas_faithfulness:.3f}, answer_relevance={result.ragas_answer_relevance:.3f}"
            )

        return result

    def _calculate_precision_recall(
        self,
        results: List,
        ground_truth: List,
        k: int,
    ) -> tuple:
        """Calculate precision and recall at k."""
        if not ground_truth:
            return 0.0, 0.0

        retrieved = set(r.chunk_id for r in results[:k])
        relevant = set(ground_truth)

        true_positives = len(retrieved & relevant)

        precision = true_positives / k if k > 0 else 0
        recall = true_positives / len(relevant) if relevant else 0

        return precision, recall

    def _calculate_mrr(self, results: List, ground_truth: List) -> float:
        """Calculate Mean Reciprocal Rank."""
        if not ground_truth:
            return 0.0

        relevant_set = set(ground_truth)

        for i, r in enumerate(results):
            if r.chunk_id in relevant_set:
                return 1.0 / (i + 1)

        return 0.0

    def _calculate_ndcg(
        self,
        results: List,
        ground_truth: List,
        k: int,
    ) -> float:
        """Calculate NDCG at k."""
        if not ground_truth:
            return 0.0

        relevant_set = set(ground_truth)

        dcg = 0.0
        for i, r in enumerate(results[:k]):
            if r.chunk_id in relevant_set:
                dcg += 1.0 / (i + 1)

        idcg = sum(1.0 / (i + 1) for i in range(min(k, len(relevant_set))))

        return dcg / idcg if idcg > 0 else 0.0

    async def _run_ragas_eval(
        self,
        query: str,
        results: List,
        answer: str,
    ) -> Dict[str, float]:
        """Run RAGAS evaluation (if available)."""
        if not self._ragas_available:
            return {
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "context_precision": 0.0,
                "context_recall": 0.0,
            }

        try:
            from ragas import evaluate
            from ragas.metrics import (
                faithfulness,
                answer_relevancy,
                context_precision,
                context_recall,
            )
            from datasets import Dataset

            contexts = [r.text for r in results]

            dataset = Dataset.from_list(
                [
                    {
                        "question": query,
                        "answer": answer,
                        "contexts": contexts,
                    }
                ]
            )

            eval_result = evaluate(
                dataset,
                metrics=[
                    faithfulness,
                    answer_relevancy,
                    context_precision,
                    context_recall,
                ],
            )

            return {
                "faithfulness": eval_result["faithfulness"],
                "answer_relevancy": eval_result["answer_relevancy"],
                "context_precision": eval_result["context_precision"],
                "context_recall": eval_result["context_recall"],
            }
        except Exception as e:
            print(f"  RAGAS error: {e}")
            return {
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "context_precision": 0.0,
                "context_recall": 0.0,
            }


def save_results(results: List[BenchmarkResult], output_path: str):
    """Save results to JSON."""
    output_data = {
        "timestamp": datetime.now().isoformat(),
        "results": [asdict(r) for r in results],
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"\n✓ Results saved to: {output_path}")


def print_summary(results: List[BenchmarkResult]):
    """Print benchmark summary."""
    print("\n" + "=" * 80)
    print("BENCHMARK SUMMARY")
    print("=" * 80)

    print(
        f"\n{'Mode':<15} {'TopK':<6} {'P@K':<8} {'R@K':<8} {'MRR':<8} {'NDCG':<8} {'Avg Latency':<12}"
    )
    print("-" * 80)

    for r in results:
        print(
            f"{r.mode:<15} {r.top_k:<6} {r.avg_precision_at_k:.3f}   {r.avg_recall_at_k:.3f}   {r.mrr:.3f}   {r.ndcg:.3f}   {r.avg_retrieval_time_ms:.1f}ms"
        )

    if any(r.ragas_faithfulness > 0 for r in results):
        print("\nRAGAS Metrics:")
        print(
            f"{'Mode':<15} {'Faithfulness':<15} {'Answer Relev.':<15} {'Context Prec.':<15}"
        )
        print("-" * 60)
        for r in results:
            if r.ragas_faithfulness > 0:
                print(
                    f"{r.mode:<15} {r.ragas_faithfulness:.3f}          {r.ragas_answer_relevance:.3f}          {r.ragas_context_precision:.3f}"
                )


async def main():
    """Main entry point."""
    print("=" * 60)
    print("RAG Benchmark - 100 Queries")
    print("=" * 60)

    from evals.config import TEST_QUERIES

    from app.vector_store.qdrant_store import get_vector_store
    from embeddings.service import OpenAIEmbedder
    from app.retrieval.unified_retriever import UnifiedRetriever

    print("\nInitializing components...")

    vector_store = get_vector_store()
    embedder = OpenAIEmbedder()
    retriever = UnifiedRetriever(
        vector_store=vector_store,
        embedder=embedder,
        use_bm25=False,
        use_cross_encoder=False,
    )

    print("✓ Components initialized")

    benchmark = RAGBenchmark(
        retriever=retriever,
        test_queries=TEST_QUERIES,
        embedder="openai",
    )

    modes = ["basic", "hybrid", "multi_query", "multi_vector"]
    top_k_values = [5, 10, 20]

    print(f"\nRunning benchmark: {len(TEST_QUERIES)} queries")
    print(f"Modes: {modes}")
    print(f"Top-K: {top_k_values}")

    results = await benchmark.run_benchmark(
        modes=modes,
        top_k_values=top_k_values,
        num_queries=100,
    )

    print_summary(results)

    output_path = Path(__file__).parent / "results.json"
    save_results(results, str(output_path))

    print("\n✓ Benchmark complete!")


if __name__ == "__main__":
    asyncio.run(main())

"""
Parallel Processor - concurrent ingestion stages
"""

import asyncio
from typing import List, Callable, Any
from dataclasses import dataclass
from loguru import logger


@dataclass
class ProcessingStage:
    """A processing stage that can run async."""

    name: str
    func: Callable
    done: bool = False
    error: str = None
    result: Any = None


class ParallelProcessor:
    """Run multiple processing stages in parallel or cascade."""

    @staticmethod
    async def run_parallel(*stages: ProcessingStage) -> List[ProcessingStage]:
        """Run all stages in parallel (for independent stages)."""
        logger.info(f"Running {len(stages)} stages in parallel...")

        async def run_stage(stage: ProcessingStage):
            try:
                stage.result = await stage.func()
                stage.done = True
            except Exception as e:
                stage.error = str(e)
                logger.error(f"Stage {stage.name} failed: {e}")
            return stage

        results = await asyncio.gather(
            *[run_stage(s) for s in stages], return_exceptions=True
        )
        return list(results)

    @staticmethod
    async def run_cascade(stages: List[ProcessingStage]) -> List[ProcessingStage]:
        """Run stages in sequence (each depends on previous)."""
        logger.info(f"Running {len(stages)} stages in cascade...")

        for stage in stages:
            if not stage.done:
                try:
                    logger.info(f"Running stage: {stage.name}")
                    stage.result = await stage.func()
                    stage.done = True
                except Exception as e:
                    stage.error = str(e)
                    logger.error(f"Stage {stage.name} failed: {e}")
                    break

        return stages


class BatchProcessor:
    """Process items in parallel batches."""

    @staticmethod
    async def process_items(
        items: List[Any],
        process_func: Callable,
        batch_size: int = 32,
        max_concurrent: int = 4,
    ) -> List[Any]:
        """Process items in parallel batches."""
        results = []

        # Create batches
        batches = [items[i : i + batch_size] for i in range(0, len(items), batch_size)]

        logger.info(f"Processing {len(items)} items in {len(batches)} batches...")

        # Process batches with concurrency limit
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_batch(batch, idx):
            async with semaphore:
                logger.info(f"Processing batch {idx + 1}/{len(batches)}")
                return await process_func(batch)

        # Run all batches
        batch_results = await asyncio.gather(
            *[process_batch(b, i) for i, b in enumerate(batches)]
        )

        # Flatten results
        for br in batch_results:
            if isinstance(br, list):
                results.extend(br)
            else:
                results.append(br)

        return results


class ChunkProcessor:
    """Process chunks in parallel."""

    def __init__(self, embedder):
        self.embedder = embedder

    async def embed_chunks_parallel(
        self,
        chunks: List[dict],
        batch_size: int = 64,
    ) -> List[dict]:
        """Embed chunks in parallel."""
        if not chunks:
            return chunks

        texts = [c.get("text", "") for c in chunks]

        # sentence-transformers handles batching internally with GPU
        # Just pass all texts at once for optimal GPU utilization
        embeddings = self.embedder.embed(texts)

        # Add embeddings to chunks
        for chunk, emb in zip(chunks, embeddings):
            chunk["embedding"] = emb

        return chunks

    async def embed_by_type_parallel(
        self,
        section_chunks: List[dict] = None,
        passage_chunks: List[dict] = None,
        sentence_chunks: List[dict] = None,
    ) -> dict:
        """Embed different chunk types in parallel."""
        tasks = []

        if section_chunks:

            async def embed_sections():
                return await self.embed_chunks_parallel(section_chunks)

            tasks.append(("sections", embed_sections()))

        if passage_chunks:

            async def embed_passages():
                return await self.embed_chunks_parallel(passage_chunks)

            tasks.append(("passages", embed_passages()))

        if sentence_chunks:

            async def embed_sentences():
                return await self.embed_chunks_parallel(sentence_chunks)

            tasks.append(("sentences", embed_sentences()))

        # Run all in parallel
        results = await asyncio.gather(*[t[1] for t in tasks])

        return {tasks[i][0]: r for i, r in enumerate(results)}

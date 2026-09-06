"""
Embedding Service - Generate embeddings for chunks
"""

import os
import json
import uuid
from typing import List, Optional
from pathlib import Path
from dataclasses import dataclass, asdict

from dotenv import load_dotenv

load_dotenv()


@dataclass
class EmbeddingResult:
    document_id: str
    chunks_count: int
    provider: str
    model: str
    dimensions: int
    embeddings_file: str


class EmbeddingProvider:
    """Base class for embedding providers."""

    def embed(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

    @property
    def model(self) -> str:
        raise NotImplementedError

    @property
    def dimensions(self) -> int:
        raise NotImplementedError


class OpenAIEmbedder:
    """OpenAI text-embedding-3-small with dimension reduction (256, 512, 768, 1024, 1536)"""

    def __init__(self, api_key: Optional[str] = None, dimensions: int = 1536):
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self._dimensions = dimensions
        self.batch_size = 32

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        response = self.client.embeddings.create(
            model="text-embedding-3-small", dimensions=self._dimensions, input=texts
        )
        return [item.embedding for item in response.data]

    @property
    def model(self) -> str:
        return "text-embedding-3-small"

    @property
    def dimensions(self) -> int:
        return self._dimensions


class HuggingFaceEmbedder:
    """HuggingFace sentence-transformers with parallel batch processing"""

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        batch_size: int = 32,
    ):
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)
        self.batch_size = batch_size

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Batch encode with GPU if available."""
        if not texts:
            return []
        # sentence-transformers already uses batch processing internally
        return self._model.encode(
            texts, batch_size=self.batch_size, convert_to_numpy=True
        ).tolist()

    def embed_parallel(
        self, texts: List[str], max_workers: int = 4
    ) -> List[List[float]]:
        """Parallel embedding using ThreadPoolExecutor for I/O-bound."""
        if not texts:
            return []

        import concurrent.futures

        # Split into batches
        batches = [
            texts[i : i + self.batch_size]
            for i in range(0, len(texts), self.batch_size)
        ]

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = list(executor.map(self._model.encode, batches))
            for batch_result in futures:
                results.extend(batch_result.tolist())

        return results

    @property
    def model(self) -> str:
        return "sentence-transformers/all-MiniLM-L6-v2"

    @property
    def dimensions(self) -> int:
        return 384


class GeminiEmbedder:
    """Gemini text-embedding-001 (3072 dimensions)"""

    def __init__(self, api_key: Optional[str] = None):
        from dotenv import load_dotenv

        load_dotenv()

        import google.genai as genai

        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        self.client = genai.Client(api_key=key)
        self._embedding_model = "gemini-embedding-001"

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        try:
            result = self.client.models.embed_content(
                model=self._embedding_model,
                contents=texts,
            )
            # result.embeddings is a list of ContentEmbedding
            # Each has .values which is a list of floats
            embeddings = []
            for item in result.embeddings:
                if hasattr(item, "values"):
                    embeddings.append(item.values)
                else:
                    embeddings.append([])
            return embeddings
        except Exception as e:
            # Fallback to individual
            embeddings = []
            for text in texts:
                result = self.client.models.embed_content(
                    model=self._embedding_model,
                    contents=text,
                )
                if hasattr(result, "embeddings") and result.embeddings:
                    item = result.embeddings[0]
                    if hasattr(item, "values"):
                        embeddings.append(item.values)
                    else:
                        embeddings.append([])
                else:
                    embeddings.append([])
            return embeddings

    @property
    def model(self) -> str:
        return "gemini-embedding-001"

    @property
    def dimensions(self) -> int:
        return 3072


class EmbeddingService:
    """Unified embedding service"""

    PROVIDERS = {
        "openai": OpenAIEmbedder,
        "huggingface": HuggingFaceEmbedder,
        "gemini": GeminiEmbedder,
    }

    def __init__(self, provider: str = "openai"):
        if provider not in self.PROVIDERS:
            raise ValueError(
                f"Provider {provider} not supported. Use: {list(self.PROVIDERS.keys())}"
            )
        self.embedder = self.PROVIDERS[provider]()
        self.provider = provider

    def generate_embeddings(
        self,
        document,
        output_dir: str = "embeddings",
    ) -> EmbeddingResult:
        """Generate embeddings for all chunks in a document."""

        # Get all passage chunks
        chunks = document.passage_chunks or document.section_chunks or []

        if not chunks:
            raise ValueError("No chunks found in document")

        # Extract texts
        texts = [chunk.text for chunk in chunks]

        # Generate embeddings
        embeddings = self.embedder.embed(texts)

        # Create embeddings data
        embeddings_data = {
            "document_id": document.document_id,
            "source_type": document.source_type.value,
            "source_name": document.source_name,
            "provider": self.provider,
            "model": self.embedder.model,
            "dimensions": self.embedder.dimensions,
            "chunks": [
                {
                    "chunk_id": chunk.chunk_id,
                    "text": chunk.text,
                    "level": chunk.level.value,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "heading_path": chunk.heading_path,
                    "embedding": emb,
                }
                for chunk, emb in zip(chunks, embeddings)
            ],
        }

        # Save to file
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{document.document_id}.json"
        filepath = os.path.join(output_dir, filename)

        with open(filepath, "w") as f:
            json.dump(embeddings_data, f, indent=2)

        # Also assign embeddings back to the document's chunks
        chunks = document.passage_chunks or document.section_chunks or []
        for chunk, emb in zip(chunks, embeddings):
            if emb:
                chunk.embedding = emb

        # Generate CDN link (simulated for now)
        cdn_base = os.getenv("CDN_BASE", "http://localhost:8000/files")
        cdn_link = f"{cdn_base}/{filename}"

        return EmbeddingResult(
            document_id=document.document_id,
            chunks_count=len(chunks),
            provider=self.provider,
            model=self.embedder.model,
            dimensions=self.embedder.dimensions,
            embeddings_file=cdn_link,
        )


def embed_document(
    source_path: str,
    source_type: str = None,
    provider: str = "openai",
    time_chunk_seconds: int = 0,
) -> EmbeddingResult:
    """
    Convenience function to extract, chunk, and embed a document.
    """
    from ingestion import ExtractorFactory, HierarchicalChunker
    from ingestion.models import SourceType
    import ingestion.extractors

    # Detect or use specified type
    if source_type:
        source_type = SourceType(source_type)
    else:
        source_type = ExtractorFactory.detect_type(source_path)
        if not source_type:
            raise ValueError(f"Could not detect source type for: {source_path}")

    # Extract
    extractor = ExtractorFactory.get_extractor(source_type)
    document = extractor.extract(source_path)

    # Chunk
    chunker = HierarchicalChunker(
        time_chunk_seconds=time_chunk_seconds if time_chunk_seconds > 0 else 0
    )
    document = chunker.chunk_document(document)

    # Embed
    service = EmbeddingService(provider=provider)
    result = service.generate_embeddings(document)

    return result

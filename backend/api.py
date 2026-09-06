"""
Embedding API - FastAPI endpoint for generating embeddings
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from embeddings.service import EmbeddingService
from ingestion import ExtractorFactory, HierarchicalChunker

load_dotenv()

app = FastAPI(title="Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    source: str
    source_type: Optional[str] = None
    provider: str = "openai"  # openai, huggingface, gemini
    time_chunk_seconds: int = 0


class EmbedResponse(BaseModel):
    document_id: str
    chunks_count: int
    provider: str
    model: str
    dimensions: int
    embeddings_file: str


@app.get("/")
def root():
    return {"message": "Embedding Service API", "version": "1.0.0"}


@app.get("/providers")
def list_providers():
    return {
        "providers": [
            {"name": "openai", "model": "text-embedding-3-small", "dimensions": 1536},
            {
                "name": "huggingface",
                "model": "sentence-transformers/all-MiniLM-L6-v2",
                "dimensions": 384,
            },
            {"name": "gemini", "model": "gemini-embedding-001", "dimensions": 768},
        ]
    }


@app.post("/embed", response_model=EmbedResponse)
def embed_document(req: EmbedRequest):
    """Extract, chunk, and embed a document."""

    try:
        # Detect source type
        from ingestion.models import SourceType

        if req.source_type:
            source_type = SourceType(req.source_type)
        else:
            source_type = ExtractorFactory.detect_type(req.source)
            if not source_type:
                raise HTTPException(
                    status_code=400, detail="Could not detect source type"
                )

        # Extract
        extractor = ExtractorFactory.get_extractor(source_type)
        document = extractor.extract(req.source)

        # Chunk
        chunker = HierarchicalChunker(
            time_chunk_seconds=req.time_chunk_seconds
            if req.time_chunk_seconds > 0
            else 0
        )
        document = chunker.chunk_document(document)

        # Embed
        service = EmbeddingService(provider=req.provider)
        result = service.generate_embeddings(document)

        return EmbedResponse(
            document_id=result.document_id,
            chunks_count=result.chunks_count,
            provider=result.provider,
            model=result.model,
            dimensions=result.dimensions,
            embeddings_file=result.embeddings_file,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/embeddings/{document_id}")
def get_embeddings(document_id: str):
    """Get embeddings for a document by ID."""
    import json

    filepath = f"embeddings/{document_id}.json"

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Embeddings not found")

    with open(filepath, "r") as f:
        data = json.load(f)

    # Return without full embeddings to save bandwidth
    return {
        "document_id": data["document_id"],
        "source_name": data["source_name"],
        "chunks_count": len(data["chunks"]),
        "embedding_dimension": data["dimensions"],
    }


@app.get("/files/{filename}")
def download_file(filename: str):
    """Download embeddings file."""
    from fastapi.responses import FileResponse

    filepath = f"embeddings/{filename}"

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, media_type="application/json", filename=filename)


if __name__ == "__main__":
    # Create embeddings directory
    os.makedirs("embeddings", exist_ok=True)

    # Run server
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

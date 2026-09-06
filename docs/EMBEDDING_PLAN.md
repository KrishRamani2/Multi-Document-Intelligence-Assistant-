# Embedding Service Implementation Plan

## Overview
Create an embedding service that supports multiple embedding providers with a unified API.

## Supported Embeddings

| Provider | Model | Dimensions | Use Case |
|----------|-------|------------|----------|
| OpenAI | text-embedding-3-small | 1536 | Primary - fast, high quality |
| HuggingFace | sentence-transformers/all-MiniLM-L6-v2 | 384 | Free alternative |
| Gemini | embedding-001 | 768 | Free, good quality |

## Architecture

```
Request: Extract + Chunk Document
    ↓
Embedding Service
    ├─ OpenAI Embedder
    ├─ HuggingFace Embedder
    └─ Gemini Embedder
    ↓
Response: CDN Link to download JSON file with embeddings
```

## API Design

### POST /embed
```json
{
  "source_type": "pdf",
  "source": "path/to/file.pdf",
  "provider": "openai",  // or "huggingface", "gemini"
  "chunk_options": {
    "type": "hierarchical",  // or "recursive", "time_based"
    "time_chunk_seconds": 10  // for audio/video
  }
}
```

### Response
```json
{
  "document_id": "uuid",
  "chunks_count": 50,
  "embeddings_file": "https://cdn.example.com/embeddings/uuid.json",
  "provider": "openai",
  "model": "text-embedding-3-small",
  "dimensions": 1536
}
```

## Embeddings JSON Structure

```json
{
  "document_id": "uuid",
  "provider": "openai",
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "chunks": [
    {
      "chunk_id": "uuid",
      "text": "chunk content...",
      "level": "passage",
      "start_char": 0,
      "end_char": 100,
      "embedding": [0.123, -0.456, ...]  // 1536 dims
    }
  ]
}
```

## Implementation Steps

1. Create `embeddings/service.py` - main embedding service
2. Create `embeddings/providers/` - OpenAI, HuggingFace, Gemini
3. Create `embeddings/storage.py` - file storage + CDN links
4. Create FastAPI endpoint

## Next: Implement?
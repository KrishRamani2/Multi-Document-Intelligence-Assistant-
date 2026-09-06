# Multi-Document Intelligence API

## Setup

### 1. Start Local Services (Docker)

```bash
# Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:7.0

# Start Qdrant vector database
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:v1.7.4

# Check status
docker ps
```

### 2. Start the API Server

```bash
cd backend
uv run python -m app.main
```

Server runs at `http://localhost:8000`

---

## API Endpoints

### Ingest a document

```bash
POST /ingest
{
  "source_type": "pdf",
  "file_url": "https://5kcn84nzfr.ucarecd.net/<uuid>/"
}
```

**source_type options:** `pdf`, `html`, `youtube`, `audio`, `image`, `csv`, `json`, `md`

### Check job status

```bash
GET /ingest/{job_id}
```

### Get document chunks

```bash
# Hierarchical (semantic) chunks
GET /documents/{document_id}/hierarchical?chunk_type=passages

# Recursive (character-based) chunks
GET /documents/{document_id}/recursive

# All chunks
GET /documents/{document_id}/chunks
```

### Get document by file hash

```bash
GET /documents/by-hash/{file_hash}
```

### Semantic Search

```bash
POST /search
{
  "query": "What is the annual revenue?",
  "document_id": "optional-filter-doc-id",
  "limit": 5
}
```

### List documents

```bash
GET /documents
```

---

## Environment Variables

Create `.env` file:

```env
# API Keys
ASSEMBLYAI_API_KEY=your_key
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key

# Local MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=clutch_db

# Qdrant Vector DB
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

---

## Stopping Everything

```bash
# Stop API server
lsof -ti:8000 | xargs -r kill -9

# Stop Docker services
docker stop mongodb qdrant && docker rm mongodb qdrant
```

---

## Quick Start

```bash
# 1. Start services
docker run -d --name mongodb -p 27017:27017 mongo:7.0
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:v1.7.4

# 2. Start server
cd backend && uv run python -m app.main

# 3. Ingest a document
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"source_type":"pdf","file_url":"https://5kcn84nzfr.ucarecd.net/<uuid>/"}'

# 4. Check job status (wait a few seconds)
curl http://localhost:8000/ingest/{job_id}

# 5. Search
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"your search query","limit":5}'
```
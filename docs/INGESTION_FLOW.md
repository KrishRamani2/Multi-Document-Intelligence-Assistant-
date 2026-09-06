# Ingestion API Flow

## Overview

```
User Request → Job Created → Background Processing → Document Stored → Searchable
```

---

## 1. Start Ingestion

```bash
POST /ingest
{
  "source_type": "pdf" | "youtube" | "html" | "audio" | "csv" | "json" | "md" | "text",
  "file_url": "https://..."
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Ingestion job started..."
}
```

---

## 2. Check Job Status

```bash
GET /ingest/{job_id}
```

**Possible Statuses:**
| Status | Meaning |
|--------|---------|
| `pending` | Job created, waiting |
| `processing` | Currently running |
| `completed` | Done - check document_id |
| `failed` | Error - check error field |
| `needs_review` | Conflicts detected - resolve first |

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "document_id": "doc-123",
  "chunks_count": 45
}
```

---

## 3. Processing Pipeline (What Happens)

### Step 1: Download/Extract
- **PDF/HTML/CSV/JSON**: Download from CDN
- **YouTube/Audio**: Extract directly from URL (no download)

### Step 2: Compute Hash
- SHA256 of file content
- Check for duplicates

### Step 3: Extract Content
- Parse document, extract text elements
- YouTube: Get transcript + metadata

### Step 4: Chunk
- **Hierarchical**: Sections → Passages → Sentences
- **Recursive**: Fixed-size (1000 chars, 100 overlap)

### Step 5: Embed
- Generate embeddings using configured provider
- Default: `GEMINI_API_KEY` (gemini-embedding-001, 3072 dims)
- Fallback: `huggingface` (all-MiniLM-L6-v2, 384 dims)

### Step 6: Drift Check
- Compare with existing documents
- Check duplicates (similarity ≥ 0.98)
- Check contradictions (NLP-based)

### Step 7: Store
- Save to MongoDB
- Add to Vector Store

---

## 4. Check Conflicts (if needs_review)

```bash
GET /ingest/{job_id}/conflicts
```

**Response:**
```json
{
  "document_id": "doc-123",
  "document_name": "report.pdf",
  "conflicts": [
    {
      "category": "financial",
      "attribute": "revenue",
      "a_direction": "up",
      "b_direction": "down"
    }
  ],
  "has_conflicts": true
}
```

---

## 5. Resolve Conflicts

```bash
POST /ingest/{job_id}/resolve
{
  "resolution": "keep_new" | "keep_existing" | "keep_both"
}
```

---

## 6. Get Document

```bash
# Summary
GET /documents/summary/{document_id}

# Full with chunks
GET /documents/{document_id}

# Hierarchical chunks
GET /documents/{document_id}/hierarchical?chunk_type=passages
```

---

## 7. Search

```bash
POST /search
{
  "query": "your search term",
  "use_hybrid": true,
  "limit": 10
}
```

---

## Source Types

| Type | How Processed |
|------|---------------|
| `pdf` | Download → Extract text → Chunk |
| `html` | Download → Parse HTML → Chunk |
| `youtube` | Direct extract → Get transcript → Chunk |
| `audio` | Direct extract → Transcribe → Chunk |
| `csv` | Download → Parse CSV → Chunk |
| `json` | Download → Parse JSON → Chunk |
| `md` | Download → Parse Markdown → Chunk |
| `text` | Download → Read text → Chunk |

---

## Environment Variables

```bash
# Embeddings
EMBEDDING_PROVIDER=gemini  # or "huggingface", "openai"

# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=clutch_db
```

---

## Quick Test Commands

```bash
# 1. Start server
uv run uvicorn app.main:app --port 8000

# 2. Ingest PDF (replace UUID)
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"source_type": "pdf", "file_url": "https://5kcn84nzfr.ucarecd.net/UUID/"}'

# 3. Check status (replace job_id)
curl http://localhost:8000/ingest/JOB_ID

# 4. List documents
curl http://localhost:8000/documents

# 5. Search
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your search", "limit": 5}'

# 6. Get stats
curl http://localhost:8000/search/stats
```

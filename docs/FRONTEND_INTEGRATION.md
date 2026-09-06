# Frontend Integration Guide

## Overview

This API provides a complete document ingestion pipeline:
1. **Ingest** - Send a file URL (PDF, HTML, YouTube, etc.)
2. **Process** - Downloads, extracts, chunks, embeds (async background job)
3. **Retrieve** - Get document metadata and chunks in multiple formats

---

## Enums

### Source Types

| Value | Description |
|-------|-------------|
| `pdf` | PDF documents |
| `html` | Web pages |
| `youtube` | YouTube videos |
| `audio` | Audio files (MP3, WAV, M4A) |
| `image` | Images (PNG, JPG) |
| `csv` | CSV/spreadsheet files |
| `json` | JSON files |
| `md` | Markdown files |
| `text` | Plain text files |

### Chunk Types

| Value | Description | Best For |
|-------|-------------|----------|
| `sections` | Full sections with headings | Table of contents, navigation |
| `passages` | Paragraph-sized chunks | Displaying content (default) |
| `sentences` | Individual sentences | Fine-grained analysis |
| `recursive` | Fixed-size (1000 chars, 100 overlap) | Semantic search, embeddings |

### Job Status

| Value | Description |
|-------|-------------|
| `pending` | Job created, waiting to start |
| `processing` | Currently running |
| `completed` | Successfully finished |
| `failed` | Error occurred |
| `needs_review` | Conflicts detected - user decision required |

### Drift Status (Document Temporal State)

| Value | Description |
|-------|-------------|
| `new` | Document never compared to existing knowledge |
| `confirmed` | Agrees with existing knowledge |
| `contradiction` | Contradicts existing knowledge |
| `needs_review` | User needs to decide which to keep |
| `resolved` | User made a choice |

### Conflict Types

| Value | Description |
|-------|-------------|
| `direct` | Explicitly contradicts existing info |
| `partial` | Partially contradicts |
| `evolving` | Updates/evolves existing info |

---

## API Endpoints

### 1. Ingest Document

Start processing a document from a CDN URL.

**Endpoint:** `POST /ingest`

```json
// Request
{
  "source_type": "pdf",
  "file_url": "https://5kcn84nzfr.ucarecd.net/a1b2c3d4-e5f6-7890-abcd-ef1234567890/"
}

// Response (200)
{
  "job_id": "76d329af-3c4e-4ecd-a3d6-9a52f04fba6a",
  "status": "pending",
  "message": "Ingestion job started. Poll /ingest/{job_id} for completion status and document_id.",
  "document_id": null
}
```

---

### 2. Check Job Status

Poll for completion (poll every 2-3 seconds).

**Endpoint:** `GET /ingest/{job_id}`

```json
// Processing
{
  "job_id": "76d329af-3c4e-4ecd-a3d6-9a52f04fba6a",
  "status": "processing",
  "document_id": null,
  "chunks_count": null,
  "error": null,
  "started_at": "2026-04-11T18:31:44.175000",
  "completed_at": null
}

// Completed
{
  "job_id": "76d329af-3c4e-4ecd-a3d6-9a52f04fba6a",
  "status": "completed",
  "document_id": "abc123-def456",
  "chunks_count": 23,
  "error": null,
  "started_at": "2026-04-11T18:31:44.175000",
  "completed_at": "2026-04-11T18:32:15.000000"
}

// Failed
{
  "job_id": "76d329af-3c4e-4ecd-a3d6-9a52f04fba6a",
  "status": "failed",
  "error": "Failed to download file from CDN"
}

// Needs Review (conflicts detected)
{
  "job_id": "76d329af-3c4e-4ecd-a3d6-9a52f04fba6a",
  "status": "needs_review",
  "document_id": "abc123-def456",
  "chunks_count": 23,
  "error": null,
  "started_at": "2026-04-11T18:31:44.175000",
  "completed_at": null
}
```

---

### 3. Get Full Document

Get complete document with metadata, file info, and all chunks.

**Endpoint:** `GET /documents/{document_id}`

```json
{
  "document_id": "abc123-def456",
  "source_type": "pdf",
  "source_name": "annual_report_2024.pdf",
  "source_url": "https://5kcn84nzfr.ucarecd.net/.../",
  
  "file": {
    "hash": "sha256:abc123...",
    "size": 2456789,
    "local_path": "./downloads/annual_report_2024.pdf"
  },
  
  "hierarchical_chunks": {
    "sections": [...],
    "passages": [...],
    "sentences": [...]
  },
  "sections_count": 5,
  "passages_count": 23,
  "sentences_count": 156,
  
  "recursive_chunks": [...],
  "recursive_chunks_count": 18,
  
  "embedding_info": {
    "generated": true,
    "provider": "huggingface",
    "model": "sentence-transformers/all-MiniLM-L6-v2",
    "dimensions": 384,
    "chunks_embedded": 23,
    "file_path": "embeddings/abc123.json"
  },
  
  "created_at": "2026-04-11T18:32:00.000000",
  "updated_at": "2026-04-11T18:32:15.000000"
}
```

---

### 4. Get Hierarchical Chunks (Semantic)

Get chunks that understand document structure.

**Endpoint:** `GET /documents/{document_id}/hierarchical?chunk_type=passages`

**Query Parameters:**
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `chunk_type` | string | `"passages"` | `sections`, `passages`, `sentences` |

```json
// GET /documents/abc123/hierarchical?chunk_type=passages

{
  "document_id": "abc123-def456",
  "chunk_type": "passages",
  "chunks": [
    {
      "chunk_id": "chunk-001",
      "text": "This is the first passage of the document...",
      "level": "passage",
      "start_char": 0,
      "end_char": 450,
      "heading_path": "Introduction > Overview"
    },
    {
      "chunk_id": "chunk-002",
      "text": "The second passage continues with...",
      "level": "passage",
      "start_char": 451,
      "end_char": 920,
      "heading_path": "Introduction > Overview"
    }
  ],
  "count": 23
}
```

**Chunk Fields:**
| Field | Description |
|-------|-------------|
| `chunk_id` | Unique identifier |
| `text` | Actual content |
| `level` | section, passage, or sentence |
| `start_char` | Position in original document |
| `end_char` | Position in original document |
| `heading_path` | "Section > Subsection" for navigation (hierarchical only) |

---

### 5. Get Recursive Chunks (Character-based)

Get fixed-size chunks for embeddings/search.

**Endpoint:** `GET /documents/{document_id}/recursive`

```json
{
  "document_id": "abc123-def456",
  "chunk_type": "recursive",
  "chunks": [
    {
      "chunk_id": "rc-001",
      "text": "First 1000 characters of the document...",
      "level": "chunk",
      "start_char": 0,
      "end_char": 1000
    },
    {
      "chunk_id": "rc-002",
      "text": "Characters 900-1900 (100 char overlap)...",
      "level": "chunk",
      "start_char": 900,
      "end_char": 1900
    }
  ],
  "count": 18
}
```

**Use cases for recursive:**
- Semantic search (vector similarity)
- Building embedding index
- Consistent chunk sizes for LLM context

---

### 6. Get All Chunks

Get both hierarchical and recursive in one call.

**Endpoint:** `GET /documents/{document_id}/chunks`

```json
{
  "document_id": "abc123-def456",
  "hierarchical": {
    "sections": [...],
    "passages": [...],
    "sentences": [...]
  },
  "recursive": {
    "chunks": [...],
    "count": 18
  },
  "summary": {
    "sections": 5,
    "passages": 23,
    "sentences": 156,
    "recursive": 18
  }
}
```

---

### 7. Get by File Hash

Find document using file hash (for deduplication).

```bash
GET /documents/by-hash/{file_hash}
GET /documents/by-hash/{file_hash}/hierarchical?chunk_type=passages
GET /documents/by-hash/{file_hash}/recursive
```

---

### 8. List Documents

Get all documents sorted by date.

```bash
GET /documents?limit=50
```

---

### 9. Get Conflicts for a Job

When a job is `needs_review`, get the detected contradictions/duplicates.

**Endpoint:** `GET /ingest/{job_id}/conflicts`

```json
{
  "document_id": "abc123-def456",
  "document_name": "new_report.pdf",
  "conflicts": [
    {
      "new_text": "Revenue declined 30% in Q4",
      "existing_text": "Revenue grew 25% in Q4 2024",
      "existing_document_id": "doc-001",
      "existing_document_name": "q4_report.pdf",
      "similarity": -0.35,
      "drift_type": "potential_contradiction"
    }
  ],
  "has_conflicts": true
}
```

---

### 10. Resolve Conflicts

After reviewing conflicts, tell the API which version to keep.

**Endpoint:** `POST /ingest/{job_id}/resolve`

```json
// Request
{
  "resolution": "keep_new"  // or "keep_existing", "keep_both"
}

// Response
{
  "status": "resolved",
  "resolution": "keep_new",
  "document_id": "abc123-def456"
}
```

**Resolution Options:**
| Value | Description |
|-------|-------------|
| `keep_new` | Add new document to vector store, update knowledge |
| `keep_existing` | Keep current knowledge, ignore new document |
| `keep_both` | Add new document alongside existing (for comparison) |

---

## Drift Detection Logic

The system checks for two types of issues during ingestion:

### 1. Duplicates (similarity >= 0.98)
- Exact or near-exact copy of existing content
- User is notified but can auto-ingest

### 2. Contradictions (similarity < -0.3)
- New information that opposes existing knowledge
- Uses negative semantic similarity to detect
- Job marked as `needs_review` until user decides

**Example flow:**
```
1. Upload new document
2. System generates embeddings
3. Compare with existing vector store
4. If issues found → status = "needs_review"
5. Frontend shows: "This conflicts with existing docs"
6. User chooses: keep new / keep existing / keep both
7. Resolution applied → status = "completed"
```

---

## When to Use Which API

| Use Case | API | Chunk Type |
|----------|-----|------------|
| Display document content | `/hierarchical?chunk_type=passages` | passages |
| Build table of contents | `/hierarchical?chunk_type=sections` | sections |
| Semantic search index | `/recursive` | recursive |
| Full document data | `GET /documents/{id}` | all |
| Same file check | `/by-hash/{hash}` | - |

---

## UI/UX Recommendations

### Chunk Type Colors (for highlighting)

| Chunk Type | Suggested Color | Use Case |
|------------|----------------|----------|
| `sections` | `#3B82F6` (blue) | Navigation headers |
| `passages` | `#10B981` (green) | Main content blocks |
| `sentences` | `#F59E0B` (amber) | Highlighted phrases |
| `recursive` | `#8B5CF6` (purple) | Search/embedding matches |

### Example: Document Viewer Layout

```
┌─────────────────────────────────────────────┐
│  📄 Document: annual_report_2024.pdf       │
│  📊 Type: PDF | 📁 Size: 2.4MB            │
│  📅 Created: 2026-04-11                    │
└─────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────┐
│ SECTIONS     │  CONTENT                     │
│              │                              │
│ 🔵 Intro     │  [BLUE - Section Header]    │
│  ├─ Overview │  Green passage content...   │
│  └─ Summary  │                              │
│              │  Green passage content...   │
│ 🔵 Financial │                              │
│  ├─ Q1       │  [BLUE - Section Header]    │
│  └─ Q2       │  Green passage content...   │
│              │                              │
└──────────────┴──────────────────────────────┘

Legend: 🔵 Sections | 🟢 Passages | 🟡 Sentences | 🟣 Recursive
```

---

## Integration Example

```javascript
// 1. Start ingestion
const { job_id } = await fetch('/ingest', {
  method: 'POST',
  body: JSON.stringify({
    source_type: 'pdf',
    file_url: 'https://cdn.example.com/file.pdf'
  })
}).then(r => r.json());

// 2. Poll until complete
let job;
do {
  await delay(2000);
  job = await fetch(`/ingest/${job_id}`).then(r => r.json());
} while (job.status === 'pending' || job.status === 'processing');

// 3. Handle different statuses
if (job.status === 'failed') {
  showError(job.error);
  return;
}

if (job.status === 'needs_review') {
  // Get conflicts for user to review
  const conflicts = await fetch(`/ingest/${job_id}/conflicts`).then(r => r.json());
  showConflictDialog(conflicts, async (resolution) => {
    // User chose: "keep_new", "keep_existing", or "keep_both"
    await fetch(`/ingest/${job_id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution })
    });
  });
  return;
}

// 4. Get document metadata (when completed)
const doc = await fetch(`/documents/${job.document_id}`).then(r => r.json());
console.log(doc.embedding_info); // { provider, model, dimensions }
console.log(doc.temporal_metadata); // { drift_status: "new" }

// 5. Get chunks for display
const passages = await fetch(
  `/documents/${job.document_id}/hierarchical?chunk_type=passages`
).then(r => r.json());

// 6. For search, use recursive
const recursive = await fetch(
  `/documents/${job.document_id}/recursive`
).then(r => r.json());
```

---

## Error Codes

| Code | Message | Fix |
|------|---------|-----|
| 400 | Invalid source_type | Use valid enum: pdf, html, youtube, etc. |
| 400 | Invalid chunk_type | Use: sections, passages, sentences, recursive |
| 404 | Job not found | Check job_id spelling |
| 404 | Document not found | Check document_id |
| 500 | Failed to download | Verify CDN URL is accessible |
| 500 | MongoDB error | Check MongoDB is running |

---

## Quick Reference

```bash
# Base URL
http://localhost:8000

# Ingestion
POST   /ingest                              # Start job
GET    /ingest/{job_id}                    # Check status
GET    /ingest/{job_id}/conflicts          # Get conflicts (if needs_review)
POST   /ingest/{job_id}/resolve            # Resolve conflicts

# Documents
GET    /documents/{doc_id}                 # Full document
GET    /documents/{doc_id}/hierarchical    # Semantic chunks
GET    /documents/{doc_id}/recursive       # Fixed-size chunks
GET    /documents/{doc_id}/chunks          # All chunks

# By Hash
GET    /documents/by-hash/{hash}           # Document by hash

# Search
POST   /search                             # Semantic search

# List
GET    /documents?limit=50
GET    /ingest?status=needs_review         # Jobs needing review
```
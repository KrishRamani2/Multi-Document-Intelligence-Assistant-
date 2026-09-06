# Ingestion Implementation Strategy

## 1. Overview

The ingestion pipeline will use the **Unstructured** library as the core processing engine. It provides:
- **Partitioning**: Extract semantic elements (Title, NarrativeText, Table, etc.) from documents
- **Cleaning**: Sanitize extracted content (remove bullets, whitespace, punctuation)
- **Chunking**: Split elements into retrieval-ready chunks with configurable strategies
- **Embedding**: Generate vector embeddings for semantic search

## 2. Supported Source Types

| Source Type | Unstructured Function | Strategy |
|-------------|----------------------|----------|
| PDF | `partition_pdf` | hi_res (for tables) / fast |
| Web Pages (HTML) | `partition_html` | auto |
| YouTube/Audio | YouTube Transcript API + `partition_text` | text-based |
| Images (scanned docs) | `partition_image` | hi_res + OCR |
| CSV | `partition_csv` | native |
| JSON | Custom parser | - |
| Markdown | `partition_md` | auto |

## 3. Architecture

### 3.1 Pipeline Flow

```
Source → Detection → Partitioning → Cleaning → Chunking → Embedding → Storage
```

### 3.2 Core Components

**Base File Model** (`base_file_model.py`):
- `SourceType` enum: PDF, HTML, YOUTUBE, AUDIO, IMAGE, CSV, JSON, MARKDOWN
- `DocumentMetadata` pydantic model with source-specific fields
- `Chunk` model with content, metadata, embedding

**Extractors** (`extractors/` directory):
- `PdfExtractor` - uses `partition_pdf` with hi_res strategy
- `HtmlExtractor` - uses `partition_html` with url support
- `YoutubeExtractor` - fetches transcript, splits by timestamp
- `AudioExtractor` - whisper for transcription, then text processing
- `ImageExtractor` - uses `partition_image` with OCR
- `CsvExtractor` - uses `partition_csv` for table extraction
- `JsonExtractor` - custom parsing for structured data

**Cleaning Middleware** (`cleaning_middleware.py`):
- PII detection and redaction
- Text normalization
- Language detection

**Chunking Strategy**:
- Use `by_title` strategy to preserve section boundaries
- `max_characters=1500`, `new_after_n_chars=1000`
- `overlap=100` for context preservation

**Embedding**:
- Primary: `sentence-transformers/all-MiniLM-L6-v2` (fast, lightweight)
- Alternative: OpenAI text-embedding-3-small for higher quality

## 4. Implementation Priority

### Phase 1 - MVP
1. PDF extraction (research papers, reports)
2. Web page extraction (Wikipedia, articles)
3. Basic chunking with by_title strategy
4. Simple embedding with sentence-transformers

### Phase 2 - Advanced
1. YouTube transcript extraction
2. Image OCR for scanned documents
3. CSV/JSON structured data handling
4. PII detection and redaction

### Phase 3 - Production
1. Cross-lingual retrieval
2. Semantic deduplication
3. Autonomous gap detection
4. Source credibility scoring

## 5. Key Decisions

### Why Unstructured?
- Native support for 20+ file types
- Automatic element detection (Title, Table, ListItem)
- Built-in cleaning and chunking
- Table extraction with HTML representation
- Active community and maintenance

### Chunking Strategy: by_title
- Preserves semantic boundaries (sections, headings)
- Better for RAG - maintains context
- Can optionally respect page boundaries

### Embedding: all-MiniLM-L6-v2
- Fast inference (CPU-friendly)
- 384 dimensions - manageable storage
- Good quality/speed tradeoff for MVP

## 6. Storage Strategy

**Vector Database**: Qdrant or Milvus (for hybrid search)
- Vector embeddings for semantic similarity
- Metadata filtering (source, date, language)

**Document Store**: PostgreSQL + JSON
- Raw chunks with full metadata
- Source tracking for citations

## 7. Testing

- Unit tests for each extractor
- Integration tests for pipeline
- Test corpus: 3+ document types
- Verify chunk boundaries and citations
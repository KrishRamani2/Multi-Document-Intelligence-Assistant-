# Multi-Document Intelligence Assistant - Ingestion Module

## Overview

The ingestion module handles extracting content from heterogeneous sources and converting them into structured, chunked documents ready for retrieval and question answering.

## Supported Source Types

| Source Type | Extractor | Features |
|-------------|-----------|----------|
| PDF | `PdfExtractor` | Text extraction, tables (HTML), page numbers, OCR |
| HTML/Web | `HtmlExtractor` | Web pages, URLs, links metadata |
| YouTube | `YoutubeExtractor` | Transcripts, timestamps, 10s time chunks |
| Audio | `AudioExtractor` | AssemblyAI transcription, chapters, 10s time chunks |
| Image | `ImageExtractor` | Gemini AI description |
| CSV | `CsvExtractor` | Table extraction, headers, HTML output |
| JSON | `JsonExtractor` | Key-value parsing, nested structures |
| Markdown | `MarkdownExtractor` | Headings, lists, code blocks |

## Architecture

```
Source → Extractor → Document → Chunker → Chunked Document
              ↓
         Elements with
         metadata, positions
```

### 1. Models (`models.py`)

- **SourceType**: Enum for all supported file types
- **ElementType**: Title, NarrativeText, Table, ListItem, etc.
- **ChunkLevel**: SECTION, PASSAGE, SENTENCE (hierarchical)
- **Document**: Container with elements and chunks
- **Chunk**: Individual chunk with text, metadata, positions

### 2. Base Extractor (`base_extractor.py`)

```python
from ingestion import ExtractorFactory

# Auto-detect type and extract
document = ExtractorFactory.extract("path/to/file.pdf")

# Or specify type
extractor = ExtractorFactory.get_extractor(SourceType.PDF)
document = extractor.extract("file.pdf")
```

### 3. Hierarchical Chunker (`chunker.py`)

Creates 3-level hierarchy:
- **SECTION**: Full sections with headings (parent)
- **PASSAGE**: Paragraph-sized chunks (child)
- **SENTENCE**: Individual sentences (child)

For time-based content (audio/video):
- 10-second time chunks with metadata

## Usage

### Basic Extraction

```python
from ingestion import ExtractorFactory, HierarchicalChunker

# Extract from any supported source
doc = ExtractorFactory.extract("document.pdf")

# Chunk the document
chunker = HierarchicalChunker(time_chunk_seconds=10)  # For audio/video
doc = chunker.chunk_document(doc)

# Access chunks
print(f"Sections: {len(doc.section_chunks)}")
print(f"Passages: {len(doc.passage_chunks)}")
```

### Time-based Chunking (Audio/Video)

```python
chunker = HierarchicalChunker(time_chunk_seconds=10)
doc = chunker.chunk_document(doc)

# Each chunk has time metadata
for chunk in doc.passage_chunks:
    print(f"Time: {chunk.heading_path}")  # e.g., "[00:10] - [00:20]"
    print(f"Start: {chunk.metadata.get('start_ms')}")
    print(f"End: {chunk.metadata.get('end_ms')}")
```

### Accessing Elements and Metadata

```python
# Document metadata
print(doc.metadata.source_type)
print(doc.metadata.source_name)

# PDF-specific
print(doc.metadata.pdf_metadata.get('page_count'))

# YouTube-specific
print(doc.metadata.youtube_metadata.get('title'))
print(doc.metadata.youtube_metadata.get('duration_seconds'))

# Audio transcript
print(doc.metadata.extra_data.get('chapters'))
```

## API Keys Required

Create a `.env` file:

```bash
# AssemblyAI for audio transcription
ASSEMBLYAI_API_KEY=your_key

# Gemini for image description
GEMINI_API_KEY=your_key
```

Get keys from:
- AssemblyAI: https://assemblyai.com/dashboard
- Gemini: https://aistudio.google.com/app/apikey

## Testing

```bash
cd backend
uv run python3 test_ingest.py
```

Test functions available:
- `test_pdf("file.pdf")`
- `test_html("page.html")`
- `test_json("data.json")`
- `test_csv("data.csv")`
- `test_md("readme.md")`
- `test_image("image.png")`
- `test_audio("https://...")`
- `test_youtube("https://youtube.com/watch?v=...")`

## Dependencies

- `unstructured` - Document partitioning
- `pypdf` - PDF metadata
- `reportlab` - PDF creation
- `assemblyai` - Audio transcription
- `google-genai` - Image description
- `yt-dlp` - YouTube extraction
- `pydantic` - Data models

## Project Structure

```
backend/
├── ingestion/
│   ├── __init__.py
│   ├── models.py           # Data models
│   ├── base_extractor.py  # Base class + factory
│   ├── chunker.py         # Hierarchical chunking
│   └── extractors/
│       ├── __init__.py
│       ├── pdf_extractor.py
│       ├── html_extractor.py
│       ├── youtube_extractor.py
│       ├── audio_extractor.py
│       ├── image_extractor.py
│       ├── csv_extractor.py
│       ├── json_extractor.py
│       └── markdown_extractor.py
├── test_ingest.py          # Test script
├── create_pdf.py           # Sample PDF generator
└── .env                   # API keys
```

## Key Features

1. **Auto-detection**: Factory automatically detects file type from extension/URL
2. **Hierarchical chunks**: Section → Passage → Sentence with character positions
3. **Time-based chunks**: 10-second segments for audio/video with timestamps
4. **Table extraction**: HTML table representation preserved
5. **PII handling**: Metadata structure ready for PII detection
6. **Source citations**: Each element has source metadata for attribution
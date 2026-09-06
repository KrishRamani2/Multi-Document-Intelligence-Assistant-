# Extractor Architecture Plan

## 1. Base Extractor Protocol

Each extractor implements:
```python
class BaseExtractor(Protocol):
    def extract(self, source: str | Path | URL) -> Document: ...
    def validate(self, source: str | Path | URL) -> bool: ...
    def get_supported_types() -> list[SourceType]: ...
```

## 2. Extractor Files Structure

```
ingestion/
├── models.py              # ✅ Done
├── base_extractor.py      # Abstract base + protocol
├── extractors/
│   ├── __init__.py
│   ├── pdf_extractor.py
│   ├── html_extractor.py
│   ├── youtube_extractor.py
│   ├── audio_extractor.py
│   ├── image_extractor.py
│   ├── csv_extractor.py
│   ├── json_extractor.py
│   └── markdown_extractor.py
└── extractor_factory.py   # Returns correct extractor
```

## 3. File-Specific Metadata Schemas

### PDF Metadata
```python
class PdfMetadata(BaseModel):
    page_count: int
    author: Optional[str]
    title: Optional[str]
    subject: Optional[str]
    creator: Optional[str]
    producer: Optional[str]
    creation_date: Optional[datetime]
    is_scanned: bool
    has_tables: bool
    has_images: bool
    is_encrypted: bool
```

### HTML Metadata
```python
class HtmlMetadata(BaseModel):
    title: Optional[str]
    description: Optional[str]
    language: Optional[str]
    author: Optional[str]
    published_date: Optional[datetime]
    links_count: int
    images_count: int
    script_tags: int
    style_tags: int
```

### YouTube Metadata
```python
class YoutubeMetadata(BaseModel):
    video_id: str
    title: str
    description: Optional[str]
    channel_name: str
    channel_id: Optional[str]
    published_at: datetime
    duration_seconds: int
    view_count: Optional[int]
    like_count: Optional[int]
    is_caption_available: bool
    caption_language: Optional[str]
```

### Audio Metadata
```python
class AudioMetadata(BaseModel):
    duration_seconds: float
    format: str  # mp3, wav, m4a, etc.
    sample_rate: Optional[int]
    channels: Optional[int]
    bitrate: Optional[int]
    is_transcribed: bool
    transcription_language: Optional[str]
```

### Image Metadata
```python
class ImageMetadata(BaseModel):
    width: int
    height: int
    format: str  # png, jpg, tiff, etc.
    mode: str  # RGB, RGBA, L, etc.
    has_text: bool
    text_language: Optional[str]
    has_tables: bool
    has_charts: bool
    dpi: Optional[int]
```

### CSV Metadata
```python
class CsvMetadata(BaseModel):
    row_count: int
    column_count: int
    delimiter: str
    has_header: bool
    columns: List[str]
    encoding: str
    quoted_fields: bool
```

### JSON Metadata
```python
class JsonMetadata(BaseModel):
    keys: List[str]
    is_nested: bool
    array_depth: int
    total_nodes: int
    schema_type: Optional[str]  # object, array, mixed
```

## 4. Extractor Methods per Type

### Common Methods (all extractors)
| Method | Returns | Description |
|--------|---------|-------------|
| `extract(source)` | `Document` | Main entry point |
| `validate(source)` | `bool` | Check if source is valid |
| `get_metadata(source)` | `SourceSpecificMetadata` | Type-specific metadata |

### PDF Extractor
- Uses `unstructured.partition_pdf`
- Strategy: `hi_res` (for tables), `fast` (for text)
- Returns: Document with elements + PDF metadata

### HTML Extractor
- Uses `unstructured.partition_html`
- Supports URL or file
- Returns: Document with elements + HTML metadata

### YouTube Extractor
- Uses `yt-dlp` for metadata
- Uses YouTube Transcript API for subtitles
- Falls back to Whisper if no captions
- Returns: Document with timestamped chunks

### Audio Extractor
- Uses `yt-dlp` for audio download (for URLs)
- Uses Whisper for transcription
- Returns: Document with time-coded segments

### Image Extractor
- Uses `unstructured.partition_image`
- Strategy: `hi_res` with OCR
- Returns: Document with detected elements

### CSV Extractor
- Uses `unstructured.partition_csv`
- Preserves table structure as HTML
- Returns: Document with Table element

### JSON Extractor
- Custom parsing
- Flattens nested structures
- Returns: Document with structured elements

### Markdown Extractor
- Uses `unstructured.partition_md`
- Returns: Document with elements

## 5. Factory Pattern

```python
class ExtractorFactory:
    @staticmethod
    def get_extractor(source_type: SourceType) -> BaseExtractor:
        ...
    
    @staticmethod
    def detect_type(source: str | Path | URL) -> SourceType:
        # Uses file extension or content-type
        ...
```

## 6. Validation Rules

| Source Type | Validation |
|-------------|------------|
| PDF | Check magic bytes `%PDF` |
| HTML | Check `<html` or `.html` |
| YouTube | Check `youtube.com/watch?v=` or `youtu.be/` |
| Audio | Check extension `.mp3`, `.wav`, etc. |
| Image | Check magic bytes for image formats |
| CSV | Check `.csv` and parse first row |
| JSON | Check `.json` and valid JSON |
| Markdown | Check `.md` or `.markdown` |

## 7. Next Steps

1. Create `base_extractor.py` - abstract base class
2. Implement extractors one by one:
   - PDF (priority - most common)
   - HTML
   - YouTube
   - Audio
   - Image
   - CSV
   - JSON
   - Markdown
3. Create `extractor_factory.py`

Ready to implement? Start with base_extractor.py or go straight to PDF?
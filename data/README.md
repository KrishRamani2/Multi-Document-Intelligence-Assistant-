# Sample Data for Testing

## Structure

```
data/
├── pdf/
│   ├── sample_with_image_and_table.pdf    # PDF with embedded image and table
│   ├── sample_simple.pdf               # Simple text PDF
│   └── sample_multipage.pdf           # Multi-page PDF
├── html/
│   ├── sample.html                   # Simple HTML page
│   └── sample_with_table.html         # HTML with table
├── csv/
│   ├── sample.csv                    # Simple CSV data
│   └── sample_nested.csv            # CSV with nested data
├── json/
│   ├── sample.json                  # Simple JSON
│   └── sample_nested.json           # Nested JSON
├── markdown/
│   ├── sample.md                   # Simple markdown
│   └── sample_with_table.md         # Markdown with table
├── image/
│   ├── sample.png                  # Sample image
│   └── sample.jpg                 # Another format
└── audio/
    └── sample.mp3                  # Sample audio (optional)
```

## Source Types

- **PDF**: `source_type: "pdf"`
- **HTML**: `source_type: "html"`
- **CSV**: `source_type: "csv"`
- **JSON**: `source_type: "json"`
- **Markdown**: `source_type: "markdown"`
- **Image**: `source_type: "image"`
- **Audio**: `source_type: "audio"`
- **YouTube**: `source_type: "youtube"` (URL-based)

## Note

For PDF testing, ensure the file contains:
- At least one image
- At least one table
- Mixed headings (H1, H2, H3)
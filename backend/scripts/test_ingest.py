"""
Simple ingestion test - pass a file path and see the chunks with full metadata.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_pdf(file_path: str):
    """Test PDF extraction."""
    from ingestion.extractors import PdfExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"PDF: {file_path}")
    print("=" * 60)

    extractor = PdfExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"source_url: {doc.source_url}")
    print(f"elements_count: {len(doc.elements)}")
    print(f"created_at: {doc.created_at}")

    print("\n--- METADATA ---")
    print(f"source_type: {doc.metadata.source_type.value}")
    print(f"source_name: {doc.metadata.source_name}")
    print(f"language: {doc.metadata.language}")
    print(f"page_count: {doc.metadata.page_count}")
    print(f"file_size: {doc.metadata.file_size}")
    if doc.metadata.pdf_metadata:
        print(f"pdf_metadata:")
        for k, v in doc.metadata.pdf_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS (first 3) ---")
    for i, e in enumerate(doc.elements[:3]):
        print(f"  [{i + 1}] element_id: {e.element_id}")
        print(f"      element_type: {e.element_type.value}")
        print(f"      page_number: {e.page_number}")
        print(f"      start_char: {e.start_char}, end_char: {e.end_char}")
        print(f"      text: {e.text[:80]}...")

    # Show table elements
    tables = [e for e in doc.elements if e.element_type.value == "Table"]
    if tables:
        print(f"\n--- TABLE ELEMENTS ({len(tables)}) ---")
        for i, t in enumerate(tables[:2]):
            print(f"  [{i + 1}] page: {t.page_number}")
            print(f"      text: {t.text[:80]}...")
            if t.metadata.get("text_as_html"):
                print(f"      has_html_table: True")

    # Show image elements
    images = [e for e in doc.elements if e.element_type.value == "Image"]
    if images:
        print(f"\n--- IMAGE ELEMENTS ({len(images)}) ---")
        for i, img in enumerate(images[:3]):
            print(f"  [{i + 1}] page: {img.page_number}")
            print(f"      text: {img.text[:60]}...")
            print(f"      metadata keys: {list(img.metadata.keys())}")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"section_chunks: {len(doc.section_chunks)}")
    print(f"passage_chunks: {len(doc.passage_chunks)}")
    print(f"sentence_chunks: {len(doc.sentence_chunks)}")

    # Show chunks with tables/images
    print("\n--- CHUNKS WITH TABLES/IMAGES ---")

    # Check section chunks (where tables/images are stored)
    for i, chunk in enumerate(doc.section_chunks):
        tc = chunk.metadata.get("table_count", 0)
        ic = chunk.metadata.get("image_count", 0)
        if tc > 0 or ic > 0:
            print(f"  Section {i + 1}:")
            print(f"    heading_path: {chunk.heading_path}")
            print(f"    table_count: {tc}, image_count: {ic}")
            if chunk.metadata.get("tables"):
                for t in chunk.metadata["tables"]:
                    print(
                        f"    - Table: page {t.get('page')}, text: {t.get('text', '')[:60]}..."
                    )
            if chunk.metadata.get("images"):
                for img in chunk.metadata["images"]:
                    print(
                        f"    - Image: page {img.get('page')}, text: {img.get('text', '')[:50]}"
                    )


def test_html(file_path: str):
    """Test HTML extraction."""
    from ingestion.extractors import HtmlExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"HTML: {file_path}")
    print("=" * 60)

    extractor = HtmlExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"source_url: {doc.source_url}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    print(f"source_type: {doc.metadata.source_type.value}")
    print(f"source_name: {doc.metadata.source_name}")
    print(f"language: {doc.metadata.language}")
    if doc.metadata.html_metadata:
        print(f"html_metadata:")
        for k, v in doc.metadata.html_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS (first 3) ---")
    for i, e in enumerate(doc.elements[:3]):
        print(f"  [{i + 1}] element_type: {e.element_type.value}")
        print(f"      text: {e.text[:80]}...")
        print(f"      metadata: {e.metadata}")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"section_chunks: {len(doc.section_chunks)}")
    print(f"passage_chunks: {len(doc.passage_chunks)}")

    print("\n--- CHUNKS (first 3) ---")
    for i, chunk in enumerate(doc.section_chunks[:3]):
        print(f"  [{i + 1}] level: {chunk.level.value}")
        print(f"      heading_path: {chunk.heading_path}")
        print(f"      text: {chunk.text[:60]}...")


def test_json(file_path: str):
    """Test JSON extraction."""
    from ingestion.extractors import JsonExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"JSON: {file_path}")
    print("=" * 60)

    extractor = JsonExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    print(f"source_type: {doc.metadata.source_type.value}")
    if doc.metadata.json_metadata:
        print(f"json_metadata:")
        for k, v in doc.metadata.json_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS (first 3) ---")
    for i, e in enumerate(doc.elements[:3]):
        print(f"  [{i + 1}] element_type: {e.element_type.value}")
        print(f"      text: {e.text[:80]}...")
        print(f"      metadata: {e.metadata}")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"section_chunks: {len(doc.section_chunks)}")
    print(f"passage_chunks: {len(doc.passage_chunks)}")

    print("\n--- CHUNKS ---")
    for i, chunk in enumerate(doc.passage_chunks[:3]):
        print(f"  [{i + 1}] text: {chunk.text[:60]}...")


def test_csv(file_path: str):
    """Test CSV extraction."""
    from ingestion.extractors import CsvExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"CSV: {file_path}")
    print("=" * 60)

    extractor = CsvExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    if doc.metadata.csv_metadata:
        print(f"csv_metadata:")
        for k, v in doc.metadata.csv_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS ---")
    for i, e in enumerate(doc.elements):
        print(f"  [{i + 1}] element_type: {e.element_type.value}")
        print(f"      text_as_html: {e.metadata.get('text_as_html', 'N/A')[:100]}...")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"passage_chunks: {len(doc.passage_chunks)}")


def test_md(file_path: str):
    """Test Markdown extraction."""
    from ingestion.extractors import MarkdownExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"MARKDOWN: {file_path}")
    print("=" * 60)

    extractor = MarkdownExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    if doc.metadata.markdown_metadata:
        print(f"markdown_metadata:")
        for k, v in doc.metadata.markdown_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS (first 5) ---")
    for i, e in enumerate(doc.elements[:5]):
        print(f"  [{i + 1}] {e.element_type.value}: {e.text[:60]}...")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"section_chunks: {len(doc.section_chunks)}")
    print(f"passage_chunks: {len(doc.passage_chunks)}")

    print("\n--- CHUNKS ---")
    for i, chunk in enumerate(doc.section_chunks[:3]):
        print(f"  [{i + 1}] heading_path: {chunk.heading_path}")
        print(f"      level: {chunk.level.value}")
        print(f"      start_char: {chunk.start_char}, end_char: {chunk.end_char}")
        print(f"      element_types: {chunk.element_types}")
        print(f"      text: {chunk.text[:80]}...")


def test_image(file_path: str):
    """Test Image extraction."""
    from ingestion.extractors import ImageExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"IMAGE: {file_path}")
    print("=" * 60)

    extractor = ImageExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    if doc.metadata.image_metadata:
        print(f"image_metadata:")
        for k, v in doc.metadata.image_metadata.items():
            print(f"  {k}: {v}")
    if doc.metadata.extra_data:
        print(f"gemini_description:")
        print(f"  {doc.metadata.extra_data.get('description', '')[:200]}...")

    print("\n--- ELEMENTS ---")
    for i, e in enumerate(doc.elements[:3]):
        print(f"  [{i + 1}] {e.element_type.value}: {e.text[:80]}...")

    print("\n--- CHUNKING ---")
    chunker = HierarchicalChunker()
    doc = chunker.chunk_document(doc)

    print(f"passage_chunks: {len(doc.passage_chunks)}")


def test_audio(file_path: str):
    """Test Audio extraction."""
    from ingestion.extractors import AudioExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"AUDIO: {file_path}")
    print("=" * 60)

    extractor = AudioExtractor()
    doc = extractor.extract(file_path)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"source_url: {doc.source_url}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    if doc.metadata.audio_metadata:
        print(f"audio_metadata:")
        for k, v in doc.metadata.audio_metadata.items():
            print(f"  {k}: {v}")
    if doc.metadata.extra_data:
        print(f"extra_data (transcript):")
        print(f"  chapters: {len(doc.metadata.extra_data.get('chapters', []))}")
        print(f"  words: {len(doc.metadata.extra_data.get('words', []))}")
        chapters = doc.metadata.extra_data.get("chapters", [])
        if chapters:
            print(f"  first chapter: {chapters[0]}")

    print("\n--- ELEMENTS (first 5) ---")
    for i, e in enumerate(doc.elements[:5]):
        print(f"  [{i + 1}] element_type: {e.element_type.value}")
        print(f"      text: {e.text[:60]}...")
        print(
            f"      metadata: timestamp_start_ms={e.metadata.get('timestamp_start_ms')}, type={e.metadata.get('type')}"
        )

    print("\n--- CHUNKING (10s time-based) ---")
    chunker = HierarchicalChunker(time_chunk_seconds=10)
    doc = chunker.chunk_document(doc)

    print(f"time_based_chunks: {len(doc.passage_chunks)}")

    print("\n--- CHUNK MODELS ---")
    for i, chunk in enumerate(doc.passage_chunks[:5]):
        print(f"  [{i + 1}] chunk_id: {chunk.chunk_id[:8]}...")
        print(f"      level: {chunk.level.value}")
        print(f"      heading_path (time range): {chunk.heading_path}")
        print(f"      start_ms: {chunk.metadata.get('start_ms')}")
        print(f"      end_ms: {chunk.metadata.get('end_ms')}")
        print(f"      element_count: {chunk.metadata.get('element_count')}")
        print(f"      is_time_based: {chunk.metadata.get('is_time_based')}")
        print(f"      text: {chunk.text[:80]}...")


def test_youtube(url: str):
    """Test YouTube extraction."""
    from ingestion.extractors import YoutubeExtractor
    from ingestion import HierarchicalChunker

    print("\n" + "=" * 60)
    print(f"YOUTUBE: {url}")
    print("=" * 60)

    extractor = YoutubeExtractor()
    doc = extractor.extract(url)

    print("\n--- DOCUMENT MODEL ---")
    print(f"document_id: {doc.document_id}")
    print(f"source_type: {doc.source_type.value}")
    print(f"source_name: {doc.source_name}")
    print(f"source_url: {doc.source_url}")
    print(f"elements_count: {len(doc.elements)}")

    print("\n--- METADATA ---")
    if doc.metadata.youtube_metadata:
        print(f"youtube_metadata:")
        for k, v in doc.metadata.youtube_metadata.items():
            print(f"  {k}: {v}")

    print("\n--- ELEMENTS (first 5) ---")
    for i, e in enumerate(doc.elements[:5]):
        print(f"  [{i + 1}] element_type: {e.element_type.value}")
        print(f"      text: {e.text[:60]}...")
        print(
            f"      metadata: timestamp_start_ms={e.metadata.get('timestamp_start_ms')}, timestamp_formatted={e.metadata.get('timestamp_formatted')}"
        )

    print("\n--- CHUNKING (10s time-based) ---")
    chunker = HierarchicalChunker(time_chunk_seconds=10)
    doc = chunker.chunk_document(doc)

    print(f"time_based_chunks: {len(doc.passage_chunks)}")

    print("\n--- CHUNK MODELS ---")
    for i, chunk in enumerate(doc.passage_chunks[:5]):
        print(f"  [{i + 1}] chunk_id: {chunk.chunk_id[:8]}...")
        print(f"      level: {chunk.level.value}")
        print(f"      heading_path (time range): {chunk.heading_path}")
        print(f"      start_ms: {chunk.metadata.get('start_ms')}")
        print(f"      end_ms: {chunk.metadata.get('end_ms')}")
        print(f"      element_count: {chunk.metadata.get('element_count')}")
        print(f"      is_time_based: {chunk.metadata.get('is_time_based')}")
        print(f"      text: {chunk.text[:80]}...")


if __name__ == "__main__":
    DATA_DIR = "/home/harry/_codes_/Akarshak/data"

    test_pdf(f"{DATA_DIR}/pdf/sample_with_image_and_table.pdf")

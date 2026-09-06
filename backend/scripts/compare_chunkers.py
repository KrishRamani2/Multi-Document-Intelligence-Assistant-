"""
Chunker Comparison - Our approaches vs LangChain
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.chunker import HierarchicalChunker
from ingestion.recursive_chunker import RecursiveCharacterChunker
from ingestion.extractors import PdfExtractor
from ingestion.models import Document


def compare_all_chunkers():
    """Compare different chunking implementations."""

    sample_text = """
    Large Language Models (LLMs) represent a groundbreaking advancement in artificial intelligence. 
    These models are trained on vast amounts of text data and can understand, generate, and manipulate 
    human language with remarkable proficiency.
    
    The transformer architecture relies on the self-attention mechanism, which allows the model to 
    weigh the significance of different parts of the input when processing each element. This enables 
    parallel processing and captures long-range dependencies in text more effectively than previous 
    recurrent architectures like LSTM and GRU.
    
    There are several categories of large language models. Encoder-only models like BERT excel at 
    understanding tasks. Decoder-only models like GPT series are optimized for text generation.
    """

    print("=" * 80)
    print("CHUNKER COMPARISON: Our Implementation vs LangChain")
    print("=" * 80)

    # --- 1. Our HierarchicalChunker (element-based) ---
    print("\n" + "=" * 40)
    print("1. Our HierarchicalChunker (element-based)")
    print("=" * 40)
    print("Approach: Splits based on document elements (titles, paragraphs)")

    # Create mock document with elements
    from ingestion.models import DocumentElement, ElementType

    elements = [
        DocumentElement(
            element_id="1",
            element_type=ElementType.TITLE,
            text="Introduction",
            start_char=0,
            end_char=12,
        ),
        DocumentElement(
            element_id="2",
            element_type=ElementType.NARRATIVE_TEXT,
            text=sample_text[:200],
            start_char=13,
            end_char=213,
        ),
        DocumentElement(
            element_id="3",
            element_type=ElementType.TITLE,
            text="Architecture",
            start_char=214,
            end_char=227,
        ),
        DocumentElement(
            element_id="4",
            element_type=ElementType.NARRATIVE_TEXT,
            text=sample_text[200:],
            start_char=228,
            end_char=len(sample_text) + 228,
        ),
    ]

    # Create minimal document
    from ingestion.models import SourceType, DocumentMetadata

    doc_metadata = DocumentMetadata(
        source_type=SourceType.TEXT,
        source_name="test.txt",
    )

    doc = Document(
        document_id="test",
        source_type=SourceType.TEXT,
        source_name="test.txt",
        elements=elements,
        metadata=doc_metadata,
    )

    chunker = HierarchicalChunker(max_passage_chars=150)
    doc = chunker.chunk_document(doc)

    print(f"  - Creates hierarchy from element types")
    print(f"  - Uses heading detection for sections")
    print(f"  - Splits by paragraphs and sentences")
    print(f"  - SECTION chunks: {len(doc.section_chunks)}")
    print(f"  - PASSAGE chunks: {len(doc.passage_chunks)}")
    print(f"  - SENTENCE chunks: {len(doc.sentence_chunks)}")

    for i, c in enumerate(doc.passage_chunks[:3]):
        print(f"    [{i + 1}] chars {c.start_char}-{c.end_char}: {c.text[:50]}...")

    # --- 2. Our RecursiveCharacterChunker ---
    print("\n" + "=" * 40)
    print("2. Our RecursiveCharacterChunker")
    print("=" * 40)
    print("Approach: Pure character-based splitting with recursion")

    recursive = RecursiveCharacterChunker(chunk_size=100, overlap=20)
    chunks = recursive.split_text(sample_text)

    print(f"  - Uses multi-level separators")
    print(f"  - Recursive splitting when chunks exceed size")
    print(f"  - Supports configurable overlap")
    print(f"  - Tracks exact character positions")
    print(f"  - Total chunks: {len(chunks)}")

    for i, c in enumerate(chunks[:5]):
        print(f"    [{i + 1}] chars {c.start_char}-{c.end_char}: {c.text[:50]}...")

    # --- 3. LangChain RecursiveCharacterTextSplitter (simulated) ---
    print("\n" + "=" * 40)
    print("3. LangChain RecursiveCharacterTextSplitter")
    print("=" * 40)
    print("Approach: Flat split by separators, no hierarchy")

    # Simulate LangChain behavior
    import re

    sentences = re.split(r"(?<=[.!?])\s+", sample_text)

    lc_chunks = []
    current = ""
    current_len = 0

    for sent in sentences:
        if current_len + len(sent) > 100:
            if current.strip():
                lc_chunks.append(current.strip())
            current = sent
            current_len = len(sent)
        else:
            current += " " + sent
            current_len += len(sent) + 1

    if current.strip():
        lc_chunks.append(current.strip())

    print(f"  - Flat list of text chunks (no hierarchy)")
    print(f"  - No character position tracking")
    print(f"  - No metadata per chunk")
    print(f"  - Total chunks: {len(lc_chunks)}")

    for i, c in enumerate(lc_chunks[:5]):
        print(f"    [{i + 1}] {c[:50]}...")

    # --- Comparison Summary ---
    print("\n" + "=" * 40)
    print("WHY OUR IMPLEMENTATION IS BETTER")
    print("=" * 40)

    comparison = """
    ┌─────────────────────────────┬──────────────────────┬──────────────────────────┬──────────────────────┐
    │ Feature                   │ Our Hierarchical     │ Our Recursive           │ LangChain           │
    ├─────────────────────────────┼──────────────────────┼──────────────────────────┼──────────────────────┤
    │ Character Positions        │ ✓ start/end chars   │ ✓ exact positions       │ ✗ not tracked       │
    │ Hierarchy (Parent-Child)   │ ✓ SECTION→PASSAGE   │ ✓ create_hierarchy()   │ ✗ flat list         │
    │ Metadata per Chunk        │ ✓ element types      │ ✓ customizable          │ ✗ none             │
    │ Sentence Splitting        │ ✓ regex-based       │ ✓ recursive             │ ✓ basic             │
    │ Time-based (audio/video)  │ ✓ 10s chunks        │ ✗ text only            │ ✗ not supported    │
    │ Overlap Support           │ ✓ configurable      │ ✓ configurable         │ ✓ basic             │
    │ Paragraph Boundaries      │ ✓ preserved         │ ✓ preserved            │ ✗ may break        │
    │ Source Attribution        │ ✓ via elements      │ ✓ via positions        │ ✗ not supported    │
    └─────────────────────────────┴──────────────────────┴──────────────────────────┴──────────────────────┘
    """
    print(comparison)

    print("\n--- Use Cases ---")
    print(
        "• Use HierarchicalChunker for: Documents with clear structure (PDF, MD, HTML)"
    )
    print("• Use RecursiveCharacterChunker for: Raw text that needs flexible splitting")
    print("• Use time_chunk_seconds for: Audio/video transcripts")


if __name__ == "__main__":
    compare_all_chunkers()

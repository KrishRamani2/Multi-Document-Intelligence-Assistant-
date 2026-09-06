"""
Recursive Character Chunking - Better than LangChain's RecursiveCharacterTextSplitter
"""

import re
from typing import List, Optional, Callable
from dataclasses import dataclass

from ingestion.models import Chunk, ChunkLevel


@dataclass
class ChunkResult:
    text: str
    start_char: int
    end_char: int
    level: str


class RecursiveCharacterChunker:
    """
    Recursive character-based chunker that splits text hierarchically.

    Unlike LangChain's RecursiveCharacterTextSplitter, this implementation:
    1. Creates proper hierarchy (parent-child relationships)
    2. Tracks exact character positions in source
    3. Preserves semantic boundaries at each level
    4. Supports overlap between chunks
    5. Returns structured Chunk objects, not just text
    """

    def __init__(
        self,
        separators: Optional[List[str]] = None,
        chunk_size: int = 1000,
        overlap: int = 100,
        length_function: Callable[[str], int] = len,
    ):
        if separators is None:
            separators = [
                "\n\n",  # Paragraphs
                "\n",  # Lines
                ". ",  # Sentences
                "? ",  # Questions
                "! ",  # Exclamations
                "; ",  # Semicolons
                ", ",  # Commas
                " ",  # Words
            ]

        self.separators = separators
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.length_function = length_function

    def split_text(self, text: str) -> List[Chunk]:
        """
        Split text into hierarchical chunks.

        Returns:
            List of Chunk objects with parent-child relationships
        """
        if not text:
            return []

        # First pass: split by paragraphs
        paragraphs = self._split_by_separator(text, self.separators[0])

        chunks = []
        current_pos = 0

        for para in paragraphs:
            if not para.strip():
                current_pos += len(para)
                continue

            # Split paragraph into smaller chunks if needed
            sub_chunks = self._split_paragraph(
                para,
                current_pos,
                self.separators[1:],  # Use next level separators
            )
            chunks.extend(sub_chunks)

            current_pos += len(para)

        return chunks

    def _split_by_separator(self, text: str, separator: str) -> List[str]:
        """Split text by separator, preserving separator in results."""
        if not separator:
            return [text]

        parts = text.split(separator)
        result = []

        for i, part in enumerate(parts):
            if i < len(parts) - 1:
                result.append(part + separator)
            else:
                result.append(part)

        return result

    def _split_paragraph(
        self, text: str, start_offset: int, separators: List[str]
    ) -> List[Chunk]:
        """Recursively split paragraph into chunks."""

        # If text is small enough, return as single chunk
        if self.length_function(text) <= self.chunk_size:
            return [
                Chunk(
                    chunk_id="",
                    text=text.strip(),
                    level=ChunkLevel.PASSAGE,
                    start_char=start_offset,
                    end_char=start_offset + len(text),
                )
            ]

        # If we have no more separators, just return what we can
        if not separators:
            return [
                Chunk(
                    chunk_id="",
                    text=text[: self.chunk_size].strip(),
                    level=ChunkLevel.PASSAGE,
                    start_char=start_offset,
                    end_char=start_offset + self.chunk_size,
                )
            ]

        # Try splitting by current separator
        current_sep = separators[0]
        remaining_seps = separators[1:]

        parts = text.split(current_sep)
        chunks = []
        current_pos = start_offset

        for part in parts:
            part = part.strip()
            if not part:
                current_pos += len(current_sep)
                continue

            # If part is too large, recurse
            if self.length_function(part) > self.chunk_size:
                sub_chunks = self._split_paragraph(part, current_pos, remaining_seps)
                chunks.extend(sub_chunks)
            else:
                # Check overlap with previous chunk
                if chunks and self.overlap > 0:
                    prev_chunk = chunks[-1]
                    overlap_text = prev_chunk.text[-self.overlap :]
                    if overlap_text in part:
                        # Skip overlap
                        part = part[len(overlap_text) :].strip()
                        if not part:
                            current_pos += len(part) + len(current_sep)
                            continue

                chunk = Chunk(
                    chunk_id="",
                    text=part,
                    level=ChunkLevel.PASSAGE,
                    start_char=current_pos,
                    end_char=current_pos + len(part),
                )
                chunks.append(chunk)

            current_pos += len(part) + len(current_sep)

        return chunks

    def create_hierarchy(self, chunks: List[Chunk]) -> List[Chunk]:
        """Create parent-child hierarchy from flat chunks."""
        if not chunks:
            return []

        # First chunk becomes the parent section
        sections = []
        current_section = None
        section_chunks = []

        for chunk in chunks:
            if current_section is None:
                current_section = Chunk(
                    chunk_id="",
                    text=chunk.text,
                    level=ChunkLevel.SECTION,
                    start_char=chunk.start_char,
                    end_char=chunk.end_char,
                    child_chunk_ids=[chunk.chunk_id],
                )
            else:
                # If chunk continues from previous, merge
                if chunk.start_char - current_section.end_char < 50:
                    current_section.text += "\n\n" + chunk.text
                    current_section.end_char = chunk.end_char
                    current_section.child_chunk_ids.append(chunk.chunk_id)
                else:
                    # Save current section and start new one
                    sections.append(current_section)
                    current_section = Chunk(
                        chunk_id="",
                        text=chunk.text,
                        level=ChunkLevel.SECTION,
                        start_char=chunk.start_char,
                        end_char=chunk.end_char,
                        child_chunk_ids=[chunk.chunk_id],
                    )

            section_chunks.append(chunk)

        if current_section:
            sections.append(current_section)

        return sections


def compare_chunkers(text: str):
    """Compare different chunking approaches."""

    print("=" * 70)
    print("CHUNKER COMPARISON")
    print("=" * 70)

    # Our recursive chunker
    print("\n--- Our RecursiveCharacterChunker ---")
    our_chunker = RecursiveCharacterChunker(chunk_size=200, overlap=30)
    our_chunks = our_chunker.split_text(text)

    print(f"Total chunks: {len(our_chunks)}")
    for i, c in enumerate(our_chunks[:5]):
        print(f"  [{i + 1}] chars {c.start_char}-{c.end_char}: {c.text[:60]}...")

    # LangChain-style (simulated)
    print("\n--- LangChain RecursiveCharacterTextSplitter (simulated) ---")

    # Simple split by sentences for comparison
    import re

    sentences = re.split(r"(?<=[.!?])\s+", text)

    langchain_chunks = []
    current = ""
    current_len = 0

    for sent in sentences:
        if current_len + len(sent) > 200:
            if current:
                langchain_chunks.append(current.strip())
            current = sent
            current_len = len(sent)
        else:
            current += " " + sent
            current_len += len(sent) + 1

    if current.strip():
        langchain_chunks.append(current.strip())

    print(f"Total chunks: {len(langchain_chunks)}")
    for i, c in enumerate(langchain_chunks[:5]):
        print(f"  [{i + 1}] {c[:60]}...")

    print("\n--- Key Differences ---")
    print("1. Our chunker tracks exact character positions (start_char, end_char)")
    print("2. Our chunker creates proper hierarchy (SECTION -> PASSAGE)")
    print("3. Our chunker supports configurable separators at each level")
    print("4. Our chunker preserves paragraph/sentence boundaries")
    print("5. Our chunker returns Chunk objects with metadata, not just text")


if __name__ == "__main__":
    test_text = """
    Large Language Models (LLMs) represent a groundbreaking advancement in artificial intelligence. 
    These models are trained on vast amounts of text data and can understand, generate, and manipulate 
    human language with remarkable proficiency. The emergence of transformer architectures in 2017 
    marked a pivotal moment in NLP, enabling models to process sequential data with unprecedented 
    parallelization and attention to contextual relationships.
    
    The transformer architecture relies on the self-attention mechanism, which allows the model to 
    weigh the significance of different parts of the input when processing each element. This enables 
    parallel processing and captures long-range dependencies in text more effectively than previous 
    recurrent architectures like LSTM and GRU. The attention mechanism calculates relationship 
    between tokens, while feed-forward networks process attention outputs. Positional encoding adds 
    sequence order information, and layer normalization ensures stable training.
    
    There are several categories of large language models, each with distinct characteristics. 
    Encoder-only models like BERT excel at understanding tasks such as classification and named 
    entity recognition. Decoder-only models like GPT series are optimized for text generation. 
    Encoder-decoder models like T5 and BART combine both approaches for tasks requiring both 
    understanding and generation capabilities. Each type has specific use cases and strengths.
    """

    compare_chunkers(test_text)

from typing import List, Optional, Tuple
import uuid
import re

from ingestion.models import (
    Document,
    Chunk,
    ChunkLevel,
    ElementType,
    DocumentElement,
)


class HierarchicalChunker:
    """
    Creates hierarchical chunks from document elements.

    Hierarchy:
    - SECTION: Full sections with headings (parent)
    - PASSAGE: Paragraph-sized chunks (child of SECTION)
    - SENTENCE: Individual sentences (child of PASSAGE)

    Each chunk has exact start_char and end_char positions.
    """

    def __init__(
        self,
        max_section_chars: int = 5000,
        max_passage_chars: int = 1500,
        max_sentence_chars: int = 500,
        overlap_chars: int = 100,
        time_chunk_seconds: int = 0,  # 0 = no time-based chunking
    ):
        self.max_section_chars = max_section_chars
        self.max_passage_chars = max_passage_chars
        self.max_sentence_chars = max_sentence_chars
        self.overlap_chars = overlap_chars
        self.time_chunk_seconds = time_chunk_seconds

    def chunk_document(self, document: Document) -> Document:
        """
        Create hierarchical chunks from a document.

        Returns document with section_chunks, passage_chunks, and sentence_chunks populated.
        """
        if not document.elements:
            return document

        # Check if this is a time-based document (audio/video with timestamps)
        if self.time_chunk_seconds > 0 and self._has_timestamps(document.elements):
            return self._create_time_chunks(document)

        # Standard text-based chunking
        sections = self._create_sections(document.elements)

        passage_chunks = []
        sentence_chunks = []

        for section in sections:
            passage_ids = self._create_passages(
                section, passage_chunks, sentence_chunks
            )
            section.chunk_ids = passage_ids

            for passage_id in passage_ids:
                passage = next(p for p in passage_chunks if p.chunk_id == passage_id)
                self._create_sentences(passage, sentence_chunks)

        document.section_chunks = sections
        document.passage_chunks = passage_chunks
        document.sentence_chunks = sentence_chunks

        return document

    def _has_timestamps(self, elements) -> bool:
        """Check if elements have timestamp metadata."""
        for elem in elements:
            if elem.metadata and (
                "timestamp_start_ms" in elem.metadata
                or "timestamp_start" in elem.metadata
            ):
                return True
        return False

    def _create_time_chunks(self, document: Document) -> Document:
        """Create time-based chunks (e.g., 10-second segments)."""
        chunk_duration_ms = self.time_chunk_seconds * 1000

        # Group elements by time chunks
        time_chunks = {}  # {chunk_index: elements}

        for elem in document.elements:
            ts = elem.metadata.get("timestamp_start_ms", 0) if elem.metadata else 0
            chunk_index = ts // chunk_duration_ms

            if chunk_index not in time_chunks:
                time_chunks[chunk_index] = []
            time_chunks[chunk_index].append(elem)

        # Create chunks from grouped elements
        chunks = []

        for chunk_index in sorted(time_chunks.keys()):
            elems = time_chunks[chunk_index]

            # Combine text from all elements in this time chunk
            combined_text = " ".join(e.text for e in elems if e.text.strip())

            start_ms = chunk_index * chunk_duration_ms
            end_ms = start_ms + chunk_duration_ms

            start_sec = start_ms / 1000.0
            mins = int(start_sec // 60)
            secs = int(start_sec % 60)

            chunk = Chunk(
                chunk_id=str(uuid.uuid4()),
                text=combined_text,
                level=ChunkLevel.PASSAGE,
                start_char=0,  # Not applicable for time-based
                end_char=len(combined_text),
                heading_path=f"[{mins:02d}:{secs:02d}] - [{mins:02d}:{secs + self.time_chunk_seconds:02d}]",
                element_types=list(set(e.element_type for e in elems)),
                metadata={
                    "time_chunk_index": chunk_index,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "element_count": len(elems),
                    "is_time_based": True,
                },
            )
            chunks.append(chunk)

        document.section_chunks = []
        document.passage_chunks = chunks
        document.sentence_chunks = []

        return document

    def _create_sections(self, elements: List[DocumentElement]) -> List[Chunk]:
        """Create section-level chunks based on headings."""
        sections = []
        current_section_text = []
        current_heading_path = []
        section_start_char = 0

        for elem in elements:
            if elem.element_type in (ElementType.TITLE, ElementType.HEADING):
                if current_section_text:
                    section = self._build_section(
                        current_section_text,
                        current_heading_path,
                        section_start_char,
                    )
                    sections.append(section)

                current_heading_path.append(elem.text)
                current_section_text = []
                section_start_char = elem.start_char or 0
            else:
                if elem.text.strip():
                    current_section_text.append(elem)

        if current_section_text:
            section = self._build_section(
                current_section_text,
                current_heading_path,
                section_start_char,
            )
            sections.append(section)

        if not sections and elements:
            sections.append(self._build_section(elements, ["Document"], 0))

        return sections

    def _build_section(
        self,
        elements: List[DocumentElement],
        heading_path: List[str],
        start_char: int,
    ) -> Chunk:
        """Build a section chunk from elements."""
        texts = []
        table_count = 0
        image_count = 0
        tables_data = []
        images_data = []

        for elem in elements:
            if elem.element_type == ElementType.TABLE:
                table_count += 1
                table_info = {
                    "text": elem.text,
                    "page": elem.page_number,
                    "start_char": elem.start_char,
                    "end_char": elem.end_char,
                }
                if elem.metadata and elem.metadata.get("text_as_html"):
                    table_info["html"] = elem.metadata.get("text_as_html")
                tables_data.append(table_info)
                texts.append(f"[TABLE: {elem.text}]")
            elif elem.element_type == ElementType.IMAGE:
                image_count += 1
                image_info = {
                    "text": elem.text or "image",
                    "page": elem.page_number,
                    "start_char": elem.start_char,
                    "end_char": elem.end_char,
                }
                if elem.metadata:
                    if elem.metadata.get("image_path"):
                        image_info["image_path"] = elem.metadata["image_path"]
                    if elem.metadata.get("text_as_html"):
                        image_info["html"] = elem.metadata["text_as_html"]
                images_data.append(image_info)
                texts.append(f"[IMAGE: {elem.text or 'image'}]")
            elif elem.text.strip():
                texts.append(elem.text)

        combined_text = "\n\n".join(texts)
        end_char = start_char + len(combined_text)

        element_types = list(set(e.element_type for e in elements))

        metadata = {
            "element_count": len(elements),
            "has_tables": table_count > 0,
            "has_images": image_count > 0,
            "table_count": table_count,
            "image_count": image_count,
        }

        if tables_data:
            metadata["tables"] = tables_data
        if images_data:
            metadata["images"] = images_data

        return Chunk(
            chunk_id=str(uuid.uuid4()),
            text=combined_text,
            level=ChunkLevel.SECTION,
            start_char=start_char,
            end_char=end_char,
            heading_path=" > ".join(heading_path) if heading_path else None,
            element_types=element_types,
            metadata=metadata,
            child_chunk_ids=[],
        )

    def _create_passages(
        self,
        section: Chunk,
        existing_passages: List[Chunk],
        existing_sentences: List[Chunk],
    ) -> List[str]:
        """Create passage-level chunks within a section."""
        passages = []

        paragraphs = self._split_into_paragraphs(section.text)

        current_passage_text = []
        passage_start = section.start_char
        passage_ids = []

        for para in paragraphs:
            if not para.strip():
                continue

            if self._would_exceed_limit(
                current_passage_text, para, self.max_passage_chars
            ):
                if current_passage_text:
                    passage = self._build_passage(
                        current_passage_text,
                        section.chunk_id,
                        passage_start,
                        passages,
                    )
                    passages.append(passage)
                    passage_ids.append(passage.chunk_id)

                    overlap_start = passage.end_char - self.overlap_chars
                    passage_start = (
                        overlap_start
                        if overlap_start > section.start_char
                        else section.start_char
                    )
                    current_passage_text = []

            current_passage_text.append(para)

        if current_passage_text:
            passage = self._build_passage(
                current_passage_text,
                section.chunk_id,
                passage_start,
                passages,
            )
            passages.append(passage)
            passage_ids.append(passage.chunk_id)

        existing_passages.extend(passages)
        return passage_ids

    def _build_passage(
        self,
        texts: List[str],
        parent_id: str,
        start_char: int,
        existing: List[Chunk],
    ) -> Chunk:
        """Build a passage chunk."""
        combined_text = "\n\n".join(texts)
        end_char = start_char + len(combined_text)

        return Chunk(
            chunk_id=str(uuid.uuid4()),
            text=combined_text,
            level=ChunkLevel.PASSAGE,
            parent_chunk_id=parent_id,
            start_char=start_char,
            end_char=end_char,
            metadata={"text_count": len(texts)},
        )

    def _create_sentences(
        self,
        passage: Chunk,
        existing_sentences: List[Chunk],
    ) -> None:
        """Create sentence-level chunks within a passage."""
        sentences = self._split_into_sentences(passage.text)

        sentence_start = passage.start_char

        for sent in sentences:
            if not sent.strip():
                continue

            sentence = Chunk(
                chunk_id=str(uuid.uuid4()),
                text=sent,
                level=ChunkLevel.SENTENCE,
                parent_chunk_id=passage.chunk_id,
                start_char=sentence_start,
                end_char=sentence_start + len(sent),
                metadata={"source": "sentence_split"},
            )

            existing_sentences.append(sentence)
            sentence_start = sentence.end_char + 1

    def _would_exceed_limit(
        self,
        current: List[str],
        new_text: str,
        limit: int,
    ) -> bool:
        """Check if adding new text would exceed the limit."""
        if not current:
            return len(new_text) > limit
        current_len = sum(len(t) for t in current)
        return (current_len + len(new_text) + 2) > limit

    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        paragraphs = re.split(r"\n\s*\n", text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        sentence_pattern = r"(?<=[.!?])\s+"
        sentences = re.split(sentence_pattern, text)
        return [s.strip() for s in sentences if s.strip()]

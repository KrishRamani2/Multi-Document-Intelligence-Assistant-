"""
Test file for ingestion module.
Each test function tests a specific extractor.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def run_test(test_class):
    """Run all test methods in a class."""
    if not EXTRACTORS_AVAILABLE and hasattr(test_class, "__test_extractors_required__"):
        print(f"  (skipped - extractors not available)")
        return 0, 1

    passed = 0
    failed = []

    for method_name in dir(test_class):
        if method_name.startswith("test_"):
            method = getattr(test_class, method_name)
            try:
                method()
                passed += 1
                print(f"  ✓ {method_name}")
            except Exception as e:
                failed.append(f"{method_name}: {e}")
                print(f"  ✗ {method_name}: {e}")

    return passed, len(failed)


from ingestion.models import SourceType
from ingestion.chunker import HierarchicalChunker

try:
    from ingestion.extractors import (
        PdfExtractor,
        HtmlExtractor,
        YoutubeExtractor,
        AudioExtractor,
        ImageExtractor,
        CsvExtractor,
        JsonExtractor,
        MarkdownExtractor,
        ExtractorFactory,
    )

    EXTRACTORS_AVAILABLE = True
except ImportError as e:
    EXTRACTORS_AVAILABLE = False
    print(f"Warning: Extractors not available - {e}")


class TestPdfExtractor:
    """Tests for PDF extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_valid_pdf():
        """Test validation with a valid PDF file."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 test content")
            f.flush()
            path = f.name

        extractor = PdfExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True, "Valid PDF should pass validation"

    @staticmethod
    def test_validate_invalid_extension():
        """Test validation fails for non-PDF extension."""
        extractor = PdfExtractor()
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"test")
            f.flush()
            path = f.name

        result = extractor.validate(path)
        os.unlink(path)
        assert result is False, "Non-PDF should fail validation"


class TestHtmlExtractor:
    """Tests for HTML extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_html_file():
        """Test validation with a valid HTML file."""
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
            f.write(b"<html><body>Test</body></html>")
            f.flush()
            path = f.name

        extractor = HtmlExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True, "Valid HTML should pass validation"

    @staticmethod
    def test_validate_url():
        """Test validation with a valid URL."""
        extractor = HtmlExtractor()
        assert extractor.validate("https://example.com") is True
        assert extractor.validate("http://test.org/page.html") is True

    @staticmethod
    def test_validate_invalid():
        """Test validation fails for invalid source."""
        extractor = HtmlExtractor()
        assert extractor.validate("not_a_url") is False
        assert extractor.validate("/nonexistent/file.html") is False


class TestYoutubeExtractor:
    """Tests for YouTube extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_youtube_url():
        """Test validation with various YouTube URL formats."""
        extractor = YoutubeExtractor()

        valid_urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/abc123",
            "https://www.youtube.com/embed/xyz789",
        ]

        for url in valid_urls:
            assert extractor.validate(url) is True, f"Should validate {url}"

    @staticmethod
    def test_validate_invalid_url():
        """Test validation fails for non-YouTube URLs."""
        extractor = YoutubeExtractor()

        invalid_urls = [
            "https://example.com/video",
            "https://vimeo.com/123456",
            "not_a_url",
        ]

        for url in invalid_urls:
            assert extractor.validate(url) is False, f"Should not validate {url}"


class TestAudioExtractor:
    """Tests for Audio extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_audio_file():
        """Test validation with valid audio files."""
        extractor = AudioExtractor()

        valid_extensions = [".mp3", ".wav", ".m4a", ".flac", ".ogg"]

        for ext in valid_extensions:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                f.write(b"fake audio data")
                f.flush()
                path = f.name

            result = extractor.validate(path)
            os.unlink(path)
            assert result is True, f"Should validate {ext} files"


class TestImageExtractor:
    """Tests for Image extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_image_file():
        """Test validation with valid image files."""
        extractor = ImageExtractor()

        valid_extensions = [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".heic"]

        for ext in valid_extensions:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                f.write(b"\x89PNG\r\n\x1a\n")
                f.flush()
                path = f.name

            result = extractor.validate(path)
            os.unlink(path)
            assert result is True, f"Should validate {ext} files"


class TestCsvExtractor:
    """Tests for CSV extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_csv_file():
        """Test validation with a valid CSV file."""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"name,age,city\nAlice,30,NYC")
            f.flush()
            path = f.name

        extractor = CsvExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True, "Valid CSV should pass validation"

    @staticmethod
    def test_validate_invalid():
        """Test validation fails for non-CSV files."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"not csv")
            f.flush()
            path = f.name

        extractor = CsvExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is False


class TestJsonExtractor:
    """Tests for JSON extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_json_file():
        """Test validation with a valid JSON file."""
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            f.write(b'{"key": "value", "num": 123}')
            f.flush()
            path = f.name

        extractor = JsonExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True, "Valid JSON should pass validation"

    @staticmethod
    def test_validate_invalid_json():
        """Test validation fails for invalid JSON."""
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            f.write(b"not valid json {")
            f.flush()
            path = f.name

        extractor = JsonExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is False


class TestMarkdownExtractor:
    """Tests for Markdown extractor."""

    __test_extractors_required__ = True

    @staticmethod
    def test_validate_markdown_file():
        """Test validation with a valid Markdown file."""
        with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as f:
            f.write(b"# Title\n\nSome content")
            f.flush()
            path = f.name

        extractor = MarkdownExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True, "Valid MD should pass validation"

    @staticmethod
    def test_validate_markdown_extension():
        """Test validation with .markdown extension."""
        with tempfile.NamedTemporaryFile(suffix=".markdown", delete=False) as f:
            f.write(b"# Title")
            f.flush()
            path = f.name

        extractor = MarkdownExtractor()
        result = extractor.validate(path)
        os.unlink(path)
        assert result is True


class TestExtractorFactory:
    """Tests for ExtractorFactory."""

    __test_extractors_required__ = True

    @staticmethod
    def test_detect_pdf_type():
        """Test detection of PDF type."""
        assert ExtractorFactory.detect_type("document.pdf") == SourceType.PDF
        assert ExtractorFactory.detect_type("/path/to/file.PDF") == SourceType.PDF

    @staticmethod
    def test_detect_html_type():
        """Test detection of HTML type."""
        assert ExtractorFactory.detect_type("page.html") == SourceType.HTML
        assert ExtractorFactory.detect_type("page.htm") == SourceType.HTML

    @staticmethod
    def test_detect_youtube_type():
        """Test detection of YouTube type from URL."""
        assert (
            ExtractorFactory.detect_type("https://youtube.com/watch?v=abc")
            == SourceType.YOUTUBE
        )
        assert (
            ExtractorFactory.detect_type("https://youtu.be/abc") == SourceType.YOUTUBE
        )

    @staticmethod
    def test_detect_csv_type():
        """Test detection of CSV type."""
        assert ExtractorFactory.detect_type("data.csv") == SourceType.CSV

    @staticmethod
    def test_detect_json_type():
        """Test detection of JSON type."""
        assert ExtractorFactory.detect_type("data.json") == SourceType.JSON

    @staticmethod
    def test_detect_markdown_type():
        """Test detection of Markdown type."""
        assert ExtractorFactory.detect_type("readme.md") == SourceType.MARKDOWN
        assert ExtractorFactory.detect_type("doc.markdown") == SourceType.MARKDOWN

    @staticmethod
    def test_get_extractor():
        """Test getting correct extractor for type."""
        extractor = ExtractorFactory.get_extractor(SourceType.PDF)
        assert isinstance(extractor, PdfExtractor)

        extractor = ExtractorFactory.get_extractor(SourceType.HTML)
        assert isinstance(extractor, HtmlExtractor)

        extractor = ExtractorFactory.get_extractor(SourceType.CSV)
        assert isinstance(extractor, CsvExtractor)


class TestHierarchicalChunker:
    """Tests for HierarchicalChunker."""

    @staticmethod
    def test_chunker_import():
        """Test that chunker can be imported."""
        chunker = HierarchicalChunker()
        assert chunker is not None

    @staticmethod
    def test_default_parameters():
        """Test default parameters."""
        chunker = HierarchicalChunker()
        assert chunker.max_section_chars == 5000
        assert chunker.max_passage_chars == 1500
        assert chunker.max_sentence_chars == 500
        assert chunker.overlap_chars == 100

    @staticmethod
    def test_custom_parameters():
        """Test custom parameters."""
        chunker = HierarchicalChunker(
            max_section_chars=3000,
            max_passage_chars=800,
            max_sentence_chars=200,
            overlap_chars=50,
        )
        assert chunker.max_section_chars == 3000
        assert chunker.max_passage_chars == 800
        assert chunker.max_sentence_chars == 200
        assert chunker.overlap_chars == 50


def run_all_tests():
    """Run all tests and print results."""
    test_classes = [
        TestPdfExtractor,
        TestHtmlExtractor,
        TestYoutubeExtractor,
        TestAudioExtractor,
        TestImageExtractor,
        TestCsvExtractor,
        TestJsonExtractor,
        TestMarkdownExtractor,
        TestExtractorFactory,
        TestHierarchicalChunker,
    ]

    total = 0
    passed = 0
    failed = []

    for test_class in test_classes:
        print(f"\n=== {test_class.__name__} ===")

        p, f = run_test(test_class)
        total += p + f
        passed += p
        failed.extend(
            [
                f"{test_class.__name__}.{m}"
                for m in dir(test_class)
                if m.startswith("test_") and f > 0
            ]
        )

    print(f"\n{'=' * 50}")
    print(f"Results: {passed}/{total} tests passed")

    if failed:
        print(f"\nFailed tests: {len(failed)}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(run_all_tests())

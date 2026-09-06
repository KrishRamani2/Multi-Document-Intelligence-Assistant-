from ingestion.base_extractor import BaseExtractor, ExtractorFactory
from ingestion.models import SourceType

try:
    from .pdf_extractor import PdfExtractor
except ImportError:
    PdfExtractor = None

try:
    from .html_extractor import HtmlExtractor
except ImportError:
    HtmlExtractor = None

try:
    from .youtube_extractor import YoutubeExtractor
except ImportError:
    YoutubeExtractor = None

try:
    from .audio_extractor import AudioExtractor
except ImportError:
    AudioExtractor = None

try:
    from .image_extractor import ImageExtractor
except ImportError:
    ImageExtractor = None

try:
    from .csv_extractor import CsvExtractor
except ImportError:
    CsvExtractor = None

try:
    from .json_extractor import JsonExtractor
except ImportError:
    JsonExtractor = None

try:
    from .markdown_extractor import MarkdownExtractor
except ImportError:
    MarkdownExtractor = None


def _register_extractors():
    """Register extractors if they're available."""
    if PdfExtractor:
        ExtractorFactory.register(SourceType.PDF, PdfExtractor)
    if HtmlExtractor:
        ExtractorFactory.register(SourceType.HTML, HtmlExtractor)
    if YoutubeExtractor:
        ExtractorFactory.register(SourceType.YOUTUBE, YoutubeExtractor)
    if AudioExtractor:
        ExtractorFactory.register(SourceType.AUDIO, AudioExtractor)
    if ImageExtractor:
        ExtractorFactory.register(SourceType.IMAGE, ImageExtractor)
    if CsvExtractor:
        ExtractorFactory.register(SourceType.CSV, CsvExtractor)
    if JsonExtractor:
        ExtractorFactory.register(SourceType.JSON, JsonExtractor)
    if MarkdownExtractor:
        ExtractorFactory.register(SourceType.MARKDOWN, MarkdownExtractor)


_register_extractors()

__all__ = [
    "BaseExtractor",
    "ExtractorFactory",
    "PdfExtractor",
    "HtmlExtractor",
    "YoutubeExtractor",
    "AudioExtractor",
    "ImageExtractor",
    "CsvExtractor",
    "JsonExtractor",
    "MarkdownExtractor",
]

"""
Extract text from uploaded PDF and DOCX files.
"""
import io
import logging
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader

logger = logging.getLogger(__name__)

PDF_EXT = {".pdf"}
DOCX_EXT = {".docx", ".doc"}


def extract_text_from_pdf(content: bytes, filename: str) -> str:
    """Extract text from PDF bytes. Returns extracted text or error message."""
    try:
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                parts.append(text)
        result = "\n\n".join(parts).strip()
        logger.info("Extracted %d chars from PDF %s (%d pages)", len(result), filename, len(reader.pages))
        return result or "(No text extracted from PDF)"
    except Exception as e:
        logger.warning("PDF extraction failed for %s: %s", filename, e)
        return f"(PDF extraction failed: {e})"


def extract_text_from_docx(content: bytes, filename: str) -> str:
    """Extract text from DOCX bytes. Returns extracted text or error message."""
    try:
        doc = DocxDocument(io.BytesIO(content))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n\n".join(parts).strip()
        logger.info("Extracted %d chars from DOCX %s", len(result), filename)
        return result or "(No text extracted from DOCX)"
    except Exception as e:
        logger.warning("DOCX extraction failed for %s: %s", filename, e)
        return f"(DOCX extraction failed: {e})"


def extract_text_from_file(content: bytes, filename: str) -> str:
    """Dispatch by file extension. Returns extracted text."""
    ext = Path(filename).suffix.lower()
    if ext in PDF_EXT:
        return extract_text_from_pdf(content, filename)
    if ext in DOCX_EXT:
        return extract_text_from_docx(content, filename)
    logger.warning("Unsupported file type for text extraction: %s", filename)
    return f"(Unsupported file type: {ext})"

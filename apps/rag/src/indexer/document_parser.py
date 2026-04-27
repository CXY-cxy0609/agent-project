"""
文档解析器 — 支持 Markdown / PDF文字 / PDF图片(OCR)
直接使用 pypdf，无 LangChain 包装
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ParsedDocument:
    text: str
    doc_type: str          # "markdown" | "pdf_text" | "pdf_ocr"
    page_count: int
    metadata: dict


def parse_document(content: bytes, filename: str) -> ParsedDocument:
    """根据文件类型选择解析策略"""
    filename_lower = filename.lower()

    if filename_lower.endswith((".md", ".markdown", ".txt")):
        return _parse_markdown(content, filename)
    elif filename_lower.endswith(".pdf"):
        return _parse_pdf(content, filename)
    else:
        # 未知类型尝试作为文本处理
        return ParsedDocument(
            text=content.decode("utf-8", errors="ignore"),
            doc_type="plain_text",
            page_count=1,
            metadata={"filename": filename},
        )


def _parse_markdown(content: bytes, filename: str) -> ParsedDocument:
    text = content.decode("utf-8", errors="ignore")
    return ParsedDocument(
        text=text,
        doc_type="markdown",
        page_count=1,
        metadata={"filename": filename},
    )


def _parse_pdf(content: bytes, filename: str) -> ParsedDocument:
    """优先尝试文字提取，提取失败则标记为需要 OCR"""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        page_count = len(reader.pages)
        pages_text: list[str] = []

        for i, page in enumerate(reader.pages):
            extracted = page.extract_text() or ""
            if extracted.strip():
                pages_text.append(f"[第 {i + 1} 页]\n{extracted}")

        full_text = "\n\n".join(pages_text)

        # 如果提取文本过少（图片型 PDF），标记需要 OCR
        if len(full_text.strip()) < 100 and page_count > 0:
            return _fallback_ocr(content, filename, page_count)

        return ParsedDocument(
            text=full_text,
            doc_type="pdf_text",
            page_count=page_count,
            metadata={"filename": filename},
        )

    except Exception as e:
        logger.warning(f"PDF text extraction failed for {filename}: {e}")
        return _fallback_ocr(content, filename, 0)


def _fallback_ocr(content: bytes, filename: str, page_count: int) -> ParsedDocument:
    """
    图片型 PDF 的 OCR 处理
    当前实现：返回占位文本，实际 OCR 可接入 Tesseract 或第三方 API
    """
    logger.info(f"PDF {filename} appears to be image-based, OCR required")

    # TODO: 接入 Tesseract 或第三方 OCR API
    # import pytesseract
    # from pdf2image import convert_from_bytes
    # images = convert_from_bytes(content)
    # text = "\n\n".join(pytesseract.image_to_string(img, lang='chi_sim') for img in images)

    return ParsedDocument(
        text="[此文档为图片型 PDF，需要 OCR 处理]",
        doc_type="pdf_ocr",
        page_count=page_count,
        metadata={"filename": filename, "ocr_required": True},
    )

"""
文档解析器 — 支持 Markdown / PDF文字 / PDF图片(OCR)
直接使用 pypdf，无 LangChain 包装
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from .parser_models import ParseMode, ParseOptions, PageSignal

logger = logging.getLogger(__name__)


@dataclass
class ParsedDocument:
    text: str
    doc_type: str          # "markdown" | "pdf_text" | "pdf_ocr"
    page_count: int
    metadata: dict
    page_signals: list[PageSignal]
    parse_profile: dict


def parse_document(
    content: bytes, filename: str, options: ParseOptions | None = None
) -> ParsedDocument:
    """根据文件类型选择解析策略"""
    options = options or ParseOptions()
    filename_lower = filename.lower()

    if filename_lower.endswith((".md", ".markdown", ".txt")):
        return _parse_markdown(content, filename, options.mode)
    elif filename_lower.endswith(".pdf"):
        return _parse_pdf(content, filename, options)
    else:
        # 未知类型尝试作为文本处理
        return ParsedDocument(
            text=content.decode("utf-8", errors="ignore"),
            doc_type="plain_text",
            page_count=1,
            metadata={"filename": filename},
            page_signals=[],
            parse_profile={"mode": options.mode, "ocr_upgraded_pages": 0},
        )


def _parse_markdown(content: bytes, filename: str, mode: ParseMode) -> ParsedDocument:
    text = content.decode("utf-8", errors="ignore")
    return ParsedDocument(
        text=text,
        doc_type="markdown",
        page_count=1,
        metadata={"filename": filename},
        page_signals=[
            PageSignal(
                page_number=1,
                page_type="text_page",
                text_density=1.0 if text.strip() else 0.0,
                quality_score=1.0 if text.strip() else 0.0,
                extracted_chars=len(text),
            )
        ],
        parse_profile={"mode": mode, "ocr_upgraded_pages": 0},
    )


def _parse_pdf(content: bytes, filename: str, options: ParseOptions) -> ParsedDocument:
    """优先尝试文字提取，提取失败则标记为需要 OCR"""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        page_count = len(reader.pages)
        pages_text: list[str] = []
        page_signals: list[PageSignal] = []
        image_pages: list[int] = []

        for i, page in enumerate(reader.pages):
            extracted = page.extract_text() or ""
            cleaned = extracted.strip()
            density = min(1.0, len(cleaned) / 1200) if page_count > 0 else 0.0
            page_type = _classify_page(cleaned)
            quality_score = _estimate_quality_score(cleaned, page_type)
            page_signals.append(
                PageSignal(
                    page_number=i + 1,
                    page_type=page_type,
                    text_density=density,
                    quality_score=quality_score,
                    extracted_chars=len(cleaned),
                )
            )

            if cleaned:
                pages_text.append(f"[第 {i + 1} 页]\n{extracted}")
            if page_type == "image_page":
                image_pages.append(i + 1)

        full_text = "\n\n".join(pages_text)
        upgraded_pages = 0

        # 文本过少时，生成页面提示信息，避免直接空文本入库
        if len(full_text.strip()) < 100 and page_count > 0:
            fallback = _fallback_ocr(content, filename, page_count, options, page_signals)
            return fallback

        if image_pages and options.mode != "fast":
            top_pages = image_pages[: max(0, options.max_upgrade_pages)]
            upgraded_pages = len(top_pages)
            hint_lines = [f"[第 {p} 页] 此页为图像内容，建议按需触发视觉OCR精处理" for p in top_pages]
            if hint_lines:
                full_text = f"{full_text}\n\n" + "\n".join(hint_lines)

        return ParsedDocument(
            text=full_text,
            doc_type="pdf_text",
            page_count=page_count,
            metadata={"filename": filename},
            page_signals=page_signals,
            parse_profile={"mode": options.mode, "ocr_upgraded_pages": upgraded_pages},
        )

    except Exception as e:
        logger.warning(f"PDF text extraction failed for {filename}: {e}")
        return _fallback_ocr(content, filename, 0, options, [])


def _fallback_ocr(
    content: bytes,
    filename: str,
    page_count: int,
    options: ParseOptions,
    page_signals: list[PageSignal],
) -> ParsedDocument:
    """
    图片型 PDF 的 OCR 处理
    当前实现：返回占位文本 + 页级信号，实际 OCR 可接入外部服务。
    """
    logger.info(f"PDF {filename} appears to be image-based, OCR required")
    _ = content  # 预留给 OCR 接入，当前不使用

    return ParsedDocument(
        text=(
            "[此文档为图片型 PDF，当前仅完成轻量解析。"
            "如需更高质量数学/图表识别，请按需触发视觉 OCR 精处理。]"
        ),
        doc_type="pdf_ocr",
        page_count=page_count,
        metadata={"filename": filename, "ocr_required": True},
        page_signals=page_signals or _default_image_page_signals(page_count),
        parse_profile={"mode": options.mode, "ocr_upgraded_pages": 0},
    )


def _classify_page(extracted_text: str) -> str:
    chars = len(extracted_text.strip())
    if chars < 40:
        return "image_page"
    if chars < 220:
        return "mixed_page"
    return "text_page"


def _estimate_quality_score(extracted_text: str, page_type: str) -> float:
    chars = len(extracted_text.strip())
    if page_type == "image_page":
        return 0.2
    if page_type == "mixed_page":
        return min(0.7, 0.3 + chars / 1000)
    return min(0.98, 0.65 + chars / 2000)


def _default_image_page_signals(page_count: int) -> list[PageSignal]:
    pages = max(1, page_count)
    return [
        PageSignal(
            page_number=i + 1,
            page_type="image_page",
            text_density=0.0,
            quality_score=0.2,
            extracted_chars=0,
        )
        for i in range(pages)
    ]

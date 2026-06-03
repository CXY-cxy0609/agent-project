"""
文档解析器 — 支持 Markdown / PDF文字 / PDF图片(OCR)
直接使用 pypdf，无 LangChain 包装
"""

from __future__ import annotations

from dataclasses import dataclass

from ..document.extractors import extract_office_or_text
from ..document.models import DocumentAst, DocumentBlock, DocumentPage, FileAsset
from ..document.pdf import parse_pdf_document
from .parser_models import ParseMode, ParseOptions, PageSignal


@dataclass
class ParsedDocument:
    text: str
    doc_type: str          # "markdown" | "pdf_text" | "pdf_ocr"
    page_count: int
    metadata: dict
    page_signals: list[PageSignal]
    parse_profile: dict
    document: DocumentAst


def parse_document(
    content: bytes,
    filename: str,
    options: ParseOptions | None = None,
    mime_type: str | None = None,
) -> ParsedDocument:
    """根据文件类型选择解析策略"""
    options = options or ParseOptions()
    asset = FileAsset.from_bytes(content, filename, mime_type)
    filename_lower = filename.lower()

    if filename_lower.endswith((".md", ".markdown", ".txt")):
        return _parse_markdown(asset, options.mode)
    elif filename_lower.endswith(".pdf"):
        return _parse_pdf(asset, options)
    else:
        text, extracted_type = extract_office_or_text(content, filename)
        page_signal = PageSignal(
            page_number=1,
            page_type="text_page" if text.strip() else "image_page",
            text_density=1.0 if text.strip() else 0.0,
            quality_score=0.7 if text.strip() else 0.1,
            extracted_chars=len(text.strip()),
        )
        document = _build_text_document(
            text=text,
            asset=asset,
            doc_type=extracted_type,
            page_signals=[page_signal],
            markdown=extracted_type in {"html", "xlsx", "csv"},
        )
        return ParsedDocument(
            text=text,
            doc_type=extracted_type,
            page_count=1,
            metadata={"filename": filename},
            page_signals=[page_signal],
            parse_profile={"mode": options.mode, "ocr_upgraded_pages": 0},
            document=document,
        )


def _parse_markdown(asset: FileAsset, mode: ParseMode) -> ParsedDocument:
    text = asset.content.decode("utf-8", errors="ignore")
    page_signal = PageSignal(
        page_number=1,
        page_type="text_page",
        text_density=1.0 if text.strip() else 0.0,
        quality_score=1.0 if text.strip() else 0.0,
        extracted_chars=len(text),
    )
    document = _build_text_document(
        text=text,
        asset=asset,
        doc_type="markdown" if asset.filename.lower().endswith((".md", ".markdown")) else "plain_text",
        page_signals=[page_signal],
        markdown=True,
    )
    return ParsedDocument(
        text=text,
        doc_type=document.doc_type,
        page_count=1,
        metadata={"filename": asset.filename},
        page_signals=[page_signal],
        parse_profile={"mode": mode, "ocr_upgraded_pages": 0},
        document=document,
    )


def _parse_pdf(asset: FileAsset, options: ParseOptions) -> ParsedDocument:
    artifact = parse_pdf_document(asset, options)
    return ParsedDocument(
        text=artifact.document.plain_text(),
        doc_type=artifact.document.doc_type,
        page_count=len(artifact.document.pages),
        metadata=artifact.document.metadata,
        page_signals=artifact.page_signals,
        parse_profile=artifact.parse_profile,
        document=artifact.document,
    )


def _build_text_document(
    text: str,
    asset: FileAsset,
    doc_type: str,
    page_signals: list[PageSignal],
    markdown: bool = False,
) -> DocumentAst:
    blocks = _split_text_blocks(text, page_number=1, markdown=markdown)
    page = DocumentPage(
        page_number=1,
        page_type=page_signals[0].page_type,
        text_density=page_signals[0].text_density,
        quality_score=page_signals[0].quality_score,
        extracted_chars=page_signals[0].extracted_chars,
        block_ids=[block.block_id for block in blocks],
    )
    return DocumentAst(
        doc_type=doc_type,
        filename=asset.filename,
        content_hash=asset.content_hash,
        pages=[page],
        blocks=blocks,
        metadata={"filename": asset.filename},
    )


def _split_text_blocks(text: str, page_number: int, markdown: bool) -> list[DocumentBlock]:
    lines = text.splitlines()
    blocks: list[DocumentBlock] = []
    section_path: list[str] = []
    current: list[str] = []
    start_line = 1
    in_fence = False
    block_counter = 1

    def flush(end_line: int) -> None:
        nonlocal current, start_line, block_counter
        block_text = "\n".join(current).strip()
        if not block_text:
            current = []
            return
        block_type = _classify_block(block_text, markdown)
        blocks.append(
            DocumentBlock(
                block_id=f"p{page_number}-b{block_counter}",
                block_type=block_type,
                text=block_text,
                page_start=page_number,
                page_end=page_number,
                line_start=start_line,
                line_end=end_line,
                section_path=list(section_path),
                structured_payload=_structured_payload_for_block(block_text, block_type),
            )
        )
        block_counter += 1
        current = []

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip()
        stripped = line.strip()
        if markdown and stripped.startswith("```"):
            in_fence = not in_fence
        if markdown and stripped.startswith("#") and not in_fence:
            flush(idx - 1)
            heading = stripped.lstrip("#").strip()
            level = len(stripped) - len(stripped.lstrip("#"))
            section_path = section_path[: max(0, level - 1)] + [heading]
            blocks.append(
                DocumentBlock(
                    block_id=f"p{page_number}-b{block_counter}",
                    block_type="heading",
                    text=stripped,
                    page_start=page_number,
                    page_end=page_number,
                    line_start=idx,
                    line_end=idx,
                    section_path=list(section_path),
                    structured_payload={"heading_level": level, "heading_text": heading},
                )
            )
            block_counter += 1
            start_line = idx + 1
            continue
        if not stripped:
            flush(idx - 1)
            start_line = idx + 1
            continue
        if not current:
            start_line = idx
        current.append(line)

    flush(len(lines))
    return blocks


def _classify_block(text: str, markdown: bool) -> str:
    stripped = text.strip()
    if markdown and stripped.startswith("```"):
        return "code"
    if all(line.strip().startswith("|") and line.strip().endswith("|") for line in stripped.splitlines()):
        return "table"
    if stripped.startswith(("- ", "* ", "1. ")):
        return "list"
    if "$" in stripped or "\\(" in stripped or "\\[" in stripped:
        return "formula"
    return "paragraph"


def _structured_payload_for_block(text: str, block_type: str) -> dict:
    if block_type == "table":
        rows = [line for line in text.splitlines() if line.strip()]
        return {"row_count": len(rows), "format": "markdown_like"}
    if block_type == "code":
        first_line = text.splitlines()[0].strip()
        language = first_line.strip("`").strip() or None
        return {"language": language}
    return {}



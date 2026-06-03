from __future__ import annotations

from ..models import DocumentAst, DocumentBlock, DocumentPage, FileAsset, ParseArtifact
from ...indexer.parser_models import PageSignal, ParseOptions
from ...config import settings
from .formula_extractor import normalize_formula_block
from .image_extractor import describe_image_region, enrich_image_region
from .layout_analyzer import assign_columns, extract_page_layout
from .ocr_extractor import ocr_placeholder_text
from .page_triage import analyze_page
from .pdf_models import PdfPageAnalysis, PdfTextBlock
from .reading_order import order_blocks, remove_repeating_headers_footers
from .table_extractor import normalize_table_block
from .vision_client import vision_client


def parse_pdf_document(asset: FileAsset, options: ParseOptions) -> ParseArtifact:
    try:
        import fitz  # PyMuPDF
    except Exception as exc:  # pragma: no cover - environment dependent
        raise RuntimeError("PyMuPDF is required for enterprise PDF parsing") from exc

    doc = fitz.open(stream=asset.content, filetype="pdf")
    page_analyses: list[PdfPageAnalysis] = []
    raw_page_blocks: list[list[PdfTextBlock]] = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        page_number = page_index + 1
        width = float(page.rect.width)
        height = float(page.rect.height)
        text_blocks, image_regions = extract_page_layout(page, page_number)
        column_count = assign_columns(text_blocks, width)
        raw_page_blocks.append(text_blocks)
        analysis = analyze_page(
            page_number=page_number,
            width=width,
            height=height,
            text_blocks=text_blocks,
            image_regions=image_regions,
            column_count=column_count,
        )
        if analysis.vision_required:
            _attach_page_vision_summary(page, analysis)
        page_analyses.append(analysis)

    if page_analyses:
        remove_repeating_headers_footers(
            raw_page_blocks,
            page_height=max(page.height for page in page_analyses),
        )

    document_pages: list[DocumentPage] = []
    document_blocks: list[DocumentBlock] = []
    for analysis in page_analyses:
        page_blocks = _blocks_for_page(analysis)
        document_blocks.extend(page_blocks)
        document_pages.append(
            DocumentPage(
                page_number=analysis.page_number,
                page_type=analysis.page_type,
                text_density=analysis.text_density,
                quality_score=analysis.quality_score,
                extracted_chars=sum(len(block.text) for block in page_blocks),
                block_ids=[block.block_id for block in page_blocks],
                width=analysis.width,
                height=analysis.height,
            )
        )

    page_signals = [
        PageSignal(
            page_number=page.page_number,
            page_type="image_page"
            if page.page_type in {"image_page", "low_quality_page"}
            else ("mixed_page" if page.page_type == "mixed_page" else "text_page"),
            text_density=page.text_density,
            quality_score=page.quality_score,
            extracted_chars=page.extracted_chars,
        )
        for page in document_pages
    ]
    document = DocumentAst(
        doc_type="pdf",
        filename=asset.filename,
        content_hash=asset.content_hash,
        pages=document_pages,
        blocks=document_blocks,
        metadata={
            "filename": asset.filename,
            "parser": "pdf-document-understanding-v1",
            "page_count": doc.page_count,
        },
    )
    return ParseArtifact(
        document=document,
        page_signals=page_signals,
        parse_profile={
            "mode": options.mode,
            "parser": "pdf-document-understanding-v1",
            "page_count": doc.page_count,
            "ocr_upgraded_pages": 0,
            "image_pages": sum(1 for page in page_analyses if page.ocr_required),
            "vision_required_pages": sum(1 for page in page_analyses if page.vision_required),
        },
    )


def _attach_page_vision_summary(page, analysis: PdfPageAnalysis) -> None:
    result = vision_client.describe_page(
        image_png=_render_page_png(page),
        page_number=analysis.page_number,
        reason=analysis.page_type,
    )
    if not result:
        return
    analysis.text_blocks.append(
        PdfTextBlock(
            text=f"[第 {analysis.page_number} 页视觉摘要]\n{result.text}",
            bbox=[0.0, 0.0, analysis.width, analysis.height],
            page_number=analysis.page_number,
            block_type="image",
            column_id="single",
            confidence=result.confidence,
            structured_payload={
                "vision": {
                    "model": result.model,
                    "page_type": analysis.page_type,
                    "summary_type": "page_visual_understanding",
                }
            },
        )
    )


def _render_page_png(page) -> bytes:
    import fitz

    dpi = max(72, settings.vision_pdf_dpi)
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    return pixmap.tobytes("png")


def _blocks_for_page(analysis: PdfPageAnalysis) -> list[DocumentBlock]:
    blocks: list[DocumentBlock] = []
    ordered = order_blocks(analysis.text_blocks)
    for index, text_block in enumerate(ordered, start=1):
        normalized = _normalize_text_block(text_block)
        blocks.append(_document_block_from_text(analysis, normalized, index))

    image_start = len(blocks) + 1
    for offset, region in enumerate(analysis.image_regions, start=image_start):
        enriched = enrich_image_region(region)
        blocks.append(
            DocumentBlock(
                block_id=f"p{analysis.page_number}-img{offset}",
                block_type="image",
                text=describe_image_region(enriched, enriched.caption),
                page_start=analysis.page_number,
                page_end=analysis.page_number,
                section_path=[],
                confidence=enriched.confidence,
                bbox=enriched.bbox,
                structured_payload=enriched.structured_payload,
            )
        )

    if analysis.ocr_required and not analysis.text_blocks:
        blocks.append(
            DocumentBlock(
                block_id=f"p{analysis.page_number}-ocr-placeholder",
                block_type="image",
                text=ocr_placeholder_text(analysis.page_number, analysis.page_type),
                page_start=analysis.page_number,
                page_end=analysis.page_number,
                confidence=0.25,
                structured_payload={"ocr_required": True, "page_type": analysis.page_type},
            )
        )
    return blocks


def _normalize_text_block(block: PdfTextBlock) -> PdfTextBlock:
    if block.block_type == "table":
        block = normalize_table_block(block)
    if block.block_type == "formula":
        block = normalize_formula_block(block)
    return block


def _document_block_from_text(
    analysis: PdfPageAnalysis,
    block: PdfTextBlock,
    index: int,
) -> DocumentBlock:
    payload = {
        **block.structured_payload,
        "pdf": {
            "column_id": block.column_id,
            "reading_order": block.reading_order,
            "font_size": block.font_size,
            "page_type": analysis.page_type,
            "column_count": analysis.column_count,
            "is_header_footer": block.structured_payload.get("is_header_footer", False),
        },
    }
    return DocumentBlock(
        block_id=f"p{analysis.page_number}-b{index}",
        block_type=block.block_type,
        text=block.text,
        page_start=analysis.page_number,
        page_end=analysis.page_number,
        section_path=[],
        confidence=block.confidence,
        structured_payload=payload,
        bbox=block.bbox,
    )

from __future__ import annotations

from .layout_analyzer import formula_density
from .pdf_models import PdfImageRegion, PdfPageAnalysis, PdfPageType, PdfTextBlock


def analyze_page(
    page_number: int,
    width: float,
    height: float,
    text_blocks: list[PdfTextBlock],
    image_regions: list[PdfImageRegion],
    column_count: int,
) -> PdfPageAnalysis:
    text = "\n".join(block.text for block in text_blocks)
    extracted_chars = len(text.strip())
    page_area = max(1.0, width * height)
    image_area_ratio = sum(_area(region.bbox) for region in image_regions) / page_area
    table_blocks = [block for block in text_blocks if block.block_type == "table"]
    table_line_density = len(table_blocks) / max(1, len(text_blocks))
    formula_score = formula_density(text)
    text_density = min(1.0, extracted_chars / 1500)

    page_type = _classify_page(
        extracted_chars=extracted_chars,
        image_area_ratio=image_area_ratio,
        table_line_density=table_line_density,
        formula_density_value=formula_score,
        column_count=column_count,
    )
    quality_score = _quality_score(page_type, text_density, image_area_ratio)
    return PdfPageAnalysis(
        page_number=page_number,
        width=width,
        height=height,
        page_type=page_type,
        text_density=text_density,
        image_area_ratio=image_area_ratio,
        table_line_density=table_line_density,
        formula_density=formula_score,
        column_count=column_count,
        quality_score=quality_score,
        ocr_required=page_type in {"image_page", "low_quality_page"},
        vision_required=page_type in {"image_page", "mixed_page", "chart_page", "formula_dense_page"},
        text_blocks=text_blocks,
        image_regions=image_regions,
    )


def _classify_page(
    extracted_chars: int,
    image_area_ratio: float,
    table_line_density: float,
    formula_density_value: float,
    column_count: int,
) -> PdfPageType:
    if extracted_chars < 40 and image_area_ratio > 0.2:
        return "image_page"
    if extracted_chars < 120:
        return "low_quality_page"
    if table_line_density >= 0.25:
        return "table_dense_page"
    if formula_density_value >= 0.18:
        return "formula_dense_page"
    if column_count >= 2:
        return "multi_column_text_page"
    if image_area_ratio >= 0.35:
        return "mixed_page"
    return "text_page"


def _quality_score(page_type: PdfPageType, text_density: float, image_area_ratio: float) -> float:
    if page_type == "image_page":
        return 0.25
    if page_type == "low_quality_page":
        return 0.35
    if page_type == "mixed_page":
        return min(0.75, 0.45 + text_density * 0.3)
    if image_area_ratio > 0.4:
        return 0.65
    return min(0.98, 0.65 + text_density * 0.3)


def _area(bbox: list[float]) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])

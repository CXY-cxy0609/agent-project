from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

PdfPageType = Literal[
    "text_page",
    "multi_column_text_page",
    "table_dense_page",
    "image_page",
    "mixed_page",
    "formula_dense_page",
    "chart_page",
    "low_quality_page",
]


@dataclass
class PdfTextBlock:
    text: str
    bbox: list[float]
    page_number: int
    block_type: str = "paragraph"
    font_size: float | None = None
    column_id: str | None = None
    reading_order: int = 0
    confidence: float = 1.0
    structured_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class PdfImageRegion:
    image_id: str
    bbox: list[float]
    page_number: int
    width: int | None = None
    height: int | None = None
    image_hash: str | None = None
    caption: str = ""
    confidence: float = 0.5
    structured_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class PdfPageAnalysis:
    page_number: int
    width: float
    height: float
    page_type: PdfPageType
    text_density: float
    image_area_ratio: float
    table_line_density: float
    formula_density: float
    column_count: int
    quality_score: float
    ocr_required: bool
    vision_required: bool
    text_blocks: list[PdfTextBlock] = field(default_factory=list)
    image_regions: list[PdfImageRegion] = field(default_factory=list)

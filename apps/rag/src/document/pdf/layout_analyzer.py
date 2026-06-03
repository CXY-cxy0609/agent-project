from __future__ import annotations

import hashlib
import re
from typing import Any

from .pdf_models import PdfImageRegion, PdfTextBlock

FORMULA_RE = re.compile(r"(\\[a-zA-Z]+|[∫∑√∞≈≤≥→⇒]|[A-Za-z]\s*[\^_]\s*\{?[\w+-]+\}?|=)")


def extract_page_layout(page: Any, page_number: int) -> tuple[list[PdfTextBlock], list[PdfImageRegion]]:
    data = page.get_text("dict")
    text_blocks: list[PdfTextBlock] = []
    image_regions: list[PdfImageRegion] = []
    for raw_block in data.get("blocks", []):
        bbox = _bbox(raw_block.get("bbox"))
        if raw_block.get("type") == 0:
            text = _block_text(raw_block)
            if not text:
                continue
            text_blocks.append(
                PdfTextBlock(
                    text=text,
                    bbox=bbox,
                    page_number=page_number,
                    block_type=classify_text_block(text),
                    font_size=_average_font_size(raw_block),
                    structured_payload={"formula_density": formula_density(text)},
                )
            )
        elif raw_block.get("type") == 1:
            image_bytes = raw_block.get("image") or b""
            image_regions.append(
                PdfImageRegion(
                    image_id=f"p{page_number}-img{len(image_regions) + 1}",
                    bbox=bbox,
                    page_number=page_number,
                    width=raw_block.get("width"),
                    height=raw_block.get("height"),
                    image_hash=hashlib.sha1(image_bytes).hexdigest() if image_bytes else None,
                    structured_payload={"ext": raw_block.get("ext")},
                )
            )
    return text_blocks, image_regions


def assign_columns(blocks: list[PdfTextBlock], page_width: float) -> int:
    body_blocks = [block for block in blocks if block.text.strip()]
    if len(body_blocks) < 4:
        for block in body_blocks:
            block.column_id = "single"
        return 1

    centers = sorted(
        ((block.bbox[0] + block.bbox[2]) / 2, index, block)
        for index, block in enumerate(body_blocks)
    )
    gaps = [
        (centers[i + 1][0] - centers[i][0], i)
        for i in range(len(centers) - 1)
    ]
    large_gaps = [item for item in gaps if item[0] > page_width * 0.18]
    if not large_gaps:
        for _, _, block in centers:
            block.column_id = "single"
        return 1

    _, split_index = max(large_gaps, key=lambda item: item[0])
    split_x = (centers[split_index][0] + centers[split_index + 1][0]) / 2
    left_count = sum(1 for center, _, _ in centers if center < split_x)
    right_count = len(centers) - left_count
    if min(left_count, right_count) < max(2, len(centers) // 6):
        for _, _, block in centers:
            block.column_id = "single"
        return 1

    for center, _, block in centers:
        block.column_id = "left" if center < split_x else "right"
    return 2


def classify_text_block(text: str) -> str:
    stripped = text.strip()
    if looks_like_table(stripped):
        return "table"
    if formula_density(stripped) >= 0.12:
        return "formula"
    if stripped.startswith(("- ", "* ")) or re.match(r"^\d+[.)]\s+", stripped):
        return "list"
    return "paragraph"


def looks_like_table(text: str) -> bool:
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        return False
    aligned = 0
    for line in lines:
        if "|" in line or "\t" in line or re.search(r"\S+\s{2,}\S+\s{2,}\S+", line):
            aligned += 1
    return aligned / len(lines) >= 0.5


def formula_density(text: str) -> float:
    if not text.strip():
        return 0.0
    matches = FORMULA_RE.findall(text)
    return min(1.0, len(matches) / max(1, len(text.split())))


def _block_text(raw_block: dict) -> str:
    lines: list[str] = []
    for raw_line in raw_block.get("lines", []):
        spans = [span.get("text", "") for span in raw_line.get("spans", [])]
        line = "".join(spans).strip()
        if line:
            lines.append(line)
    return "\n".join(lines).strip()


def _average_font_size(raw_block: dict) -> float | None:
    sizes: list[float] = []
    for raw_line in raw_block.get("lines", []):
        for span in raw_line.get("spans", []):
            size = span.get("size")
            if isinstance(size, (int, float)):
                sizes.append(float(size))
    return sum(sizes) / len(sizes) if sizes else None


def _bbox(value: object) -> list[float]:
    if isinstance(value, (list, tuple)) and len(value) == 4:
        return [float(v) for v in value]
    return [0.0, 0.0, 0.0, 0.0]

from __future__ import annotations

from collections import Counter

from .pdf_models import PdfTextBlock


def remove_repeating_headers_footers(pages_blocks: list[list[PdfTextBlock]], page_height: float) -> None:
    candidates: Counter[str] = Counter()
    for blocks in pages_blocks:
        for block in blocks:
            if _is_margin_block(block, page_height):
                normalized = " ".join(block.text.split()).lower()
                if normalized:
                    candidates[normalized] += 1

    repeated = {text for text, count in candidates.items() if count >= max(2, len(pages_blocks) // 2)}
    for blocks in pages_blocks:
        for block in blocks:
            normalized = " ".join(block.text.split()).lower()
            if normalized in repeated:
                block.structured_payload["is_header_footer"] = True
                block.confidence = min(block.confidence, 0.3)


def order_blocks(blocks: list[PdfTextBlock]) -> list[PdfTextBlock]:
    visible = [
        block
        for block in blocks
        if not block.structured_payload.get("is_header_footer")
    ]
    spanning = [
        block
        for block in visible
        if block.column_id in (None, "single") or _is_wide_block(block)
    ]
    left = [block for block in visible if block.column_id == "left" and block not in spanning]
    right = [block for block in visible if block.column_id == "right" and block not in spanning]

    ordered = sorted(spanning, key=lambda b: (b.bbox[1], b.bbox[0]))
    if left or right:
        ordered = _merge_spanning_with_columns(spanning, left, right)

    for index, block in enumerate(ordered, start=1):
        block.reading_order = index
    return ordered


def _merge_spanning_with_columns(
    spanning: list[PdfTextBlock],
    left: list[PdfTextBlock],
    right: list[PdfTextBlock],
) -> list[PdfTextBlock]:
    top_spanning = [block for block in spanning if block.bbox[1] < _min_y(left + right)]
    rest_spanning = [block for block in spanning if block not in top_spanning]
    return (
        sorted(top_spanning, key=lambda b: (b.bbox[1], b.bbox[0]))
        + sorted(left, key=lambda b: (b.bbox[1], b.bbox[0]))
        + sorted(right, key=lambda b: (b.bbox[1], b.bbox[0]))
        + sorted(rest_spanning, key=lambda b: (b.bbox[1], b.bbox[0]))
    )


def _is_margin_block(block: PdfTextBlock, page_height: float) -> bool:
    y0, y1 = block.bbox[1], block.bbox[3]
    return y1 < page_height * 0.08 or y0 > page_height * 0.92


def _is_wide_block(block: PdfTextBlock) -> bool:
    width = block.bbox[2] - block.bbox[0]
    return width > 360


def _min_y(blocks: list[PdfTextBlock]) -> float:
    if not blocks:
        return 0.0
    return min(block.bbox[1] for block in blocks)

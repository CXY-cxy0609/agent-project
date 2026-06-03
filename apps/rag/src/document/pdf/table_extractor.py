from __future__ import annotations

import re

from .pdf_models import PdfTextBlock


def normalize_table_block(block: PdfTextBlock) -> PdfTextBlock:
    rows = [_split_row(line) for line in block.text.splitlines() if line.strip()]
    rows = [row for row in rows if len(row) >= 2]
    if len(rows) < 2:
        return block

    width = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (width - len(row)) for row in rows]
    header = normalized_rows[0]
    body = normalized_rows[1:]
    markdown = _to_markdown(header, body)
    block.text = markdown
    block.block_type = "table"
    block.structured_payload.update(
        {
            "table": {
                "headers": header,
                "rows": body,
                "row_count": len(body),
                "column_count": width,
                "format": "markdown",
            },
            "extractor": "pdf-table-text-align-v1",
        }
    )
    return block


def _split_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    if "|" in stripped:
        return [cell.strip() for cell in stripped.split("|")]
    if "\t" in stripped:
        return [cell.strip() for cell in stripped.split("\t")]
    return [cell.strip() for cell in re.split(r"\s{2,}", stripped) if cell.strip()]


def _to_markdown(header: list[str], rows: list[list[str]]) -> str:
    sep = ["---"] * len(header)
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(sep) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)

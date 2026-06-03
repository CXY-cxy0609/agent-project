from __future__ import annotations

import re

from .layout_analyzer import formula_density
from .pdf_models import PdfTextBlock

LATEX_HINT_RE = re.compile(r"\\(frac|sqrt|sum|int|lim|begin|alpha|beta|theta|pi)")


def normalize_formula_block(block: PdfTextBlock) -> PdfTextBlock:
    score = formula_density(block.text)
    if block.block_type != "formula" and score < 0.12:
        return block

    formula_type = _formula_type(block.text)
    latex = _best_effort_latex(block.text)
    block.block_type = "formula"
    block.structured_payload.update(
        {
            "formula": {
                "formula_type": formula_type,
                "raw_text": block.text,
                "latex": latex,
                "plain_text": _plain_formula_text(block.text),
                "confidence": min(0.9, 0.45 + score),
                "source": "pdf_text",
            },
            "extractor": "pdf-formula-text-v1",
        }
    )
    return block


def _formula_type(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) >= 2:
        return "derivation"
    if LATEX_HINT_RE.search(text):
        return "latex"
    if len(text) <= 80:
        return "inline_or_display"
    return "formula_context"


def _best_effort_latex(text: str) -> str:
    stripped = " ".join(text.split())
    replacements = {
        "≤": r"\le ",
        "≥": r"\ge ",
        "≈": r"\approx ",
        "∞": r"\infty ",
        "∑": r"\sum ",
        "∫": r"\int ",
        "√": r"\sqrt ",
        "→": r"\to ",
        "⇒": r"\Rightarrow ",
    }
    for source, target in replacements.items():
        stripped = stripped.replace(source, target)
    return stripped


def _plain_formula_text(text: str) -> str:
    return (
        text.replace("^", " 的上标 ")
        .replace("_", " 的下标 ")
        .replace("=", " 等于 ")
        .replace("≤", " 小于等于 ")
        .replace("≥", " 大于等于 ")
    )

from __future__ import annotations

import re

from .models import Chunk
from .tokenizer import count_tokens, split_text_by_tokens

PSEUDO_TABLE_PATTERN = re.compile(r"(\|)|(\s{2,}\S+\s{2,})")


def chunk_plain_text_content(
    text: str,
    base_metadata: dict,
    max_tokens: int,
    min_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    paragraphs = split_plain_paragraphs(text)
    chunks: list[Chunk] = []
    current_parts: list[str] = []

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if para_tokens > max_tokens:
            if current_parts:
                chunks.extend(_flush_group(current_parts, base_metadata))
                current_parts = []
            chunks.extend(
                _split_long_paragraph(
                    para=para,
                    metadata=base_metadata,
                    max_tokens=max_tokens,
                    overlap_ratio=overlap_ratio,
                )
            )
            continue

        candidate = "\n\n".join(current_parts + [para]).strip()
        if current_parts and count_tokens(candidate) > max_tokens:
            chunks.extend(_flush_group(current_parts, base_metadata))
            current_parts = [para]
            continue
        current_parts.append(para)

    if current_parts:
        chunks.extend(_flush_group(current_parts, base_metadata))

    return [chunk for chunk in chunks if chunk.token_count >= min_tokens]


def split_plain_paragraphs(text: str) -> list[str]:
    raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    normalized: list[str] = []
    for para in raw_paragraphs:
        if looks_like_broken_line_flow(para):
            normalized.append(" ".join(line.strip() for line in para.splitlines() if line.strip()))
        else:
            normalized.append(para)
    return normalized


def looks_like_broken_line_flow(paragraph: str) -> bool:
    lines = [line for line in paragraph.splitlines() if line.strip()]
    if len(lines) < 3:
        return False
    short_lines = sum(1 for line in lines if len(line) < 40)
    return short_lines / len(lines) >= 0.7 and not looks_like_table(paragraph)


def looks_like_table(paragraph: str) -> bool:
    lines = [line for line in paragraph.splitlines() if line.strip()]
    if len(lines) < 2:
        return False
    matched = sum(1 for line in lines if PSEUDO_TABLE_PATTERN.search(line))
    return matched / len(lines) >= 0.6


def _flush_group(parts: list[str], metadata: dict) -> list[Chunk]:
    text = "\n\n".join(parts).strip()
    if not text:
        return []
    return [
        Chunk(
            text=text,
            metadata={**metadata, "chunk_type": "paragraph_group"},
            token_count=count_tokens(text),
        )
    ]


def _split_long_paragraph(
    para: str, metadata: dict, max_tokens: int, overlap_ratio: float
) -> list[Chunk]:
    overlap_tokens = int(max_tokens * overlap_ratio)
    windows = split_text_by_tokens(para, max_tokens=max_tokens, overlap_tokens=overlap_tokens)
    chunk_type = "pseudo_table_window" if looks_like_table(para) else "paragraph_window"
    return [
        Chunk(
            text=window,
            metadata={**metadata, "chunk_type": chunk_type},
            token_count=count_tokens(window),
        )
        for window in windows
        if window.strip()
    ]

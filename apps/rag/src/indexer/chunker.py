"""
Chunker facade.
将实现拆分到 chunking 子模块，降低单文件复杂度并便于测试。
"""

from __future__ import annotations

from .chunking import Chunk, chunk_markdown as _chunk_markdown, chunk_plain_text as _chunk_plain_text, count_tokens
from ..config import settings


def chunk_markdown(
    text: str,
    base_metadata: dict,
    max_tokens: int | None = None,
    min_tokens: int | None = None,
    overlap_ratio: float | None = None,
) -> list[Chunk]:
    return _chunk_markdown(
        text=text,
        base_metadata=base_metadata,
        max_tokens=max_tokens or settings.max_chunk_size,
        min_tokens=min_tokens or settings.min_chunk_size,
        overlap_ratio=overlap_ratio or settings.chunk_overlap,
    )


def chunk_plain_text(
    text: str,
    base_metadata: dict,
    max_tokens: int | None = None,
    min_tokens: int | None = None,
    overlap_ratio: float | None = None,
) -> list[Chunk]:
    return _chunk_plain_text(
        text=text,
        base_metadata=base_metadata,
        max_tokens=max_tokens or settings.max_chunk_size,
        min_tokens=min_tokens or settings.min_chunk_size,
        overlap_ratio=overlap_ratio or settings.chunk_overlap,
    )

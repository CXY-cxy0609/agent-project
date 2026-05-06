from __future__ import annotations

from .markdown import chunk_markdown_text
from .merge import merge_short_chunks
from .models import Chunk
from .plain_text import chunk_plain_text_content


def chunk_markdown(
    text: str,
    base_metadata: dict,
    max_tokens: int,
    min_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    chunks = chunk_markdown_text(
        text=text,
        base_metadata=base_metadata,
        max_tokens=max_tokens,
        min_tokens=min_tokens,
        overlap_ratio=overlap_ratio,
    )
    return merge_short_chunks(chunks, min_tokens=min_tokens, max_tokens=max_tokens)


def chunk_plain_text(
    text: str,
    base_metadata: dict,
    max_tokens: int,
    min_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    chunks = chunk_plain_text_content(
        text=text,
        base_metadata=base_metadata,
        max_tokens=max_tokens,
        min_tokens=min_tokens,
        overlap_ratio=overlap_ratio,
    )
    return merge_short_chunks(chunks, min_tokens=min_tokens, max_tokens=max_tokens)

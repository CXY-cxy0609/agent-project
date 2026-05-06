from __future__ import annotations

from .models import Chunk
from .tokenizer import count_tokens


def merge_short_chunks(
    chunks: list[Chunk], min_tokens: int, max_tokens: int
) -> list[Chunk]:
    """
    双向合并短块：
    - 优先与后一个合并
    - 若后并不可行，尝试与前一个合并
    """
    if not chunks:
        return []

    merged = chunks[:]
    i = 0
    while i < len(merged):
        current = merged[i]
        if current.token_count >= min_tokens:
            i += 1
            continue

        merged_done = False
        if i + 1 < len(merged):
            nxt = merged[i + 1]
            text = f"{current.text}\n\n{nxt.text}"
            tokens = count_tokens(text)
            if tokens <= max_tokens:
                merged[i] = Chunk(
                    text=text,
                    metadata=_merge_metadata(current.metadata, nxt.metadata),
                    token_count=tokens,
                )
                del merged[i + 1]
                merged_done = True

        if merged_done:
            continue

        if i > 0:
            prev = merged[i - 1]
            text = f"{prev.text}\n\n{current.text}"
            tokens = count_tokens(text)
            if tokens <= max_tokens:
                merged[i - 1] = Chunk(
                    text=text,
                    metadata=_merge_metadata(prev.metadata, current.metadata),
                    token_count=tokens,
                )
                del merged[i]
                i = max(0, i - 1)
                continue

        i += 1

    return merged


def _merge_metadata(left: dict, right: dict) -> dict:
    result = {**left}
    for key, value in right.items():
        if key not in result or result[key] in (None, "", []):
            result[key] = value
            continue
        if result[key] != value and key == "chapter_title":
            result[key] = f"{result[key]} -> {value}"
    return result

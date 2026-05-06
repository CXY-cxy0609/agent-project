from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_tokenizer = None


def get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        try:
            import tiktoken

            _tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception as exc:
            logger.warning(
                f"tiktoken unavailable ({exc}), using character-based approximation"
            )
    return _tokenizer


def count_tokens(text: str) -> int:
    tokenizer = get_tokenizer()
    if tokenizer is not None:
        return len(tokenizer.encode(text))
    return max(1, len(text) // 4)


def split_text_by_tokens(text: str, max_tokens: int, overlap_tokens: int) -> list[str]:
    """
    将文本按 token 窗口切分。
    - 优先使用 tiktoken 的真实 token 切片
    - fallback 时按近似 token（字符）切片
    """
    if not text.strip():
        return []

    overlap_tokens = max(0, min(overlap_tokens, max_tokens - 1))
    step_tokens = max(1, max_tokens - overlap_tokens)
    tokenizer = get_tokenizer()

    if tokenizer is not None:
        token_ids = tokenizer.encode(text)
        if len(token_ids) <= max_tokens:
            return [text]

        windows: list[str] = []
        start = 0
        while start < len(token_ids):
            end = start + max_tokens
            piece = tokenizer.decode(token_ids[start:end]).strip()
            if piece:
                windows.append(piece)
            if end >= len(token_ids):
                break
            start += step_tokens
        return windows

    approx_chars_per_token = 4
    max_chars = max_tokens * approx_chars_per_token
    step_chars = step_tokens * approx_chars_per_token
    windows: list[str] = []
    start = 0
    while start < len(text):
        piece = text[start : start + max_chars].strip()
        if piece:
            windows.append(piece)
        if start + max_chars >= len(text):
            break
        start += step_chars
    return windows

"""
上下文构建器
① 上下文压缩 — 控制 token 总量
② 拼接片段 + Metadata（来源文档、章节、页码），注入 Prompt
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

MAX_CONTEXT_TOKENS = 3000


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def build_context(
    chunks: list[dict],
    max_tokens: int = MAX_CONTEXT_TOKENS,
    include_metadata: bool = True,
) -> str:
    """
    将 Rerank 后的 chunks 拼接成注入 Prompt 的上下文字符串
    超过 max_tokens 时截断，优先保留排名靠前的片段
    """
    if not chunks:
        return ""

    context_parts: list[str] = []
    used_tokens = 0

    for chunk in chunks:
        text = chunk.get("text", "")
        metadata = chunk.get("payload", {}) if "payload" in chunk else chunk
        chunk_tokens = _estimate_tokens(text)

        if used_tokens + chunk_tokens > max_tokens:
            remaining_tokens = max_tokens - used_tokens
            if remaining_tokens < 50:
                break
            # 截断过长片段
            approx_chars = remaining_tokens * 4
            text = text[:approx_chars] + "..."

        part = _format_chunk(text, metadata, include_metadata)
        context_parts.append(part)
        used_tokens += _estimate_tokens(part)

    return "\n\n---\n\n".join(context_parts)


def _format_chunk(text: str, metadata: dict, include_metadata: bool) -> str:
    if not include_metadata:
        return text

    source_parts: list[str] = []
    if metadata.get("doc_name"):
        source_parts.append(f"文档：{metadata['doc_name']}")
    if metadata.get("chapter_title"):
        source_parts.append(f"章节：{metadata['chapter_title']}")
    if metadata.get("page"):
        source_parts.append(f"页码：{metadata['page']}")

    if source_parts:
        source_line = f"[来源：{' | '.join(source_parts)}]"
        return f"{source_line}\n{text}"

    return text

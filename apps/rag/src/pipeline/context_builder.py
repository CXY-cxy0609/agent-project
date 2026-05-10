"""
上下文构建器
① 上下文压缩 — 控制 token 总量
② 拼接片段 + Metadata（来源文档、章节、页码），注入 Prompt
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

MAX_CONTEXT_TOKENS = 5000
MIN_SLICE_TOKENS = 50
SENTENCE_SPLIT_RE = re.compile(r"(?<=[。！？!?\.])\s+|\n+")
TOKEN_RE = re.compile(r"[\u4e00-\u9fff]{2,}|[a-zA-Z0-9_]{2,}")


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def build_context(
    chunks: list[dict],
    max_tokens: Optional[int] = None,
    include_metadata: bool = True,
    query: Optional[str] = None,
) -> str:
    """
    将 Rerank 后的 chunks 拼接成注入 Prompt 的上下文字符串
    超过 max_tokens 时截断，优先保留排名靠前的片段
    """
    if not chunks:
        return ""

    token_budget = max_tokens if isinstance(max_tokens, int) and max_tokens > 0 else MAX_CONTEXT_TOKENS
    query_terms = _extract_query_terms(query)
    ranked_chunks = sorted(
        chunks,
        key=lambda c: float(c.get("rerank_score", c.get("score", 0.0))),
        reverse=True,
    )

    context_parts: list[str] = []
    used_tokens = 0
    selected_chunks = 0

    for chunk in ranked_chunks:
        remaining_tokens = token_budget - used_tokens
        if remaining_tokens < MIN_SLICE_TOKENS:
            break

        text = chunk.get("text", "")
        metadata = chunk.get("payload", {}) if "payload" in chunk else chunk
        if not text.strip():
            continue

        # 预留 metadata 的 token 空间，避免把预算全部占满后 metadata 溢出
        metadata_tokens = (
            _estimate_tokens(_build_source_line(metadata)) + 4 if include_metadata else 0
        )
        text_budget = max(0, remaining_tokens - metadata_tokens)
        fitted_text = _fit_text_to_budget(text, text_budget, query_terms)
        if not fitted_text:
            continue

        part = _format_chunk(fitted_text, metadata, include_metadata)
        part_tokens = _estimate_tokens(part)

        # 兜底：若 metadata 导致预算超限，退化为纯文本再尝试一次
        if part_tokens > remaining_tokens and include_metadata:
            part = _format_chunk(fitted_text, metadata, include_metadata=False)
            part_tokens = _estimate_tokens(part)
        if part_tokens > remaining_tokens:
            continue

        context_parts.append(part)
        used_tokens += part_tokens
        selected_chunks += 1

    context = "\n\n---\n\n".join(context_parts)
    logger.info(
        "context_builder.done budget=%s used=%s selected_chunks=%s input_chunks=%s query_aware=%s",
        token_budget,
        used_tokens,
        selected_chunks,
        len(chunks),
        bool(query_terms),
    )
    return context


def _format_chunk(text: str, metadata: dict, include_metadata: bool) -> str:
    if not include_metadata:
        return text

    source_line = _build_source_line(metadata)
    if source_line:
        return f"{source_line}\n{text}"
    return text


def _build_source_line(metadata: dict) -> str:
    source_parts: list[str] = []
    if metadata.get("doc_name"):
        source_parts.append(f"文档：{metadata['doc_name']}")
    if metadata.get("chapter_title"):
        source_parts.append(f"章节：{metadata['chapter_title']}")
    if metadata.get("page"):
        source_parts.append(f"页码：{metadata['page']}")
    if not source_parts:
        return ""
    return f"[来源：{' | '.join(source_parts)}]"


def _extract_query_terms(query: Optional[str]) -> set[str]:
    if not query:
        return set()
    return {token.lower() for token in TOKEN_RE.findall(query)}


def _fit_text_to_budget(text: str, token_budget: int, query_terms: set[str]) -> str:
    normalized = text.strip()
    if not normalized or token_budget < MIN_SLICE_TOKENS:
        return ""
    if _estimate_tokens(normalized) <= token_budget:
        return normalized

    sentences = [s.strip() for s in SENTENCE_SPLIT_RE.split(normalized) if s.strip()]
    if not sentences:
        return _truncate_by_tokens(normalized, token_budget)

    # Query-aware 压缩：优先选与 query term 重合更高的句子
    indexed_scores = []
    for idx, sentence in enumerate(sentences):
        sentence_terms = {token.lower() for token in TOKEN_RE.findall(sentence)}
        overlap = len(sentence_terms & query_terms) if query_terms else 0
        indexed_scores.append((idx, overlap, sentence))

    if query_terms:
        indexed_scores.sort(key=lambda item: (item[1], -len(item[2])), reverse=True)
    else:
        indexed_scores.sort(key=lambda item: item[0])

    selected_indexes: list[int] = []
    used = 0
    for idx, overlap, sentence in indexed_scores:
        if query_terms and overlap == 0 and selected_indexes:
            continue
        sentence_tokens = _estimate_tokens(sentence) + 1
        if used + sentence_tokens > token_budget:
            continue
        selected_indexes.append(idx)
        used += sentence_tokens
        if used >= token_budget:
            break

    if not selected_indexes:
        return _truncate_by_tokens(normalized, token_budget)

    selected_indexes.sort()
    compact = " ".join(sentences[i] for i in selected_indexes).strip()
    if _estimate_tokens(compact) > token_budget:
        return _truncate_by_tokens(compact, token_budget)
    return compact


def _truncate_by_tokens(text: str, token_budget: int) -> str:
    if token_budget <= 0:
        return ""
    approx_chars = max(1, token_budget * 4)
    clipped = text[:approx_chars].strip()
    if not clipped:
        return ""
    if len(clipped) < len(text):
        clipped += "..."
    return clipped

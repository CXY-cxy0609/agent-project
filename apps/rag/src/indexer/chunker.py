"""
文本切分器 — 按技术文档规范实现的语义 Chunking
策略：
  1. 优先按标题/章节边界切分（保证语义完整性）
  2. 超出 maxChunkSize 时滑动窗口切分，保留 10% 重叠
  3. 过短的 Chunk（< minChunkSize tokens）与相邻合并
"""

import re
import logging
from dataclasses import dataclass

from ..config import settings

logger = logging.getLogger(__name__)

try:
    import tiktoken

    _tokenizer = tiktoken.get_encoding("cl100k_base")

    def count_tokens(text: str) -> int:
        return len(_tokenizer.encode(text))

except ImportError:
    logger.warning("tiktoken not available, using character-based approximation")

    def count_tokens(text: str) -> int:
        return len(text) // 4  # 粗略：4 字符 ≈ 1 token


@dataclass
class Chunk:
    text: str
    metadata: dict
    token_count: int


def chunk_markdown(
    text: str,
    base_metadata: dict,
    max_tokens: int | None = None,
    min_tokens: int | None = None,
    overlap_ratio: float | None = None,
) -> list[Chunk]:
    """
    按 Markdown 标题层级切分，超长段落滑动窗口切分
    """
    max_tokens = max_tokens or settings.max_chunk_size
    min_tokens = min_tokens or settings.min_chunk_size
    overlap_ratio = overlap_ratio or settings.chunk_overlap

    # 按标题边界拆分（## / ###）
    raw_sections = _split_by_headings(text)
    chunks: list[Chunk] = []

    for section_title, section_text in raw_sections:
        section_meta = {**base_metadata, "chapter_title": section_title}
        token_count = count_tokens(section_text)

        if token_count <= max_tokens:
            if token_count >= min_tokens:
                chunks.append(
                    Chunk(text=section_text, metadata=section_meta, token_count=token_count)
                )
        else:
            # 超长时滑动窗口切分
            sub_chunks = _sliding_window_split(
                section_text, section_meta, max_tokens, overlap_ratio
            )
            chunks.extend(sub_chunks)

    return _merge_short_chunks(chunks, min_tokens, max_tokens)


def chunk_plain_text(
    text: str,
    base_metadata: dict,
    max_tokens: int | None = None,
    min_tokens: int | None = None,
    overlap_ratio: float | None = None,
) -> list[Chunk]:
    """
    对纯文本（PDF 提取内容等）进行滑动窗口切分
    先按段落（空行）分割，再合并或拆分
    """
    max_tokens = max_tokens or settings.max_chunk_size
    min_tokens = min_tokens or settings.min_chunk_size
    overlap_ratio = overlap_ratio or settings.chunk_overlap

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[Chunk] = []
    current_parts: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)

        if current_tokens + para_tokens > max_tokens and current_parts:
            chunk_text = "\n\n".join(current_parts)
            if count_tokens(chunk_text) >= min_tokens:
                chunks.append(
                    Chunk(
                        text=chunk_text,
                        metadata={**base_metadata, "chunk_type": "paragraph_group"},
                        token_count=count_tokens(chunk_text),
                    )
                )
            # 重叠：保留最后一段
            overlap_parts = current_parts[-1:] if current_parts else []
            current_parts = overlap_parts + [para]
            current_tokens = sum(count_tokens(p) for p in current_parts)
        else:
            current_parts.append(para)
            current_tokens += para_tokens

    if current_parts:
        chunk_text = "\n\n".join(current_parts)
        if count_tokens(chunk_text) >= min_tokens:
            chunks.append(
                Chunk(
                    text=chunk_text,
                    metadata={**base_metadata, "chunk_type": "paragraph_group"},
                    token_count=count_tokens(chunk_text),
                )
            )

    return chunks


def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """按 Markdown 标题（## / ###）拆分为 (title, content) 对"""
    heading_pattern = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(text))

    if not matches:
        return [("", text)]

    sections: list[tuple[str, str]] = []
    # 标题前的内容
    if matches[0].start() > 0:
        sections.append(("", text[: matches[0].start()].strip()))

    for i, match in enumerate(matches):
        title = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if title or content:
            sections.append((title, f"{'#' * len(match.group(1))} {title}\n\n{content}"))

    return [(t, c) for t, c in sections if c.strip()]


def _sliding_window_split(
    text: str, metadata: dict, max_tokens: int, overlap_ratio: float
) -> list[Chunk]:
    """滑动窗口切分长文本"""
    words = text.split()
    overlap_tokens = int(max_tokens * overlap_ratio)
    step = max_tokens - overlap_tokens

    chunks: list[Chunk] = []
    start_word = 0

    while start_word < len(words):
        # 估算当前窗口的 token 数（以 words 粗估）
        end_word = start_word
        current_tokens = 0
        while end_word < len(words) and current_tokens < max_tokens:
            word_tokens = count_tokens(words[end_word])
            if current_tokens + word_tokens > max_tokens:
                break
            current_tokens += word_tokens
            end_word += 1

        chunk_text = " ".join(words[start_word:end_word])
        if chunk_text.strip():
            chunks.append(
                Chunk(
                    text=chunk_text,
                    metadata={**metadata, "chunk_type": "sliding_window"},
                    token_count=current_tokens,
                )
            )

        if end_word >= len(words):
            break
        # 向前移动 step 个 tokens
        step_words = max(1, step // 2)
        start_word += step_words

    return chunks


def _merge_short_chunks(
    chunks: list[Chunk], min_tokens: int, max_tokens: int
) -> list[Chunk]:
    """将过短的 Chunk 与相邻 Chunk 合并"""
    if not chunks:
        return []

    merged: list[Chunk] = []
    i = 0

    while i < len(chunks):
        chunk = chunks[i]
        if chunk.token_count < min_tokens and i + 1 < len(chunks):
            next_chunk = chunks[i + 1]
            merged_text = chunk.text + "\n\n" + next_chunk.text
            merged_tokens = count_tokens(merged_text)

            if merged_tokens <= max_tokens:
                merged.append(
                    Chunk(
                        text=merged_text,
                        metadata=chunk.metadata,
                        token_count=merged_tokens,
                    )
                )
                i += 2
                continue

        merged.append(chunk)
        i += 1

    return merged

from __future__ import annotations

import re

from .models import Chunk, TextBlock
from .tokenizer import count_tokens, split_text_by_tokens

HEADING_PATTERN = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
TABLE_ROW_PATTERN = re.compile(r"^\s*\|.*\|\s*$")


def chunk_markdown_text(
    text: str,
    base_metadata: dict,
    max_tokens: int,
    min_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    sections = split_by_headings(text)
    chunks: list[Chunk] = []

    for title, section_text in sections:
        section_meta = {**base_metadata, "chapter_title": title}
        blocks = split_markdown_blocks(section_text)
        section_chunks = compose_chunks_from_blocks(
            blocks=blocks,
            metadata=section_meta,
            max_tokens=max_tokens,
            overlap_ratio=overlap_ratio,
        )
        chunks.extend(c for c in section_chunks if c.token_count >= min_tokens)
    return chunks


def split_by_headings(text: str) -> list[tuple[str, str]]:
    """
    按 markdown 标题切分，同时规避 fenced code block 内的标题误判。
    """
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = [("", [])]
    current_title = ""
    in_fence = False

    for raw_line in lines:
        line = raw_line.rstrip("\n")
        if line.strip().startswith("```"):
            in_fence = not in_fence
        heading_match = HEADING_PATTERN.match(line)
        if heading_match and not in_fence:
            current_title = heading_match.group(2).strip()
            sections.append((current_title, [line]))
            continue
        sections[-1][1].append(line)

    result: list[tuple[str, str]] = []
    for title, body_lines in sections:
        body = "\n".join(body_lines).strip()
        if body:
            result.append((title, body))
    return result or [("", text)]


def split_markdown_blocks(section_text: str) -> list[TextBlock]:
    """
    将 markdown 段落拆成结构块，优先保护 code/table。
    """
    lines = section_text.splitlines()
    blocks: list[TextBlock] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped.startswith("```"):
            block_lines = [line]
            i += 1
            while i < len(lines):
                block_lines.append(lines[i])
                if lines[i].strip().startswith("```"):
                    i += 1
                    break
                i += 1
            blocks.append(TextBlock(text="\n".join(block_lines).strip(), block_type="code"))
            continue

        if TABLE_ROW_PATTERN.match(line):
            table_lines = [line]
            i += 1
            while i < len(lines) and TABLE_ROW_PATTERN.match(lines[i]):
                table_lines.append(lines[i])
                i += 1
            blocks.append(TextBlock(text="\n".join(table_lines).strip(), block_type="table"))
            continue

        para_lines = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if not nxt.strip():
                break
            if nxt.strip().startswith("```") or TABLE_ROW_PATTERN.match(nxt):
                break
            para_lines.append(nxt)
            i += 1
        blocks.append(TextBlock(text="\n".join(para_lines).strip(), block_type="paragraph"))
    return [b for b in blocks if b.text]


def compose_chunks_from_blocks(
    blocks: list[TextBlock],
    metadata: dict,
    max_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    chunks: list[Chunk] = []
    current_parts: list[str] = []

    def flush() -> None:
        if not current_parts:
            return
        text = "\n\n".join(current_parts).strip()
        if not text:
            return
        chunks.append(
            Chunk(
                text=text,
                metadata={**metadata, "chunk_type": "markdown_group"},
                token_count=count_tokens(text),
            )
        )
        current_parts.clear()

    for block in blocks:
        block_tokens = count_tokens(block.text)

        if block_tokens > max_tokens:
            flush()
            chunks.extend(
                split_large_block(
                    block=block,
                    metadata=metadata,
                    max_tokens=max_tokens,
                    overlap_ratio=overlap_ratio,
                )
            )
            continue

        candidate = "\n\n".join(current_parts + [block.text]).strip()
        if current_parts and count_tokens(candidate) > max_tokens:
            flush()
        current_parts.append(block.text)

    flush()
    return chunks


def split_large_block(
    block: TextBlock, metadata: dict, max_tokens: int, overlap_ratio: float
) -> list[Chunk]:
    if block.block_type == "table":
        return split_table_block(block.text, metadata, max_tokens)

    overlap_tokens = int(max_tokens * overlap_ratio)
    windows = split_text_by_tokens(block.text, max_tokens, overlap_tokens)
    return [
        Chunk(
            text=window,
            metadata={**metadata, "chunk_type": f"{block.block_type}_window"},
            token_count=count_tokens(window),
        )
        for window in windows
        if window
    ]


def split_table_block(text: str, metadata: dict, max_tokens: int) -> list[Chunk]:
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) <= 2:
        return [
            Chunk(
                text=text,
                metadata={**metadata, "chunk_type": "table"},
                token_count=count_tokens(text),
            )
        ]

    header = lines[:2]
    rows = lines[2:]
    chunks: list[Chunk] = []
    current_rows: list[str] = []

    for row in rows:
        candidate_rows = current_rows + [row]
        candidate_text = "\n".join(header + candidate_rows)
        if current_rows and count_tokens(candidate_text) > max_tokens:
            table_text = "\n".join(header + current_rows)
            chunks.append(
                Chunk(
                    text=table_text,
                    metadata={**metadata, "chunk_type": "table"},
                    token_count=count_tokens(table_text),
                )
            )
            current_rows = [row]
            continue
        current_rows = candidate_rows

    if current_rows:
        table_text = "\n".join(header + current_rows)
        chunks.append(
            Chunk(
                text=table_text,
                metadata={**metadata, "chunk_type": "table"},
                token_count=count_tokens(table_text),
            )
        )
    return chunks

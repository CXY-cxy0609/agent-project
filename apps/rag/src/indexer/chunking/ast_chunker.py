from __future__ import annotations

from collections import Counter

from ...document.models import DocumentAst, DocumentBlock
from .merge import merge_short_chunks
from .models import Chunk
from .tokenizer import count_tokens, split_text_by_tokens

STRUCTURAL_KEEP_TYPES = {"heading", "table", "code", "formula", "image", "question", "answer"}


def chunk_document_ast(
    document: DocumentAst,
    base_metadata: dict,
    max_tokens: int,
    min_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    blocks = [block for block in document.blocks if block.text.strip()]
    if not blocks:
        return []

    chunks: list[Chunk] = []
    current_blocks: list[DocumentBlock] = []
    current_parts: list[str] = []

    def flush() -> None:
        nonlocal current_blocks, current_parts
        if not current_parts:
            return
        text = "\n\n".join(current_parts).strip()
        if not text:
            current_blocks = []
            current_parts = []
            return
        chunks.append(
            Chunk(
                text=text,
                metadata=_metadata_for_blocks(
                    document=document,
                    base_metadata=base_metadata,
                    blocks=current_blocks,
                    chunk_type="semantic",
                ),
                token_count=count_tokens(text),
            )
        )
        current_blocks = []
        current_parts = []

    for block in blocks:
        block_tokens = count_tokens(block.text)
        if block_tokens > max_tokens:
            flush()
            chunks.extend(
                _split_large_block(
                    document=document,
                    block=block,
                    base_metadata=base_metadata,
                    max_tokens=max_tokens,
                    overlap_ratio=overlap_ratio,
                )
            )
            continue

        candidate = "\n\n".join(current_parts + [block.text]).strip()
        if current_parts and count_tokens(candidate) > max_tokens:
            flush()
        current_blocks.append(block)
        current_parts.append(block.text)

    flush()

    merged = merge_short_chunks(chunks, min_tokens=min_tokens, max_tokens=max_tokens)
    return [
        chunk
        for chunk in merged
        if chunk.token_count >= min_tokens or _must_keep_chunk(chunk)
    ]


def _split_large_block(
    document: DocumentAst,
    block: DocumentBlock,
    base_metadata: dict,
    max_tokens: int,
    overlap_ratio: float,
) -> list[Chunk]:
    if block.block_type == "table":
        return _split_table_block(document, block, base_metadata, max_tokens)

    overlap_tokens = int(max_tokens * overlap_ratio)
    windows = split_text_by_tokens(block.text, max_tokens=max_tokens, overlap_tokens=overlap_tokens)
    return [
        Chunk(
            text=window,
            metadata=_metadata_for_blocks(
                document=document,
                base_metadata=base_metadata,
                blocks=[block],
                chunk_type=f"{block.block_type}_window",
            ),
            token_count=count_tokens(window),
        )
        for window in windows
        if window.strip()
    ]


def _split_table_block(
    document: DocumentAst,
    block: DocumentBlock,
    base_metadata: dict,
    max_tokens: int,
) -> list[Chunk]:
    lines = [line for line in block.text.splitlines() if line.strip()]
    if len(lines) <= 2:
        return [
            Chunk(
                text=block.text,
                metadata=_metadata_for_blocks(document, base_metadata, [block], "table"),
                token_count=count_tokens(block.text),
            )
        ]

    header = _detect_table_header(lines)
    rows = lines[len(header):]
    chunks: list[Chunk] = []
    current_rows: list[str] = []

    for row in rows:
        candidate_rows = current_rows + [row]
        candidate_text = "\n".join(header + candidate_rows)
        if current_rows and count_tokens(candidate_text) > max_tokens:
            chunks.append(_table_chunk(document, base_metadata, block, header, current_rows))
            current_rows = [row]
            continue
        current_rows = candidate_rows

    if current_rows:
        chunks.append(_table_chunk(document, base_metadata, block, header, current_rows))
    return chunks


def _table_chunk(
    document: DocumentAst,
    base_metadata: dict,
    block: DocumentBlock,
    header: list[str],
    rows: list[str],
) -> Chunk:
    text = "\n".join(header + rows)
    return Chunk(
        text=text,
        metadata=_metadata_for_blocks(document, base_metadata, [block], "table"),
        token_count=count_tokens(text),
    )


def _detect_table_header(lines: list[str]) -> list[str]:
    if len(lines) >= 2 and set(lines[1].replace("|", "").strip()) <= {"-", ":", " "}:
        return lines[:2]
    return lines[:1]


def _metadata_for_blocks(
    document: DocumentAst,
    base_metadata: dict,
    blocks: list[DocumentBlock],
    chunk_type: str,
) -> dict:
    page_start = min(block.page_start for block in blocks)
    page_end = max(block.page_end for block in blocks)
    block_types = Counter(block.block_type for block in blocks)
    section_path = _dominant_section_path(blocks)
    metadata = {
        **base_metadata,
        "chunker_version": "ast-v2",
        "chunk_type": chunk_type,
        "source_filename": document.filename,
        "source_content_hash": document.content_hash,
        "page": page_start,
        "page_start": page_start,
        "page_end": page_end,
        "block_ids": [block.block_id for block in blocks],
        "block_types": dict(block_types),
        "section_path": section_path,
        "chapter_title": " / ".join(section_path),
        "quality_flags": _quality_flags(blocks),
    }
    if len(blocks) == 1:
        metadata["source_block_type"] = blocks[0].block_type
        metadata["structured_payload"] = blocks[0].structured_payload
    return metadata


def _dominant_section_path(blocks: list[DocumentBlock]) -> list[str]:
    paths = [tuple(block.section_path) for block in blocks if block.section_path]
    if not paths:
        return []
    return list(Counter(paths).most_common(1)[0][0])


def _quality_flags(blocks: list[DocumentBlock]) -> list[str]:
    flags: set[str] = set()
    for block in blocks:
        if block.confidence < 0.5:
            flags.add("low_confidence")
        if block.structured_payload.get("ocr_required"):
            flags.add("ocr_required")
    return sorted(flags)


def _must_keep_chunk(chunk: Chunk) -> bool:
    source_type = chunk.metadata.get("source_block_type")
    if source_type in STRUCTURAL_KEEP_TYPES:
        return True
    block_types = chunk.metadata.get("block_types")
    if isinstance(block_types, dict):
        return any(block_type in STRUCTURAL_KEEP_TYPES for block_type in block_types)
    return False

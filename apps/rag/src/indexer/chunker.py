"""
Chunker facade.
RAG 入库统一基于 Document AST 切分，不再保留旧的 markdown/plain text 兼容路径。
"""

from __future__ import annotations

from ..document.models import DocumentAst
from .chunking import Chunk
from .chunking.ast_chunker import chunk_document_ast
from ..config import settings


def chunk_document(
    document: DocumentAst,
    base_metadata: dict,
    max_tokens: int | None = None,
    min_tokens: int | None = None,
    overlap_ratio: float | None = None,
) -> list[Chunk]:
    return chunk_document_ast(
        document=document,
        base_metadata=base_metadata,
        max_tokens=max_tokens or settings.max_chunk_size,
        min_tokens=min_tokens or settings.min_chunk_size,
        overlap_ratio=overlap_ratio or settings.chunk_overlap,
    )

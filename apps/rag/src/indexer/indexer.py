"""
IndexerService — 文档解析、Chunking、向量化、写入向量数据库的完整 Pipeline
"""

from __future__ import annotations

import hashlib
import uuid
import logging
from typing import Optional

from ..config import settings
from ..embedder.embedder import embedding_service
from .document_parser import parse_document
from .chunker import chunk_markdown, chunk_plain_text
from .vector_store import upsert_chunks

logger = logging.getLogger(__name__)


class IndexerService:
    async def index_document(
        self,
        content: bytes,
        filename: str,
        tenant_id: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        doc_id: Optional[str] = None,
        doc_version: Optional[int] = None,
    ) -> dict:
        """完整的文档入库 Pipeline：解析 → 切分 → 向量化 → 写入"""
        doc_id = doc_id or str(uuid.uuid4())

        parsed = parse_document(content, filename)
        return await self._process_text(
            text=parsed.text,
            doc_type=parsed.doc_type,
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
            doc_name=doc_name,
            doc_id=doc_id,
            doc_version=doc_version or settings.default_doc_version,
            page_count=parsed.page_count,
        )

    async def index_text(
        self,
        text: str,
        tenant_id: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        doc_id: Optional[str] = None,
        doc_version: Optional[int] = None,
    ) -> dict:
        """直接对文本做入库处理"""
        doc_id = doc_id or str(uuid.uuid4())
        return await self._process_text(
            text=text,
            doc_type="markdown",
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
            doc_name=doc_name,
            doc_id=doc_id,
            doc_version=doc_version or settings.default_doc_version,
        )

    async def _process_text(
        self,
        text: str,
        doc_type: str,
        tenant_id: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        doc_id: str,
        doc_version: int,
        page_count: int = 1,
    ) -> dict:
        doc_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()
        base_metadata = {
            "tenant_id": tenant_id,
            "doc_id": doc_id,
            "doc_version": doc_version,
            "doc_hash": doc_hash,
            "doc_name": doc_name,
            "knowledge_base_id": knowledge_base_id,
            "subject_id": subject_id,
            "doc_type": doc_type,
        }

        # 根据文档类型选择切分策略
        if doc_type == "markdown":
            chunks = chunk_markdown(text, base_metadata)
        else:
            chunks = chunk_plain_text(text, base_metadata)

        if not chunks:
            logger.warning(f"No chunks generated for doc {doc_id}")
            return {"doc_id": doc_id, "chunks": 0, "status": "empty"}

        # 批量向量化
        chunk_texts = [c.text for c in chunks]
        vectors = embedding_service.embed_batch(chunk_texts)

        # 构建 payload（含 chunk 级别元数据）
        payloads = []
        for i, c in enumerate(chunks):
            chunk_hash = hashlib.sha1(c.text.encode("utf-8")).hexdigest()
            payload = {**c.metadata, "chunk_index": i, "token_count": c.token_count}
            if settings.enable_chunk_idempotency:
                payload["chunk_key"] = f"{tenant_id}:{doc_id}:{doc_version}:{i}:{chunk_hash}"
            payloads.append(payload)

        # 写入向量数据库
        upsert_chunks(
            collection_name=settings.qdrant_collection,
            chunks=chunk_texts,
            vectors=vectors,
            payloads=payloads,
        )

        logger.info(f"Indexed doc {doc_id}: {len(chunks)} chunks")
        return {
            "tenant_id": tenant_id,
            "doc_id": doc_id,
            "doc_version": doc_version,
            "chunks": len(chunks),
            "status": "indexed",
        }

    async def delete_document(self, tenant_id: str, knowledge_base_id: str, doc_id: str) -> None:
        from .vector_store import delete_by_filter

        delete_by_filter(
            collection_name=settings.qdrant_collection,
            filter_conditions={
                "tenant_id": tenant_id,
                "knowledge_base_id": knowledge_base_id,
                "doc_id": doc_id,
            },
        )


indexer_service = IndexerService()

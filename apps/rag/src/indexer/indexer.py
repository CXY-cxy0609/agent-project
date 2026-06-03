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
from .document_parser import ParsedDocument, parse_document
from .chunker import chunk_document
from .parser_models import ParseOptions
from .vector_store import delete_by_filter, upsert_chunks

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
        visibility: str = "public",
        owner_user_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        doc_version: Optional[int] = None,
        parse_options: ParseOptions | None = None,
        mime_type: str | None = None,
    ) -> dict:
        """完整的文档入库 Pipeline：解析 → 切分 → 向量化 → 写入"""
        doc_id = doc_id or str(uuid.uuid4())

        parsed = parse_document(content, filename, options=parse_options, mime_type=mime_type)
        return await self._process_document(
            parsed_document=parsed,
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
            doc_name=doc_name,
            visibility=visibility,
            owner_user_id=owner_user_id,
            doc_id=doc_id,
            doc_version=doc_version or settings.default_doc_version,
        )

    async def index_text(
        self,
        text: str,
        tenant_id: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        visibility: str = "public",
        owner_user_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        doc_version: Optional[int] = None,
    ) -> dict:
        """直接对文本做入库处理"""
        doc_id = doc_id or str(uuid.uuid4())
        parsed = parse_document(
            text.encode("utf-8"),
            f"{doc_name}.md" if not doc_name.lower().endswith((".md", ".markdown", ".txt")) else doc_name,
        )
        return await self._process_document(
            parsed_document=parsed,
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
            doc_name=doc_name,
            visibility=visibility,
            owner_user_id=owner_user_id,
            doc_id=doc_id,
            doc_version=doc_version or settings.default_doc_version,
        )

    async def _process_document(
        self,
        parsed_document: ParsedDocument,
        tenant_id: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        visibility: str,
        owner_user_id: Optional[str],
        doc_id: str,
        doc_version: int,
    ) -> dict:
        text = parsed_document.text
        doc_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()
        base_metadata = {
            "tenant_id": tenant_id,
            "doc_id": doc_id,
            "doc_version": doc_version,
            "doc_hash": doc_hash,
            "doc_name": doc_name,
            "knowledge_base_id": knowledge_base_id,
            "subject_id": subject_id,
            "visibility": visibility if visibility in {"public", "private"} else "public",
            "owner_user_id": owner_user_id,
            "doc_type": parsed_document.doc_type,
            "page_count": parsed_document.page_count,
            "source_filename": parsed_document.metadata.get("filename"),
            "parser_mode": parsed_document.parse_profile.get("mode"),
            "parser_version": "document-parser-v2",
            "parse_profile": parsed_document.parse_profile,
            "page_signals": [signal.__dict__ for signal in parsed_document.page_signals],
        }

        chunks = chunk_document(parsed_document.document, base_metadata)

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
            chunk_key = f"{tenant_id}:{knowledge_base_id}:{doc_id}:{doc_version}:{i}:{chunk_hash}"
            payload = {
                **c.metadata,
                "chunk_id": hashlib.sha1(chunk_key.encode("utf-8")).hexdigest(),
                "chunk_index": i,
                "chunk_hash": chunk_hash,
                "token_count": c.token_count,
            }
            if settings.enable_chunk_idempotency:
                payload["chunk_key"] = chunk_key
            payloads.append(payload)

        if settings.enable_chunk_idempotency:
            delete_by_filter(
                collection_name=settings.qdrant_collection,
                filter_conditions={
                    "tenant_id": tenant_id,
                    "knowledge_base_id": knowledge_base_id,
                    "doc_id": doc_id,
                    "doc_version": doc_version,
                },
            )

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
            "parse_profile": parsed_document.parse_profile,
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

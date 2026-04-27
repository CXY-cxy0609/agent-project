"""
Memory Service — 向量记忆接口
① 用户级向量记忆（UserVectorMemory）：以 userId 为 scope
② 内容级向量缓存（ContentVectorCache）：全局共享，Video Agent 使用
"""

import uuid
import logging
from dataclasses import dataclass
from typing import Optional

from ..config import settings
from ..embedder.embedder import embedding_service
from ..indexer.vector_store import ensure_collection, upsert_chunks, search, delete_by_filter

logger = logging.getLogger(__name__)


@dataclass
class MemorySearchResult:
    content: str
    score: float
    payload: Optional[dict] = None


class UserMemoryService:
    """用户级向量记忆 — 以 userId 隔离"""

    def search(self, query: str, user_id: str, top_k: int) -> list[MemorySearchResult]:
        query_vector = embedding_service.embed_one(query)
        hits = search(
            collection_name=settings.qdrant_user_memory_collection,
            query_vector=query_vector,
            top_k=top_k,
            filter_conditions={"user_id": user_id},
        )
        return [
            MemorySearchResult(
                content=hit.payload.get("text", "") if hit.payload else "",
                score=hit.score,
                payload=hit.payload,
            )
            for hit in hits
        ]

    def store(self, user_id: str, content: str) -> None:
        ensure_collection(settings.qdrant_user_memory_collection)
        vector = embedding_service.embed_one(content)
        upsert_chunks(
            collection_name=settings.qdrant_user_memory_collection,
            chunks=[content],
            vectors=[vector],
            payloads=[{"user_id": user_id}],
        )


class ContentCacheService:
    """内容级向量缓存 — 全局共享，Video Agent 查询已有视频"""

    def search(self, query: str, top_k: int) -> list[MemorySearchResult]:
        query_vector = embedding_service.embed_one(query)
        try:
            hits = search(
                collection_name=settings.qdrant_video_cache_collection,
                query_vector=query_vector,
                top_k=top_k,
            )
            return [
                MemorySearchResult(
                    content=hit.payload.get("content_key", "") if hit.payload else "",
                    score=hit.score,
                    payload=hit.payload,
                )
                for hit in hits
            ]
        except Exception:
            return []

    def store(self, content: str, payload: dict) -> None:
        ensure_collection(settings.qdrant_video_cache_collection)
        vector = embedding_service.embed_one(content)
        upsert_chunks(
            collection_name=settings.qdrant_video_cache_collection,
            chunks=[content],
            vectors=[vector],
            payloads=[{"content_key": content, **payload}],
        )


user_memory_service = UserMemoryService()
content_cache_service = ContentCacheService()

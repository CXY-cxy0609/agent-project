"""
向量数据库操作 — 直接使用 qdrant-client，无 LangChain 包装
封装 Qdrant 的 upsert / search / delete 操作
"""

from __future__ import annotations

import hashlib
import logging
import threading
import uuid
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PayloadSchemaType,
    VectorParams,
    PointStruct,
    Filter,
    FilterSelector,
    FieldCondition,
    MatchAny,
    MatchValue,
    ScoredPoint,
)

from ..config import settings

logger = logging.getLogger(__name__)
PAYLOAD_INDEX_FIELDS = {
    "tenant_id": PayloadSchemaType.KEYWORD,
    "knowledge_base_id": PayloadSchemaType.KEYWORD,
    "doc_id": PayloadSchemaType.KEYWORD,
    "doc_version": PayloadSchemaType.INTEGER,
    "visibility": PayloadSchemaType.KEYWORD,
    "owner_user_id": PayloadSchemaType.KEYWORD,
    "subject_id": PayloadSchemaType.KEYWORD,
    "chunk_type": PayloadSchemaType.KEYWORD,
    "page_start": PayloadSchemaType.INTEGER,
}

_client_lock = threading.Lock()
_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is None:
            _client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None,
            )
    return _client


def qdrant_health_check() -> bool:
    try:
        _get_client().get_collections()
        return True
    except Exception:
        return False


def ensure_collection(collection_name: str, vector_size: int | None = None) -> None:
    """确保 Collection 存在，不存在则创建"""
    client = _get_client()
    size = vector_size or settings.embedding_dimension

    existing = {c.name for c in client.get_collections().collections}
    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE),
        )
        logger.info(f"Created collection: {collection_name}")
    _ensure_payload_indexes(client, collection_name)


def upsert_chunks(
    collection_name: str,
    chunks: list[str],
    vectors: list[list[float]],
    payloads: list[dict],
) -> int:
    """批量写入 chunks 到向量数据库"""
    client = _get_client()
    ensure_collection(collection_name)

    points = [
        PointStruct(
            id=_resolve_point_id(payload),
            vector=vector,
            payload={**payload, "text": chunk},
        )
        for chunk, vector, payload in zip(chunks, vectors, payloads)
    ]

    client.upsert(collection_name=collection_name, points=points)
    return len(points)


def search(
    collection_name: str,
    query_vector: list[float],
    top_k: int,
    filter_conditions: Optional[dict] = None,
) -> list[ScoredPoint]:
    """向量相似度检索"""
    client = _get_client()

    qdrant_filter = None
    if filter_conditions:
        must_conditions = []
        for key, value in filter_conditions.items():
            if value is None:
                continue
            if isinstance(value, list):
                if value:
                    must_conditions.append(FieldCondition(key=key, match=MatchAny(any=value)))
            else:
                must_conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))
        if must_conditions:
            qdrant_filter = Filter(must=must_conditions)

    response = client.query_points(
        collection_name=collection_name,
        query=query_vector,
        limit=top_k,
        query_filter=qdrant_filter,
        with_payload=True,
    )

    return list(response.points)


def delete_by_filter(collection_name: str, filter_conditions: dict) -> None:
    """按 payload filter 删除记录"""
    client = _get_client()
    existing = {c.name for c in client.get_collections().collections}
    if collection_name not in existing:
        return
    must_conditions = [
        FieldCondition(key=k, match=MatchValue(value=v))
        for k, v in filter_conditions.items()
        if v is not None
    ]

    client.delete(
        collection_name=collection_name,
        points_selector=FilterSelector(filter=Filter(must=must_conditions)),
    )


def _resolve_point_id(payload: dict) -> str:
    chunk_key = payload.get("chunk_key")
    if chunk_key:
        digest = hashlib.sha1(str(chunk_key).encode("utf-8")).hexdigest()
        return str(uuid.UUID(digest[:32]))
    return str(uuid.uuid4())


def _ensure_payload_indexes(client: QdrantClient, collection_name: str) -> None:
    for field_name, schema in PAYLOAD_INDEX_FIELDS.items():
        try:
            client.create_payload_index(
                collection_name=collection_name,
                field_name=field_name,
                field_schema=schema,
            )
        except Exception:
            # Qdrant returns an error when an index already exists; keep startup idempotent.
            continue

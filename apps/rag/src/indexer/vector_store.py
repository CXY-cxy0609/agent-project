"""
向量数据库操作 — 直接使用 qdrant-client，无 LangChain 包装
封装 Qdrant 的 upsert / search / delete 操作
"""

import uuid
import logging
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FilterSelector,
    FieldCondition,
    MatchValue,
    ScoredPoint,
)

from ..config import settings

logger = logging.getLogger(__name__)


def _get_client() -> QdrantClient:
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
    )


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
            id=str(uuid.uuid4()),
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
        must_conditions = [
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in filter_conditions.items()
            if v is not None
        ]
        if must_conditions:
            qdrant_filter = Filter(must=must_conditions)

    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=top_k,
        query_filter=qdrant_filter,
        with_payload=True,
    )

    return results


def delete_by_filter(collection_name: str, filter_conditions: dict) -> None:
    """按 payload filter 删除记录"""
    client = _get_client()
    must_conditions = [
        FieldCondition(key=k, match=MatchValue(value=v))
        for k, v in filter_conditions.items()
        if v is not None
    ]

    client.delete(
        collection_name=collection_name,
        points_selector=FilterSelector(filter=Filter(must=must_conditions)),
    )

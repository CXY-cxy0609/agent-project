"""
Embedding 服务 — 使用 sentence-transformers 直接调用，无 LangChain 包装
支持 Redis embedding 缓存，避免重复计算
"""

import hashlib
import json
import logging
from typing import Optional

from sentence_transformers import SentenceTransformer

from ..config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self) -> None:
        self._model: Optional[SentenceTransformer] = None
        self._redis = None

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            self._model = SentenceTransformer(
                settings.embedding_model,
                device="cpu",
            )
        return self._model

    def _get_redis(self):
        if self._redis is None:
            try:
                import redis

                self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                logger.warning("Redis not available, embedding cache disabled")
                self._redis = None
        return self._redis

    def _cache_key(self, text: str) -> str:
        return f"embed:{hashlib.md5(text.encode()).hexdigest()}"

    def embed_one(self, text: str) -> list[float]:
        """对单个文本做向量化（含缓存）"""
        r = self._get_redis()
        if r:
            try:
                cached = r.get(self._cache_key(text))
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        vector = self._get_model().encode(text, normalize_embeddings=True).tolist()

        if r:
            try:
                ttl = settings.embedding_cache_ttl
                if ttl > 0:
                    r.setex(self._cache_key(text), ttl, json.dumps(vector))
                else:
                    r.set(self._cache_key(text), json.dumps(vector))
            except Exception:
                pass

        return vector

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量向量化（优先从缓存读，未命中的批量计算）"""
        r = self._get_redis()
        vectors: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []

        # 读缓存
        if r:
            for i, text in enumerate(texts):
                try:
                    cached = r.get(self._cache_key(text))
                    if cached:
                        vectors[i] = json.loads(cached)
                except Exception:
                    pass

        # 批量计算未命中的
        uncached_indices = [i for i, v in enumerate(vectors) if v is None]
        if uncached_indices:
            uncached_texts = [texts[i] for i in uncached_indices]
            computed = self._get_model().encode(
                uncached_texts, normalize_embeddings=True, batch_size=32
            ).tolist()

            for idx, vector in zip(uncached_indices, computed):
                vectors[idx] = vector
                if r:
                    try:
                        ttl = settings.embedding_cache_ttl
                        key = self._cache_key(texts[idx])
                        if ttl > 0:
                            r.setex(key, ttl, json.dumps(vector))
                        else:
                            r.set(key, json.dumps(vector))
                    except Exception:
                        pass

        return [v for v in vectors if v is not None]


embedding_service = EmbeddingService()

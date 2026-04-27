"""
Reranker — 使用 Cross-Encoder 对候选片段重排序，提升精度
直接使用 sentence-transformers CrossEncoder，无框架包装
"""

import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


class RerankResult:
    def __init__(self, content: str, score: float, metadata: dict) -> None:
        self.content = content
        self.score = score
        self.metadata = metadata


class RerankerService:
    def __init__(self) -> None:
        self._model = None

    def _get_model(self):
        if self._model is None and settings.reranker_enabled:
            try:
                from sentence_transformers import CrossEncoder

                logger.info(f"Loading reranker model: {settings.reranker_model}")
                self._model = CrossEncoder(settings.reranker_model)
            except Exception as e:
                logger.warning(f"Reranker model failed to load: {e}, skipping rerank")
        return self._model

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int,
        content_key: str = "content",
    ) -> list[dict]:
        """
        对候选片段进行重排序
        candidates: 包含 content_key 和其他字段的字典列表
        返回按 rerank score 降序排列的 top_k 结果
        """
        if not candidates:
            return []

        model = self._get_model()
        if model is None:
            # 无 Reranker 时直接按原始分数返回
            return candidates[:top_k]

        try:
            pairs = [(query, c[content_key]) for c in candidates]
            scores = model.predict(pairs).tolist()

            ranked = sorted(
                zip(candidates, scores),
                key=lambda x: x[1],
                reverse=True,
            )
            results = []
            for candidate, score in ranked[:top_k]:
                enriched = {**candidate, "rerank_score": float(score)}
                results.append(enriched)

            return results
        except Exception as e:
            logger.warning(f"Rerank failed: {e}, falling back to original order")
            return candidates[:top_k]


reranker_service = RerankerService()

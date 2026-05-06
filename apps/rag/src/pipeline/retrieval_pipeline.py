"""
RAG 检索 Pipeline — 完整的 5 步流程
① Query 预处理（科目识别 + HyDE 扩展）
② 向量检索（ANN 检索，返回 Top-K 候选）
③ Rerank（Cross-Encoder 重排序）
④ 上下文压缩（控制 token 总量）
⑤ 上下文构建（拼接片段 + Metadata）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from ..config import settings
from ..embedder.embedder import embedding_service
from ..reranker.reranker import reranker_service
from ..indexer.vector_store import search
from .query_preprocessor import query_preprocessor
from .context_builder import build_context

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    content: str
    score: float
    metadata: dict


@dataclass
class RetrievalResult:
    context: str
    chunks: list[RetrievedChunk]
    subject: Optional[str]


class RetrievalPipeline:
    async def retrieve(
        self,
        query: str,
        subject_id: Optional[str] = None,
        knowledge_base_id: Optional[str] = None,
        top_k: int | None = None,
        retrieval_mode: str = "text_only",
        budget_tokens: Optional[int] = None,
        max_upgrade_pages: Optional[int] = None,
    ) -> RetrievalResult:
        _ = retrieval_mode, budget_tokens, max_upgrade_pages
        top_k = top_k or settings.top_k_rerank

        # ① 查询预处理
        preprocessed = query_preprocessor.preprocess(query, subject_id)

        # ② 向量检索（用原始 Query 和 HyDE Query 分别检索，合并去重）
        filter_conditions: dict = {}
        if preprocessed.detected_subject:
            filter_conditions["subject_id"] = preprocessed.detected_subject
        if knowledge_base_id:
            filter_conditions["knowledge_base_id"] = knowledge_base_id

        # 并行检索（原始 query + HyDE query）
        candidates = await self._retrieve_candidates(
            original_query=preprocessed.processed_query,
            hyde_query=preprocessed.hyde_query,
            filter_conditions=filter_conditions or None,
            top_k_retrieve=settings.top_k_retrieve,
        )

        if not candidates:
            return RetrievalResult(context="", chunks=[], subject=preprocessed.detected_subject)

        # ③ Rerank
        reranked = reranker_service.rerank(
            query=preprocessed.original_query,
            candidates=candidates,
            top_k=top_k,
            content_key="text",
        )

        # ④⑤ 上下文压缩 + 构建
        context = build_context(reranked)

        chunks = [
            RetrievedChunk(
                content=c["text"],
                score=c.get("rerank_score", c.get("score", 0.0)),
                metadata={k: v for k, v in c.items() if k not in ("text", "rerank_score")},
            )
            for c in reranked
        ]

        return RetrievalResult(context=context, chunks=chunks, subject=preprocessed.detected_subject)

    async def _retrieve_candidates(
        self,
        original_query: str,
        hyde_query: Optional[str],
        filter_conditions: Optional[dict],
        top_k_retrieve: int,
    ) -> list[dict]:
        """向量检索，合并原始 query 和 HyDE query 结果，按分数去重"""
        queries = [original_query]
        if hyde_query and hyde_query != original_query:
            queries.append(hyde_query)

        seen_ids: set[str] = set()
        all_candidates: list[dict] = []

        for query_text in queries:
            query_vector = embedding_service.embed_one(query_text)
            results = search(
                collection_name=settings.qdrant_collection,
                query_vector=query_vector,
                top_k=top_k_retrieve,
                filter_conditions=filter_conditions,
            )

            for hit in results:
                payload = hit.payload or {}
                key = payload.get("doc_id", "") + "_" + str(payload.get("chunk_index", ""))
                if key not in seen_ids:
                    seen_ids.add(key)
                    all_candidates.append({
                        "text": payload.get("text", ""),
                        "score": hit.score,
                        **{k: v for k, v in payload.items() if k != "text"},
                    })

        # 按分数降序
        all_candidates.sort(key=lambda x: x["score"], reverse=True)
        return all_candidates[:top_k_retrieve]


retrieval_pipeline = RetrievalPipeline()

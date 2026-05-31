"""
RAG 检索 Pipeline — 完整的 5 步流程
① Query 预处理（科目识别 + HyDE 扩展）
② 向量检索（ANN 检索，返回 Top-K 候选）
③ Rerank（Cross-Encoder 重排序）
④ 上下文压缩（控制 token 总量）
⑤ 上下文构建（拼接片段 + Metadata）
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

from ..config import settings
from ..core.circuit_breaker import CircuitBreakerConfig, SimpleCircuitBreaker
from ..core.metrics import RETRIEVE_STAGE_LATENCY_SECONDS, DEGRADE_TOTAL
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
    def __init__(self) -> None:
        self._breaker = SimpleCircuitBreaker(
            CircuitBreakerConfig(
                failure_threshold=settings.circuit_breaker_failure_threshold,
                cooldown_seconds=settings.circuit_breaker_cooldown_seconds,
            )
        )

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
        start = time.perf_counter()
        if not self._breaker.allow():
            DEGRADE_TOTAL.labels("circuit_open").inc()
            logger.warning("retrieval circuit breaker open, return empty context")
            return RetrievalResult(context="", chunks=[], subject=subject_id)
        top_k = max(1, top_k or settings.top_k_rerank)
        mode = retrieval_mode if retrieval_mode in {"text_only", "hybrid_visual"} else "text_only"
        effective_budget = budget_tokens if isinstance(budget_tokens, int) and budget_tokens > 0 else None
        use_hyde = settings.enable_hyde and mode == "hybrid_visual"

        # ① 查询预处理
        with stage_timer("preprocess"):
            preprocessed = query_preprocessor.preprocess(query, subject_id, use_hyde=use_hyde)

        # ② 向量检索（用原始 Query 和 HyDE Query 分别检索，合并去重）
        filter_conditions: dict = {}
        if preprocessed.detected_subject:
            filter_conditions["subject_id"] = preprocessed.detected_subject
        if knowledge_base_id:
            filter_conditions["knowledge_base_id"] = knowledge_base_id

        # 并行检索（原始 query + HyDE query）
        try:
            candidates = await asyncio.wait_for(
                self._retrieve_candidates(
                    original_query=preprocessed.processed_query,
                    hyde_query=preprocessed.hyde_query if use_hyde else None,
                    filter_conditions=filter_conditions or None,
                    top_k_retrieve=self._resolve_top_k_retrieve(
                        top_k=top_k,
                        retrieval_mode=mode,
                        max_upgrade_pages=max_upgrade_pages,
                    ),
                ),
                timeout=settings.retrieve_timeout_search_ms / 1000,
            )
        except TimeoutError:
            DEGRADE_TOTAL.labels("search_timeout").inc()
            logger.warning("retrieve search timeout")
            candidates = []

        if not candidates:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            logger.info(
                "retrieval.done mode=%s top_k=%s candidates=0 reranked=0 budget=%s elapsed_ms=%s",
                mode,
                top_k,
                effective_budget,
                elapsed_ms,
            )
            self._breaker.record_failure()
            return RetrievalResult(context="", chunks=[], subject=preprocessed.detected_subject)

        # ③ Rerank
        should_rerank = self._should_rerank(preprocessed.original_query)
        if should_rerank:
            try:
                with stage_timer("rerank"):
                    reranked = await asyncio.wait_for(
                        asyncio.to_thread(
                            reranker_service.rerank,
                            query=preprocessed.original_query,
                            candidates=candidates,
                            top_k=top_k,
                            content_key="text",
                        ),
                        timeout=settings.retrieve_timeout_rerank_ms / 1000,
                    )
            except TimeoutError:
                DEGRADE_TOTAL.labels("rerank_timeout").inc()
                logger.warning("rerank timeout, fallback ANN order")
                reranked = candidates[:top_k]
        else:
            DEGRADE_TOTAL.labels("rerank_skipped").inc()
            reranked = candidates[:top_k]

        # ④⑤ 上下文压缩 + 构建
        try:
            with stage_timer("context_build"):
                context = await asyncio.wait_for(
                    asyncio.to_thread(
                        build_context,
                        reranked,
                        effective_budget,
                        True,
                        preprocessed.original_query,
                    ),
                    timeout=settings.retrieve_timeout_context_ms / 1000,
                )
        except TimeoutError:
            DEGRADE_TOTAL.labels("context_timeout").inc()
            logger.warning("context build timeout, fallback first chunks")
            context = "\n\n---\n\n".join([c["text"] for c in reranked[:2]])

        chunks = [
            RetrievedChunk(
                content=c["text"],
                score=c.get("rerank_score", c.get("score", 0.0)),
                metadata={k: v for k, v in c.items() if k not in ("text", "rerank_score")},
            )
            for c in reranked
        ]

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "retrieval.done mode=%s top_k=%s candidates=%s reranked=%s budget=%s context_tokens=%s elapsed_ms=%s",
            mode,
            top_k,
            len(candidates),
            len(reranked),
            effective_budget,
            len(context) // 4,
            elapsed_ms,
        )

        self._breaker.record_success()
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
            try:
                query_vector = await asyncio.wait_for(
                    asyncio.to_thread(embedding_service.embed_one, query_text),
                    timeout=settings.retrieve_timeout_embedding_ms / 1000,
                )
            except TimeoutError:
                DEGRADE_TOTAL.labels("embedding_timeout").inc()
                logger.warning("embedding timeout, skip query branch")
                continue
            with stage_timer("vector_search"):
                results = await asyncio.to_thread(
                    search,
                    settings.qdrant_collection,
                    query_vector,
                    top_k_retrieve,
                    filter_conditions,
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

    def _resolve_top_k_retrieve(
        self,
        top_k: int,
        retrieval_mode: str,
        max_upgrade_pages: Optional[int],
    ) -> int:
        """
        根据检索模式和升级预算动态决定候选召回规模。
        - text_only: 使用默认候选数
        - hybrid_visual: 增加候选池，给后续 rerank 更多可选片段
        """
        candidate_top_k = max(settings.top_k_retrieve, top_k)

        if retrieval_mode == "hybrid_visual":
            candidate_top_k = max(candidate_top_k, top_k * 2)

        if isinstance(max_upgrade_pages, int) and max_upgrade_pages > 0:
            candidate_top_k = max(candidate_top_k, top_k + max_upgrade_pages)

        return candidate_top_k

    def _should_rerank(self, query: str) -> bool:
        strategy = settings.rerank_strategy.lower().strip()
        if strategy == "off":
            return False
        if strategy == "always":
            return True
        return len(query.strip()) >= settings.adaptive_rerank_min_query_len


class stage_timer:
    def __init__(self, stage: str) -> None:
        self._stage = stage
        self._start = 0.0

    def __enter__(self) -> None:
        self._start = time.perf_counter()

    def __exit__(self, *_args: object) -> None:
        elapsed = time.perf_counter() - self._start
        RETRIEVE_STAGE_LATENCY_SECONDS.labels(self._stage).observe(elapsed)


retrieval_pipeline = RetrievalPipeline()

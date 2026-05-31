from __future__ import annotations

import asyncio
import logging
from typing import Optional

import uvicorn
from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .config import settings
from .core.errors import (
    BadRequestError,
    AppError,
    register_error_handlers,
)
from .core.http_middleware import RequestContextMiddleware
from .core.logging import configure_logging
from .core.metrics import QDRANT_HEALTH
from .core.rate_limit import WindowRateLimiter, enforce_rate_limit
from .core.security import require_internal_token
from .indexer.document_parser import parse_document
from .indexer.indexer import indexer_service
from .indexer.parser_models import ParseMode, ParseOptions
from .indexer.vector_store import qdrant_health_check
from .pipeline.retrieval_pipeline import retrieval_pipeline
from .services.index_task_service import index_task_service
from .services.memory_service import content_cache_service, user_memory_service

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="教育平台 RAG 服务",
    description="企业级知识检索服务（治理版）",
    version="1.0.0",
)
register_error_handlers(app)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[v.strip() for v in settings.cors_allow_origins.split(",") if v.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "x-request-id", "x-tenant-id", "x-internal-token"],
)

retrieve_limiter = WindowRateLimiter(
    limit=settings.rate_limit_retrieve_per_window,
    window_seconds=settings.rate_limit_window_seconds,
)
write_limiter = WindowRateLimiter(
    limit=settings.rate_limit_write_per_window,
    window_seconds=settings.rate_limit_window_seconds,
)


@app.on_event("startup")
async def startup() -> None:
    index_task_service.register_handler(
        "index_upload",
        _handle_index_upload_task,
    )
    index_task_service.register_handler(
        "index_text",
        _handle_index_text_task,
    )
    await index_task_service.start()
    QDRANT_HEALTH.set(1 if qdrant_health_check() else 0)
    logger.info("rag service startup completed")


@app.on_event("shutdown")
async def shutdown() -> None:
    await index_task_service.stop()
    logger.info("rag service shutdown completed")


def tenant_from_request(request: Request) -> str:
    tenant = getattr(request.state, "tenant_id", "") or settings.tenant_default
    return tenant


def _rate_limit_key(request: Request, tenant_id: str, route: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{route}:{tenant_id}:{client}"


class RetrieveRequest(BaseModel):
    query: str
    subject_id: Optional[str] = None
    knowledge_base_id: Optional[str] = None
    top_k: int = 5
    retrieval_mode: str = "text_only"
    budget_tokens: Optional[int] = None
    max_upgrade_pages: Optional[int] = None


class ChunkInfo(BaseModel):
    content: str
    score: float
    metadata: dict


class RetrieveResponse(BaseModel):
    context: str
    chunks: list[ChunkInfo]


class IndexTaskAcceptedResponse(BaseModel):
    task_id: str
    status: str


class IndexTaskStatusResponse(BaseModel):
    task_id: str
    task_type: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None


class IndexTextRequest(BaseModel):
    text: str
    knowledge_base_id: str
    subject_id: str
    doc_name: str
    doc_id: Optional[str] = None
    doc_version: Optional[int] = None
    wait: bool = Field(default=settings.index_task_wait_default)


class UserMemorySearchRequest(BaseModel):
    query: str
    user_id: str
    top_k: int = 5


class UserMemoryStoreRequest(BaseModel):
    user_id: str
    content: str


class ContentCacheSearchRequest(BaseModel):
    query: str
    top_k: int = 1


class ContentCacheStoreRequest(BaseModel):
    content: str
    payload: dict


class ParseResponse(BaseModel):
    text: str
    page_count: int
    doc_type: str
    parse_profile: dict
    page_signals: list[dict]


@app.get("/health")
def health() -> dict:
    healthy = qdrant_health_check()
    QDRANT_HEALTH.set(1 if healthy else 0)
    return {"status": "ok" if healthy else "degraded", "service": "tutor-rag", "qdrant": healthy}


@app.get("/metrics")
def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest, request: Request):
    tenant_id = tenant_from_request(request)
    enforce_rate_limit(retrieve_limiter, _rate_limit_key(request, tenant_id, "retrieve"))
    try:
        result = await asyncio.wait_for(
            retrieval_pipeline.retrieve(
                query=req.query,
                subject_id=req.subject_id,
                knowledge_base_id=req.knowledge_base_id,
                top_k=req.top_k,
                retrieval_mode=req.retrieval_mode,
                budget_tokens=req.budget_tokens,
                max_upgrade_pages=req.max_upgrade_pages,
            ),
            timeout=settings.retrieve_timeout_total_ms / 1000,
        )
    except TimeoutError as exc:
        raise AppError(code="RETRIEVE_TIMEOUT", message="retrieve timeout", http_status=504) from exc
    return RetrieveResponse(
        context=result.context,
        chunks=[ChunkInfo(content=c.content, score=c.score, metadata=c.metadata) for c in result.chunks],
    )


@app.post("/index/upload", response_model=IndexTaskAcceptedResponse, dependencies=[Depends(require_internal_token)])
async def index_upload(
    request: Request,
    file: UploadFile = File(...),
    knowledge_base_id: str = Form(...),
    subject_id: str = Form(...),
    doc_name: str = Form(...),
    doc_id: Optional[str] = Form(default=None),
    doc_version: Optional[int] = Form(default=None),
    wait: bool = Form(default=settings.index_task_wait_default),
):
    if file.content_type not in ("application/pdf", "text/markdown", "text/plain"):
        raise BadRequestError("unsupported file type")
    tenant_id = tenant_from_request(request)
    enforce_rate_limit(write_limiter, _rate_limit_key(request, tenant_id, "index_upload"))
    content = await file.read()
    task = await index_task_service.enqueue(
        "index_upload",
        {
            "tenant_id": tenant_id,
            "content": content,
            "filename": file.filename or doc_name,
            "knowledge_base_id": knowledge_base_id,
            "subject_id": subject_id,
            "doc_name": doc_name,
            "doc_id": doc_id,
            "doc_version": doc_version,
        },
    )
    if wait:
        record = await index_task_service.wait(task.task_id, settings.index_task_wait_timeout_seconds)
        if record.status == "failed":
            raise AppError(code="INDEX_FAILED", message=record.error or "index failed")
    return IndexTaskAcceptedResponse(task_id=task.task_id, status=task.status)


@app.post("/index/text", response_model=IndexTaskAcceptedResponse, dependencies=[Depends(require_internal_token)])
async def index_text(request: Request, req: IndexTextRequest):
    tenant_id = tenant_from_request(request)
    enforce_rate_limit(write_limiter, _rate_limit_key(request, tenant_id, "index_text"))
    task = await index_task_service.enqueue(
        "index_text",
        {
            "tenant_id": tenant_id,
            "text": req.text,
            "knowledge_base_id": req.knowledge_base_id,
            "subject_id": req.subject_id,
            "doc_name": req.doc_name,
            "doc_id": req.doc_id,
            "doc_version": req.doc_version,
        },
    )
    if req.wait:
        record = await index_task_service.wait(task.task_id, settings.index_task_wait_timeout_seconds)
        if record.status == "failed":
            raise AppError(code="INDEX_FAILED", message=record.error or "index failed")
    return IndexTaskAcceptedResponse(task_id=task.task_id, status=task.status)


@app.get("/index/tasks/{task_id}", response_model=IndexTaskStatusResponse, dependencies=[Depends(require_internal_token)])
def get_index_task(task_id: str):
    task = index_task_service.get(task_id)
    return IndexTaskStatusResponse(
        task_id=task.task_id,
        task_type=task.task_type,
        status=task.status,
        result=task.result,
        error=task.error,
    )


@app.delete("/index/{knowledge_base_id}/{doc_id}", dependencies=[Depends(require_internal_token)])
async def delete_document(request: Request, knowledge_base_id: str, doc_id: str):
    tenant_id = tenant_from_request(request)
    await indexer_service.delete_document(
        tenant_id=tenant_id,
        knowledge_base_id=knowledge_base_id,
        doc_id=doc_id,
    )
    return {"status": "deleted"}


@app.post("/parse", response_model=ParseResponse, dependencies=[Depends(require_internal_token)])
async def parse_file(
    file: UploadFile = File(...),
    mode: ParseMode = Form(settings.parse_default_mode),
    max_upgrade_pages: int = Form(settings.parse_max_upgrade_pages),
    budget_tokens: int = Form(settings.parse_budget_tokens),
):
    content = await file.read()
    parsed = parse_document(
        content,
        file.filename or "unknown",
        options=ParseOptions(
            mode=mode,
            max_upgrade_pages=max_upgrade_pages,
            budget_tokens=budget_tokens,
        ),
    )
    return ParseResponse(
        text=parsed.text,
        page_count=parsed.page_count,
        doc_type=parsed.doc_type,
        parse_profile=parsed.parse_profile,
        page_signals=[signal.__dict__ for signal in parsed.page_signals],
    )


@app.post("/memory/user/search", dependencies=[Depends(require_internal_token)])
async def user_memory_search(request: Request, req: UserMemorySearchRequest):
    tenant_id = tenant_from_request(request)
    results = user_memory_service.search(req.query, req.user_id, req.top_k, tenant_id=tenant_id)
    return {"results": [{"content": r.content, "score": r.score, "payload": r.payload} for r in results]}


@app.post("/memory/user/store", dependencies=[Depends(require_internal_token)])
async def user_memory_store(request: Request, req: UserMemoryStoreRequest):
    tenant_id = tenant_from_request(request)
    user_memory_service.store(req.user_id, req.content, tenant_id=tenant_id)
    return {"status": "stored"}


@app.post("/memory/content/search", dependencies=[Depends(require_internal_token)])
async def content_cache_search(request: Request, req: ContentCacheSearchRequest):
    tenant_id = tenant_from_request(request)
    results = content_cache_service.search(req.query, req.top_k, tenant_id=tenant_id)
    return {"results": [{"content": r.content, "score": r.score, "payload": r.payload} for r in results]}


@app.post("/memory/content/store", dependencies=[Depends(require_internal_token)])
async def content_cache_store(request: Request, req: ContentCacheStoreRequest):
    tenant_id = tenant_from_request(request)
    content_cache_service.store(req.content, req.payload, tenant_id=tenant_id)
    return {"status": "stored"}


async def _handle_index_upload_task(payload: dict) -> dict:
    return await indexer_service.index_document(
        content=payload["content"],
        filename=payload["filename"],
        tenant_id=payload["tenant_id"],
        knowledge_base_id=payload["knowledge_base_id"],
        subject_id=payload["subject_id"],
        doc_name=payload["doc_name"],
        doc_id=payload.get("doc_id"),
        doc_version=payload.get("doc_version"),
    )


async def _handle_index_text_task(payload: dict) -> dict:
    return await indexer_service.index_text(
        text=payload["text"],
        tenant_id=payload["tenant_id"],
        knowledge_base_id=payload["knowledge_base_id"],
        subject_id=payload["subject_id"],
        doc_name=payload["doc_name"],
        doc_id=payload.get("doc_id"),
        doc_version=payload.get("doc_version"),
    )


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)

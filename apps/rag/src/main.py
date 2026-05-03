"""
考研辅导平台 RAG 服务
与后端（NestJS）和 Agent（TypeScript Harness）解耦，通过 HTTP REST 提供：
  - 向量检索接口（含 Rerank / HyDE）
  - 文档向量化入库接口
  - 用户级向量记忆接口
  - 内容级向量缓存接口（Video Agent 使用）
  - 文档解析接口
"""

from __future__ import annotations

import uvicorn  # 启动 FastAPI 应用
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel  # 数据模型
from typing import Optional

from .config import settings  # 配置
from .pipeline.retrieval_pipeline import retrieval_pipeline  # 检索管道
from .indexer.indexer import indexer_service  # 索引器
from .indexer.document_parser import parse_document  # 文档解析器
from .services.memory_service import user_memory_service, content_cache_service  # 记忆服务

app = FastAPI(
    title="考研辅导 RAG 服务",
    description="知识库向量化存储与语义检索服务（无 LangChain）",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,  # 跨域中间件
    allow_origins=["*"],  # 允许所有源
    allow_credentials=True,  # 允许携带凭证
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头
)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "tutor-rag"}  # 健康检查


# ─── Retrieve ────────────────────────────────────────────────────────────────

class RetrieveRequest(BaseModel):
    query: str  # 查询
    subject_id: Optional[str] = None  # 学科 ID
    knowledge_base_id: Optional[str] = None  # 知识库 ID
    top_k: int = 5  # 返回数量


class ChunkInfo(BaseModel):
    content: str  # 内容
    score: float  # 分数
    metadata: dict  # 元数据


class RetrieveResponse(BaseModel):
    context: str  # 上下文
    chunks: list[ChunkInfo]  # 块信息


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest):  # 检索
    """
    RAG 检索接口：Query 预处理 → 向量检索 → Rerank → 上下文构建
    """
    try:
        result = await retrieval_pipeline.retrieve(
            query=req.query,
            subject_id=req.subject_id,
            knowledge_base_id=req.knowledge_base_id,
            top_k=req.top_k,
        )
        return RetrieveResponse(
            context=result.context,
            chunks=[
                ChunkInfo(content=c.content, score=c.score, metadata=c.metadata)
                for c in result.chunks
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Index ───────────────────────────────────────────────────────────────────

class IndexResponse(BaseModel):
    doc_id: str
    chunks: int
    status: str


@app.post("/index/upload", response_model=IndexResponse)
async def index_upload(  # 上传文档
    file: UploadFile = File(...),
    knowledge_base_id: str = Form(...),
    subject_id: str = Form(...),
    doc_name: str = Form(...),
):
    """文档向量化接口：上传 PDF/MD 文档并向量化存储"""
    if file.content_type not in ("application/pdf", "text/markdown", "text/plain"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 和 Markdown 文档")

    content = await file.read()
    try:
        result = await indexer_service.index_document(
            content=content,
            filename=file.filename or doc_name,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
            doc_name=doc_name,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class IndexTextRequest(BaseModel):
    text: str
    knowledge_base_id: str
    subject_id: str
    doc_name: str
    doc_id: Optional[str] = None


@app.post("/index/text", response_model=IndexResponse)
async def index_text(req: IndexTextRequest):
    """文本向量化接口：直接提交 Markdown 文本并向量化存储"""
    try:
        result = await indexer_service.index_text(
            text=req.text,
            knowledge_base_id=req.knowledge_base_id,
            subject_id=req.subject_id,
            doc_name=req.doc_name,
            doc_id=req.doc_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/index/{knowledge_base_id}/{doc_id}")
async def delete_document(knowledge_base_id: str, doc_id: str):
    """删除向量化文档"""
    try:
        await indexer_service.delete_document(
            knowledge_base_id=knowledge_base_id, doc_id=doc_id
        )
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Document Parse (only) ────────────────────────────────────────────────────

class ParseResponse(BaseModel):
    text: str
    page_count: int
    doc_type: str


@app.post("/parse", response_model=ParseResponse)
async def parse_file(file: UploadFile = File(...)):
    """仅解析文档，返回文本内容（不入库）"""
    content = await file.read()
    parsed = parse_document(content, file.filename or "unknown")
    return ParseResponse(
        text=parsed.text,
        page_count=parsed.page_count,
        doc_type=parsed.doc_type,
    )


# ─── User Vector Memory ───────────────────────────────────────────────────────

class UserMemorySearchRequest(BaseModel):
    query: str
    user_id: str
    top_k: int = 5


class UserMemoryStoreRequest(BaseModel):
    user_id: str
    content: str


@app.post("/memory/user/search")
async def user_memory_search(req: UserMemorySearchRequest):
    try:
        results = user_memory_service.search(req.query, req.user_id, req.top_k)
        return {
            "results": [
                {"content": r.content, "score": r.score, "payload": r.payload}
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/user/store")
async def user_memory_store(req: UserMemoryStoreRequest):
    try:
        user_memory_service.store(req.user_id, req.content)
        return {"status": "stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Content Vector Cache (Video Agent) ──────────────────────────────────────

class ContentCacheSearchRequest(BaseModel):
    query: str
    top_k: int = 1


class ContentCacheStoreRequest(BaseModel):
    content: str
    payload: dict


@app.post("/memory/content/search")
async def content_cache_search(req: ContentCacheSearchRequest):
    try:
        results = content_cache_service.search(req.query, req.top_k)
        return {
            "results": [
                {"content": r.content, "score": r.score, "payload": r.payload}
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/content/store")
async def content_cache_store(req: ContentCacheStoreRequest):
    try:
        content_cache_service.store(req.content, req.payload)
        return {"status": "stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Start ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )

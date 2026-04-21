"""
考研辅导平台 RAG 知识库服务
与后端（NestJS）解耦，通过 HTTP REST 提供向量检索接口
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from .config import settings
from .services.retriever import retriever_service
from .services.indexer import indexer_service

app = FastAPI(
    title="考研辅导 RAG 服务",
    description="知识库向量化存储与语义检索服务",
    version="0.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "kaoyan-rag"}


# ─── Retrieve ────────────────────────────────────────────────────────────────

class RetrieveRequest(BaseModel):
    query: str
    subject_id: str
    knowledge_base_id: Optional[str] = None
    top_k: int = 5


class RetrieveResponse(BaseModel):
    context: str
    sources: list[dict]


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest):
    """
    语义检索接口：根据查询内容从知识库中检索相关上下文
    """
    try:
        result = await retriever_service.retrieve(
            query=req.query,
            subject_id=req.subject_id,
            knowledge_base_id=req.knowledge_base_id,
            top_k=req.top_k,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Index ───────────────────────────────────────────────────────────────────

class IndexResponse(BaseModel):
    doc_id: str
    chunks: int
    status: str


@app.post("/index/upload", response_model=IndexResponse)
async def index_upload(
    file: UploadFile = File(...),
    knowledge_base_id: str = Form(...),
    subject_id: str = Form(...),
    doc_name: str = Form(...),
):
    """
    文档向量化接口：上传 PDF/MD 文档并向量化存储
    """
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
    """
    文本向量化接口：直接提交 Markdown 文本并向量化存储
    """
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
    """
    删除向量化文档
    """
    try:
        await indexer_service.delete_document(knowledge_base_id=knowledge_base_id, doc_id=doc_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Semantic Search (for conversation history) ──────────────────────────────

class SemanticSearchRequest(BaseModel):
    query: str
    subject_id: str
    user_id: str
    top_k: int = 10


@app.post("/search/conversations")
async def semantic_search_conversations(req: SemanticSearchRequest):
    """
    对话历史语义搜索（通过知识点向量化搜索）
    """
    try:
        results = await retriever_service.search_conversations(
            query=req.query,
            subject_id=req.subject_id,
            user_id=req.user_id,
            top_k=req.top_k,
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )

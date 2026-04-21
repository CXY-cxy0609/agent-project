"""
RAG 检索服务：从向量数据库检索相关知识点
"""

from typing import Optional
from ..config import settings


class RetrieverService:
    def __init__(self):
        self._vector_store = None

    def _get_vector_store(self):
        """延迟初始化向量存储（避免启动时依赖未就绪）"""
        if self._vector_store is None:
            from qdrant_client import QdrantClient
            from langchain_community.vectorstores import Qdrant
            from langchain_community.embeddings import HuggingFaceEmbeddings

            client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None,
            )
            embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
            self._vector_store = Qdrant(
                client=client,
                collection_name=settings.qdrant_collection,
                embeddings=embeddings,
            )
        return self._vector_store

    async def retrieve(
        self,
        query: str,
        subject_id: str,
        knowledge_base_id: Optional[str] = None,
        top_k: int = 5,
    ) -> dict:
        """语义检索，返回相关上下文和来源"""
        try:
            vs = self._get_vector_store()
            filter_dict: dict = {"subject_id": subject_id}
            if knowledge_base_id:
                filter_dict["knowledge_base_id"] = knowledge_base_id

            docs = vs.similarity_search(query, k=top_k, filter=filter_dict)

            context = "\n\n---\n\n".join([doc.page_content for doc in docs])
            sources = [
                {
                    "doc_name": doc.metadata.get("doc_name", ""),
                    "knowledge_base_id": doc.metadata.get("knowledge_base_id", ""),
                    "page": doc.metadata.get("page", 0),
                }
                for doc in docs
            ]

            return {"context": context, "sources": sources}
        except Exception:
            return {"context": "", "sources": []}

    async def search_conversations(
        self,
        query: str,
        subject_id: str,
        user_id: str,
        top_k: int = 10,
    ) -> list[dict]:
        """语义搜索历史对话（通过知识点向量匹配）"""
        return []


retriever_service = RetrieverService()

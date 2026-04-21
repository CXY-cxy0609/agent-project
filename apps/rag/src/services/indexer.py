"""
RAG 文档索引服务：将文档向量化并存储到向量数据库
"""

import uuid
from typing import Optional
from ..config import settings


class IndexerService:
    def __init__(self):
        self._embeddings = None
        self._client = None

    def _get_client(self):
        if self._client is None:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams

            self._client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None,
            )

            # Ensure collection exists
            collections = self._client.get_collections().collections
            names = [c.name for c in collections]
            if settings.qdrant_collection not in names:
                self._client.create_collection(
                    collection_name=settings.qdrant_collection,
                    vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
                )

        return self._client

    def _get_embeddings(self):
        if self._embeddings is None:
            from langchain_community.embeddings import HuggingFaceEmbeddings

            self._embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
        return self._embeddings

    async def index_document(
        self,
        content: bytes,
        filename: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
    ) -> dict:
        """将 PDF/MD 文档切分并向量化存储"""
        doc_id = str(uuid.uuid4())

        if filename.endswith(".pdf"):
            text = self._extract_pdf(content)
        else:
            text = content.decode("utf-8", errors="ignore")

        chunks = self._split_text(text)
        await self._store_chunks(
            chunks=chunks,
            doc_id=doc_id,
            doc_name=doc_name,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
        )

        return {"doc_id": doc_id, "chunks": len(chunks), "status": "indexed"}

    async def index_text(
        self,
        text: str,
        knowledge_base_id: str,
        subject_id: str,
        doc_name: str,
        doc_id: Optional[str] = None,
    ) -> dict:
        """将纯文本向量化存储"""
        if doc_id is None:
            doc_id = str(uuid.uuid4())

        chunks = self._split_text(text)
        await self._store_chunks(
            chunks=chunks,
            doc_id=doc_id,
            doc_name=doc_name,
            knowledge_base_id=knowledge_base_id,
            subject_id=subject_id,
        )

        return {"doc_id": doc_id, "chunks": len(chunks), "status": "indexed"}

    async def delete_document(self, knowledge_base_id: str, doc_id: str) -> None:
        """删除向量数据库中的文档"""
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        client = self._get_client()
        client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=Filter(
                must=[
                    FieldCondition(key="knowledge_base_id", match=MatchValue(value=knowledge_base_id)),
                    FieldCondition(key="doc_id", match=MatchValue(value=doc_id)),
                ]
            ),
        )

    def _extract_pdf(self, content: bytes) -> str:
        """Extract text from PDF bytes"""
        import io
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    def _split_text(self, text: str) -> list[str]:
        """Split text into chunks for embedding"""
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n## ", "\n### ", "\n\n", "\n", "。", "，", " ", ""],
        )
        return splitter.split_text(text)

    async def _store_chunks(
        self,
        chunks: list[str],
        doc_id: str,
        doc_name: str,
        knowledge_base_id: str,
        subject_id: str,
    ) -> None:
        """Embed and store text chunks in Qdrant"""
        from qdrant_client.models import PointStruct

        client = self._get_client()
        embeddings = self._get_embeddings()

        vectors = embeddings.embed_documents(chunks)
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload={
                    "text": chunk,
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "knowledge_base_id": knowledge_base_id,
                    "subject_id": subject_id,
                    "chunk_index": i,
                },
            )
            for i, (chunk, vector) in enumerate(zip(chunks, vectors))
        ]

        client.upsert(collection_name=settings.qdrant_collection, points=points)


indexer_service = IndexerService()

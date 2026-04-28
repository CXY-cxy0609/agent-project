from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    debug: bool = True

    # Vector Store (Qdrant)
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "tutor_knowledge"
    qdrant_user_memory_collection: str = "tutor_user_memory"
    qdrant_video_cache_collection: str = "tutor_video_cache"

    # Embedding Model
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024

    # Reranker (Cross-Encoder)
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    reranker_enabled: bool = True

    # Chunking
    max_chunk_size: int = 512   # tokens
    chunk_overlap: float = 0.1  # 10% 重叠
    min_chunk_size: int = 50    # tokens

    # RAG Pipeline
    top_k_retrieve: int = 20    # 向量检索候选数
    top_k_rerank: int = 5       # Rerank 后保留数

    # Redis Cache
    redis_url: str = "redis://localhost:6379"
    embedding_cache_ttl: int = 0     # 0 = 永久缓存
    rag_cache_ttl: int = 300         # 5 分钟

    # LLM (用于 HyDE 查询扩展)
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

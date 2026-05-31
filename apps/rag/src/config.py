from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    debug: bool = True
    log_level: str = "INFO"
    tenant_default: str = "public"

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
    chunker_v2_enabled: bool = True

    # Parse Strategy
    parse_default_mode: str = "balanced"
    parse_max_upgrade_pages: int = 3
    parse_budget_tokens: int = 4000

    # RAG Pipeline
    top_k_retrieve: int = 20    # 向量检索候选数
    top_k_rerank: int = 5       # Rerank 后保留数

    # Redis Cache
    redis_url: str = "redis://localhost:6379"
    embedding_cache_ttl: int = 0     # 0 = 永久缓存
    rag_cache_ttl: int = 300         # 5 分钟

    # Security & Rate Limit
    internal_token: str = ""
    cors_allow_origins: str = "http://localhost:5173"
    rate_limit_window_seconds: int = 60
    rate_limit_retrieve_per_window: int = 120
    rate_limit_write_per_window: int = 30

    # Retrieve governance
    retrieve_timeout_total_ms: int = 2000
    retrieve_timeout_embedding_ms: int = 450
    retrieve_timeout_search_ms: int = 500
    retrieve_timeout_rerank_ms: int = 450
    retrieve_timeout_context_ms: int = 250
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_cooldown_seconds: int = 30
    enable_hyde: bool = True

    # Async index task
    index_task_wait_default: bool = False
    index_task_wait_timeout_seconds: int = 30

    # Indexing idempotency & versioning
    default_doc_version: int = 1
    enable_chunk_idempotency: bool = True

    # LLM (用于 HyDE 查询扩展)
    anthropic_api_key: str = ""

    # Routing / tuning
    rerank_strategy: str = "adaptive"  # off|always|adaptive
    adaptive_rerank_min_query_len: int = 12

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

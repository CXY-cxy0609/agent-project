from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    debug: bool = True

    # Vector Store (Qdrant)
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "kaoyan_knowledge"

    # Embedding Model
    embedding_model: str = "BAAI/bge-m3"

    # LLM
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

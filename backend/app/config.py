from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str

    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET: str = "nexus-rag"
    S3_REGION: str = "eu-north-1"
    S3_ENDPOINT: str = ""

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "nexusrag_chunks"

    GROQ_API_KEY: str
    LLM_MODEL: str = "llama-3.3-70b-versatile"

    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384

    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    TOP_K_RESULTS: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

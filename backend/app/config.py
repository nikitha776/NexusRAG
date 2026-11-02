from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import Field, field_validator
from urllib.parse import urlsplit


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str = ""

    # Optional: API operations use Supabase REST, not a direct SQL connection.
    DATABASE_URL: str = ""
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:3001"])

    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET: str = "nexus-rag"
    S3_REGION: str = "eu-north-1"
    S3_ENDPOINT: str = ""

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "nexusrag_chunks"
    QDRANT_API_KEY: str = ""
    QDRANT_TIMEOUT: float = Field(default=30, gt=0)

    GROQ_API_KEY: str
    LLM_MODEL: str = "openai/gpt-oss-20b"
    # Leave space for 2,048 output tokens and chat-message overhead below 8k.
    LLM_INPUT_TOKEN_BUDGET: int = 5000

    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384
    EMBEDDING_CACHE_DIR: str = "/tmp/fastembed"
    EMBEDDING_THREADS: int = Field(default=1, ge=1)
    EMBEDDING_BATCH_SIZE: int = Field(default=1, ge=1, le=16)
    EMBEDDING_PROFILE: str = "bge-small-onnx-v1"
    EMBEDDING_LOCAL_FILES_ONLY: bool = False

    CHUNK_SIZE: int = 1024
    CHUNK_OVERLAP: int = 128
    TOP_K_RESULTS: int = 5

    @field_validator("CORS_ORIGINS")
    @classmethod
    def valid_origins(cls, origins):
        result = []
        for origin in origins:
            parsed = urlsplit(origin)
            if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                    or "*" in parsed.netloc or parsed.username or parsed.password or parsed.path not in {"", "/"}
                    or parsed.query or parsed.fragment):
                raise ValueError("CORS_ORIGINS must contain exact HTTP(S) origins, without paths or wildcards")
            result.append(origin.rstrip("/"))
        return list(dict.fromkeys(result))

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

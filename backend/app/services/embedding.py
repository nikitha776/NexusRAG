"""Small CPU-only ONNX embeddings exposed through LangChain's interface."""
import math
import threading
from fastembed import TextEmbedding
from langchain_core.embeddings import Embeddings
from app.config import get_settings

settings = get_settings()
_embedding_model = None
# Serialize inference and initialization to bound peak memory on small hosts.
_embedding_lock = threading.RLock()


class FastEmbedEmbeddings(Embeddings):
    def __init__(self):
        self.model = TextEmbedding(
            model_name=settings.EMBEDDING_MODEL,
            cache_dir=settings.EMBEDDING_CACHE_DIR,
            threads=settings.EMBEDDING_THREADS,
            providers=["CPUExecutionProvider"],
            enable_cpu_mem_arena=False,
            local_files_only=settings.EMBEDDING_LOCAL_FILES_ONLY,
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        with _embedding_lock:
            vectors = self.model.embed(texts, batch_size=settings.EMBEDDING_BATCH_SIZE, parallel=None)
            result = []
            for vector in vectors:
                values = vector.tolist()
                norm = math.sqrt(sum(value * value for value in values))
                if len(values) != settings.EMBEDDING_DIM or not math.isfinite(norm) or norm == 0:
                    raise RuntimeError("The embedding model returned invalid vectors. Check the configured model and dimension.")
                result.append([float(value / norm) for value in values])
            return result

    def embed_query(self, text: str) -> list[float]:
        # Keep both encoders on raw text, matching the previous index contract.
        return self.embed_documents([text])[0]


def get_embedding_model() -> FastEmbedEmbeddings:
    global _embedding_model
    with _embedding_lock:
        if _embedding_model is None:
            _embedding_model = FastEmbedEmbeddings()
        return _embedding_model


def generate_embedding(text: str) -> list[float]:
    return get_embedding_model().embed_query(text)


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return get_embedding_model().embed_documents(texts)

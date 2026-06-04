from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from app.config import get_settings

settings = get_settings()

_embedding_model = None


def get_embedding_model() -> HuggingFaceEmbedding:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbedding(
            model_name=settings.EMBEDDING_MODEL,
            trust_remote_code=True,
        )
    return _embedding_model


def generate_embedding(text: str) -> list[float]:
    model = get_embedding_model()
    return model.get_text_embedding(text)


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    return model.get_text_embedding_batch(texts)

"""Cache the small ONNX model at image-build time, without application secrets."""
import os
from fastembed import TextEmbedding

if __name__ == "__main__":
    model = TextEmbedding(
        model_name=os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
        cache_dir=os.getenv("EMBEDDING_CACHE_DIR", "/app/.cache/fastembed"),
        threads=1, providers=["CPUExecutionProvider"], enable_cpu_mem_arena=False,
    )
    assert len(next(model.embed(["Embedding cache verification"], batch_size=1))) == 384

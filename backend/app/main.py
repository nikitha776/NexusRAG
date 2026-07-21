from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api import workspaces, documents, chat, rag

logger = logging.getLogger(__name__)


app = FastAPI(
    title="NexusRAG API",
    description="Multi-Workspace AI Knowledge Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://3.6.16.170:3000",
        "http://13.235.118.53:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(rag.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    from app.db.engine import init_db
    from app.services.embedding import get_embedding_model
    from app.services.rag import ensure_collection
    try:
        await init_db()
        get_embedding_model()
        ensure_collection()
    except Exception as e:
        logger.warning(
            "Startup warm-up failed (Qdrant/embedding not ready yet): %s. "
            "The service will continue and retry on first request.",
            e,
        )


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NexusRAG"}

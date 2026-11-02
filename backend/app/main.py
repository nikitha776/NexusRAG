from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from app.config import get_settings

from app.api import workspaces, documents, chat, rag

logger = logging.getLogger(__name__)


app = FastAPI(
    title="NexusRAG API",
    description="Multi-Workspace AI Knowledge Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().CORS_ORIGINS,
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
    from app.services.rag import ensure_collection
    try:
        # SQL schema is managed by migrations; the API uses Supabase REST.
        # Keep model loading lazy so health checks don't wait on downloads.
        await asyncio.to_thread(ensure_collection)
    except Exception as e:
        logger.warning(
            "Vector index initialization failed: %s. "
            "The service will continue and retry on first request.",
            e,
        )


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NexusRAG"}

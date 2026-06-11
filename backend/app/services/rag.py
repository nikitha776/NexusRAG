from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
    ScrollResult,
)
from app.config import get_settings
from app.services.embedding import generate_embedding, generate_embeddings
from app.services.chunking import extract_text, chunk_text
from app.services.llm import generate_response
from uuid import uuid4

settings = get_settings()

_qdrant_client = None


def get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(url=settings.QDRANT_URL)
    return _qdrant_client


def ensure_collection():
    client = get_qdrant_client()
    collections = client.get_collections().collections
    names = [c.name for c in collections]
    if settings.QDRANT_COLLECTION not in names:
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )


def upsert_chunks(
    document_id: str,
    workspace_id: str,
    chunks: list[str],
):
    import time
    import logging
    logger = logging.getLogger(__name__)

    client = get_qdrant_client()
    ensure_collection()

    t0 = time.time()
    embeddings = generate_embeddings(chunks)
    t1 = time.time()
    logger.info(f"[TIMING] Embedding generation: {t1 - t0:.2f}s ({len(chunks)} chunks)")

    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = str(uuid4())
        points.append(
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "workspace_id": workspace_id,
                    "chunk_index": i,
                    "content": chunk,
                },
            )
        )

    t2 = time.time()
    batch_size = 500
    for start in range(0, len(points), batch_size):
        batch = points[start : start + batch_size]
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION,
            points=batch,
        )
    t3 = time.time()
    logger.info(f"[TIMING] Qdrant upsert: {t3 - t2:.2f}s ({len(points)} points)")

    return len(points)


def search_chunks(
    query: str,
    workspace_id: str,
    selected_doc_ids: list[str],
    top_k: int = None,
) -> list[dict]:
    client = get_qdrant_client()
    top_k = top_k or settings.TOP_K_RESULTS

    query_embedding = generate_embedding(query)

    must_conditions = [
        FieldCondition(
            key="workspace_id",
            match=MatchValue(value=workspace_id),
        ),
    ]

    if selected_doc_ids:
        must_conditions.append(
            FieldCondition(
                key="document_id",
                match=MatchAny(any=selected_doc_ids),
            )
        )

    search_filter = Filter(must=must_conditions)

    results = client.search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_embedding,
        query_filter=search_filter,
        limit=top_k,
        with_payload=True,
    )

    return [
        {
            "content": hit.payload.get("content", ""),
            "document_id": hit.payload.get("document_id", ""),
            "chunk_index": hit.payload.get("chunk_index", 0),
            "score": hit.score,
        }
        for hit in results
    ]


def delete_document_chunks(document_id: str):
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )


async def process_document_background(document_id: str, file_content: bytes, filename: str, workspace_id: str):
    import logging
    import asyncio
    import time
    from uuid import uuid4
    from datetime import datetime, timezone
    from app.db.supabase_client import get_supabase_admin

    logger = logging.getLogger(__name__)
    total_start = time.time()
    logger.info(f"[TIMING] Processing document {document_id}: {filename} ({len(file_content)} bytes)")

    try:
        t0 = time.time()
        text = await asyncio.to_thread(extract_text, file_content, filename)
        t1 = time.time()
        logger.info(f"[TIMING] Text extraction: {t1 - t0:.2f}s ({len(text)} chars from {filename})")

        t2 = time.time()
        chunks = await asyncio.to_thread(chunk_text, text)
        t3 = time.time()
        logger.info(f"[TIMING] Chunking: {t3 - t2:.2f}s ({len(chunks)} chunks)")

        supabase = get_supabase_admin()

        chunk_records = [
            {
                "id": str(uuid4()),
                "document_id": document_id,
                "chunk_index": i,
                "content": chunk_text_content,
                "token_count": len(chunk_text_content.split()),
            }
            for i, chunk_text_content in enumerate(chunks)
        ]

        async def insert_chunks_to_db():
            st = time.time()
            batch_size = 500
            for start in range(0, len(chunk_records), batch_size):
                batch = chunk_records[start : start + batch_size]
                await asyncio.to_thread(
                    lambda b=batch: supabase.table("document_chunks").insert(b).execute()
                )
            logger.info(f"[TIMING] Supabase chunk insert: {time.time() - st:.2f}s ({len(chunk_records)} records)")

        async def upsert_vectors():
            st = time.time()
            await asyncio.to_thread(
                upsert_chunks, document_id, workspace_id, chunks
            )
            logger.info(f"[TIMING] Vector upsert (total incl. embed+qdrant): {time.time() - st:.2f}s")

        t4 = time.time()
        await asyncio.gather(upsert_vectors(), insert_chunks_to_db())
        t5 = time.time()
        logger.info(f"[TIMING] Parallel upsert+insert: {t5 - t4:.2f}s")

        t6 = time.time()
        await asyncio.to_thread(
            lambda: supabase.table("documents").update({
                "status": "ready",
                "chunk_count": len(chunks),
            }).eq("id", document_id).execute()
        )
        t7 = time.time()
        logger.info(f"[TIMING] Status update: {t7 - t6:.2f}s")
        logger.info(f"[TIMING] TOTAL processing time: {time.time() - total_start:.2f}s for {filename}")

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}", exc_info=True)
        try:
            supabase = get_supabase_admin()
            supabase.table("documents").update({
                "status": "error",
                "error_message": str(e)[:500],
            }).eq("id", document_id).execute()
        except Exception:
            logger.error(f"Failed to update error status for {document_id}")

        # Best-effort cleanup of orphaned data from either side
        # of the parallel gather (vectors in Qdrant / chunks in Supabase)
        try:
            delete_document_chunks(document_id)
            logger.info(f"Cleaned up Qdrant vectors for failed document {document_id}")
        except Exception:
            logger.error(f"Failed to clean up Qdrant vectors for {document_id}")

        try:
            supabase = get_supabase_admin()
            supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
            logger.info(f"Cleaned up Supabase chunks for failed document {document_id}")
        except Exception:
            logger.error(f"Failed to clean up Supabase chunks for {document_id}")


async def delete_document_vectors(document_id: str):
    delete_document_chunks(document_id)


async def query_rag(
    query: str,
    workspace_id: str,
    selected_doc_ids: list[str],
    chat_history: list[dict],
    doc_map: dict[str, str],
) -> dict:
    chunks = search_chunks(
        query=query,
        workspace_id=workspace_id,
        selected_doc_ids=selected_doc_ids,
    )

    if not chunks:
        return {
            "response": "I couldn't find relevant information in the selected documents for your query. Try selecting different documents or rephrasing your question.",
            "citations": [],
        }

    context_parts = []
    for i, chunk in enumerate(chunks):
        doc_name = doc_map.get(chunk["document_id"], "Unknown Document")
        context_parts.append(
            f"[Source {i+1}: {doc_name}]\n{chunk['content']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    history_text = ""
    if chat_history:
        for msg in chat_history[-6:]:
            role = msg["role"].capitalize()
            history_text += f"{role}: {msg['content']}\n"

    system_prompt = """You are a helpful AI assistant for NexusRAG. You answer questions based ONLY on the provided context from the user's documents.

Rules:
1. Answer ONLY based on the provided context. If the context doesn't contain enough information, say so.
2. When you use information from a source, reference it naturally (e.g., "According to [Source 1]...").
3. Be concise and accurate.
4. If multiple sources discuss the topic, synthesize the information.
5. Do not make up information not present in the context."""

    prompt = f"""Context from selected documents:

{context}

{f'Previous conversation:{chr(10)}{history_text}' if history_text else ''}

User question: {query}

Provide a clear, helpful answer based on the context above:"""

    response_text = generate_response(prompt, system_prompt)

    citations = []
    seen_docs = set()
    for chunk in chunks:
        doc_id = chunk["document_id"]
        if doc_id not in seen_docs:
            seen_docs.add(doc_id)
            citations.append(
                {
                    "document_id": doc_id,
                    "filename": doc_map.get(doc_id, "Unknown"),
                    "chunk_content": chunk["content"][:200],
                    "score": round(chunk["score"], 4),
                }
            )

    return {
        "response": response_text,
        "citations": citations,
    }

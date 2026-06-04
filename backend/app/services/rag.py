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
    client = get_qdrant_client()
    ensure_collection()

    embeddings = generate_embeddings(chunks)

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

    batch_size = 100
    for start in range(0, len(points), batch_size):
        batch = points[start : start + batch_size]
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION,
            points=batch,
        )

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
    from uuid import uuid4
    from datetime import datetime, timezone
    from app.db.supabase_client import get_supabase_admin

    logger = logging.getLogger(__name__)
    logger.info(f"Processing document {document_id}: {filename} ({len(file_content)} bytes)")

    try:
        text = extract_text(file_content, filename)
        logger.info(f"Extracted {len(text)} chars from {filename}")

        chunks = chunk_text(text)
        logger.info(f"Split into {len(chunks)} chunks")

        num_points = await asyncio.to_thread(
            upsert_chunks, document_id, workspace_id, chunks
        )
        logger.info(f"Upserted {num_points} vectors to Qdrant")

        supabase = get_supabase_admin()
        for i, chunk_text_content in enumerate(chunks):
            supabase.table("document_chunks").insert({
                "id": str(uuid4()),
                "document_id": document_id,
                "chunk_index": i,
                "content": chunk_text_content,
                "token_count": len(chunk_text_content.split()),
            }).execute()

        supabase.table("documents").update({
            "status": "ready",
            "chunk_count": len(chunks),
        }).eq("id", document_id).execute()
        logger.info(f"Document {document_id} processed: {len(chunks)} chunks stored")

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

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
)
from app.config import get_settings
from app.services.embedding import generate_embedding, generate_embeddings
from app.services.chunking import extract_text, chunk_text
from app.services.llm import generate_response
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)
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
        logger.info(f"Creating Qdrant collection: {settings.QDRANT_COLLECTION}")
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

    try:
        query_embedding = generate_embedding(query)
        logger.info(f"Generated query embedding, dim={len(query_embedding)}")
    except Exception as e:
        logger.error(f"Failed to generate query embedding: {e}", exc_info=True)
        return []

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

    try:
        results = client.search(
            collection_name=settings.QDRANT_COLLECTION,
            query_vector=query_embedding,
            query_filter=search_filter,
            limit=top_k,
            with_payload=True,
        )
        logger.info(
            f"Qdrant search returned {len(results)} results "
            f"(workspace={workspace_id}, docs={selected_doc_ids})"
        )
    except Exception as e:
        logger.error(f"Qdrant search failed: {e}", exc_info=True)
        return []

    if not results:
        logger.warning(
            f"Qdrant returned 0 results. Trying without document filter..."
        )
        try:
            fallback_filter = Filter(
                must=[
                    FieldCondition(
                        key="workspace_id",
                        match=MatchValue(value=workspace_id),
                    ),
                ]
            )
            fallback_results = client.search(
                collection_name=settings.QDRANT_COLLECTION,
                query_vector=query_embedding,
                query_filter=fallback_filter,
                limit=top_k,
                with_payload=True,
            )
            logger.info(
                f"Fallback search (no doc filter) returned {len(fallback_results)} results"
            )
            if fallback_results:
                for hit in fallback_results[:3]:
                    logger.info(
                        f"  Fallback hit: doc_id={hit.payload.get('document_id')}, "
                        f"score={hit.score:.4f}"
                    )
        except Exception as e:
            logger.error(f"Fallback search also failed: {e}", exc_info=True)

    return [
        {
            "content": hit.payload.get("content", ""),
            "document_id": hit.payload.get("document_id", ""),
            "chunk_index": hit.payload.get("chunk_index", 0),
            "score": hit.score,
        }
        for hit in results
    ]


def search_chunks_from_supabase(
    workspace_id: str,
    selected_doc_ids: list[str],
) -> list[dict]:
    """Fallback: fetch chunks directly from Supabase when Qdrant has nothing."""
    from app.db.supabase_client import get_supabase_admin

    supabase = get_supabase_admin()
    query = (
        supabase.table("document_chunks")
        .select("id, document_id, chunk_index, content")
        .limit(10)
    )

    if selected_doc_ids:
        # Filter by document_ids via a join-like approach
        # First get document IDs that belong to this workspace
        docs = (
            supabase.table("documents")
            .select("id")
            .eq("workspace_id", workspace_id)
            .in_("id", selected_doc_ids)
            .eq("status", "ready")
            .execute()
        )
        valid_ids = [d["id"] for d in docs.data]
        if not valid_ids:
            return []
        query = query.in_("document_id", valid_ids)
    else:
        docs = (
            supabase.table("documents")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("status", "ready")
            .execute()
        )
        valid_ids = [d["id"] for d in docs.data]
        if not valid_ids:
            return []
        query = query.in_("document_id", valid_ids)

    result = query.execute()
    logger.info(f"Supabase fallback returned {len(result.data)} chunks")

    return [
        {
            "content": row["content"],
            "document_id": row["document_id"],
            "chunk_index": row.get("chunk_index", 0),
            "score": 0.5,  # No real similarity score from Supabase
        }
        for row in result.data
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
    import asyncio
    import time
    from uuid import uuid4
    from datetime import datetime, timezone
    from app.db.supabase_client import get_supabase_admin

    total_start = time.time()
    logger.info(f"[PROCESS] Starting document processing: {document_id} / {filename} ({len(file_content)} bytes)")

    supabase = get_supabase_admin()

    try:
        # Step 1: Extract text
        t0 = time.time()
        text = await asyncio.to_thread(extract_text, file_content, filename)
        t1 = time.time()
        logger.info(f"[PROCESS] Text extraction: {t1 - t0:.2f}s ({len(text)} chars from {filename})")

        if not text or len(text.strip()) < 10:
            raise ValueError(f"Extracted text is too short or empty ({len(text)} chars)")

        # Step 2: Chunk text
        t2 = time.time()
        chunks = await asyncio.to_thread(chunk_text, text)
        t3 = time.time()
        logger.info(f"[PROCESS] Chunking: {t3 - t2:.2f}s ({len(chunks)} chunks)")

        if not chunks:
            raise ValueError("Chunking produced 0 chunks")

        # Step 3: Store chunks in Supabase
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

        t4 = time.time()
        batch_size = 500
        for start in range(0, len(chunk_records), batch_size):
            batch = chunk_records[start : start + batch_size]
            supabase.table("document_chunks").insert(batch).execute()
        t5 = time.time()
        logger.info(f"[PROCESS] Supabase chunk insert: {t5 - t4:.2f}s ({len(chunk_records)} records)")

        # Step 4: Generate embeddings and store in Qdrant
        t6 = time.time()
        await asyncio.to_thread(upsert_chunks, document_id, workspace_id, chunks)
        t7 = time.time()
        logger.info(f"[PROCESS] Qdrant upsert: {t7 - t6:.2f}s")

        # Step 5: Mark as ready
        supabase.table("documents").update({
            "status": "ready",
            "chunk_count": len(chunks),
        }).eq("id", document_id).execute()

        logger.info(
            f"[PROCESS] DONE: {filename} — {len(chunks)} chunks, "
            f"total {time.time() - total_start:.2f}s"
        )

    except Exception as e:
        logger.error(f"[PROCESS] FAILED for {document_id} ({filename}): {e}", exc_info=True)
        try:
            supabase.table("documents").update({
                "status": "error",
                "error_message": str(e)[:500],
            }).eq("id", document_id).execute()
        except Exception:
            logger.error(f"Failed to update error status for {document_id}")

        # Cleanup
        try:
            delete_document_chunks(document_id)
        except Exception:
            pass
        try:
            supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
        except Exception:
            pass


async def delete_document_vectors(document_id: str):
    delete_document_chunks(document_id)


async def query_rag(
    query: str,
    workspace_id: str,
    selected_doc_ids: list[str],
    chat_history: list[dict],
    doc_map: dict[str, str],
) -> dict:
    logger.info(
        f"[RAG] Query: '{query[:80]}...' | "
        f"workspace={workspace_id} | docs={selected_doc_ids}"
    )

    # Step 1: Search Qdrant
    chunks = search_chunks(
        query=query,
        workspace_id=workspace_id,
        selected_doc_ids=selected_doc_ids,
    )

    # Step 2: Fallback to Supabase if Qdrant returned nothing
    if not chunks:
        logger.warning("[RAG] Qdrant returned 0 chunks. Trying Supabase fallback...")
        chunks = search_chunks_from_supabase(
            workspace_id=workspace_id,
            selected_doc_ids=selected_doc_ids,
        )

    if not chunks:
        logger.warning("[RAG] Both Qdrant and Supabase returned 0 chunks.")
        return {
            "response": "I couldn't find relevant information in the selected documents for your query. Try selecting different documents or rephrasing your question.",
            "citations": [],
        }

    logger.info(f"[RAG] Using {len(chunks)} chunks for context")

    # Step 3: Build context
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

    try:
        response_text = generate_response(prompt, system_prompt)
        logger.info(f"[RAG] LLM response generated ({len(response_text)} chars)")
    except Exception as e:
        logger.error(f"[RAG] LLM generation failed: {e}", exc_info=True)
        response_text = "I found relevant information in your documents but encountered an error generating the response. Please try again."

    # Step 4: Build citations
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

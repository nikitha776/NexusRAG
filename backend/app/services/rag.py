import asyncio
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
    PayloadSchemaType,
)
from app.config import get_settings
from app.services.embedding import generate_embedding, generate_embeddings
from app.services.chunking import extract_text, chunk_text
from app.services.llm import generate_response, stream_response
from app.services.errors import AnswerServiceError
from app.services.token_budget import count_tokens, trim_tokens, recent_history
from uuid import uuid4, uuid5, NAMESPACE_URL
import logging
import threading

logger = logging.getLogger(__name__)
settings = get_settings()

_qdrant_client = None
_index_recovery_lock = threading.Lock()
_prepared_client = None
_prepared_collection = None
_document_processing_lock = asyncio.Semaphore(1)


def get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None, timeout=settings.QDRANT_TIMEOUT)
    return _qdrant_client


def ensure_collection():
    global _prepared_client, _prepared_collection
    client = get_qdrant_client()
    if _prepared_client is client and _prepared_collection == settings.QDRANT_COLLECTION:
        return
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
    # Qdrant Cloud's strict filters require indexes on scoped payload fields.
    for field in ("workspace_id", "document_id", "embedding_profile"):
        client.create_payload_index(settings.QDRANT_COLLECTION, field, PayloadSchemaType.KEYWORD, wait=True)
    _prepared_client, _prepared_collection = client, settings.QDRANT_COLLECTION


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
        point_id = str(uuid5(NAMESPACE_URL, f"nexusrag:{settings.EMBEDDING_PROFILE}:{workspace_id}:{document_id}:{i}"))
        points.append(
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "workspace_id": workspace_id,
                    "chunk_index": i,
                    "embedding_profile": settings.EMBEDDING_PROFILE,
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


def restore_missing_document_vectors(workspace_id: str, selected_doc_ids: list[str]) -> None:
    """Restore a lost index from saved chunks, only for selected ready documents."""
    from app.db.supabase_client import get_supabase_admin

    client = get_qdrant_client()
    ensure_collection()
    for document_id in dict.fromkeys(selected_doc_ids):
        scope = Filter(must=[
            FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
            FieldCondition(key="document_id", match=MatchValue(value=document_id)),
            FieldCondition(key="embedding_profile", match=MatchValue(value=settings.EMBEDDING_PROFILE)),
        ])
        if client.count(settings.QDRANT_COLLECTION, count_filter=scope, exact=True).count:
            continue
        # Serialize recoveries in this process; deterministic point IDs also make
        # repeated recovery across API workers idempotent.
        with _index_recovery_lock:
            if client.count(settings.QDRANT_COLLECTION, count_filter=scope, exact=True).count:
                continue
            db = get_supabase_admin()
            documents = (db.table("documents").select("id,chunk_count")
                .eq("id", document_id).eq("workspace_id", workspace_id)
                .eq("status", "ready").execute().data)
            if not documents:
                continue
            expected = documents[0].get("chunk_count", 0)
            chunks = []
            offset = 0
            while True:
                batch = (db.table("document_chunks").select("chunk_index,content")
                    .eq("document_id", document_id).order("chunk_index")
                    .range(offset, offset + 499).execute().data)
                chunks.extend(batch)
                if len(batch) < 500:
                    break
                offset += len(batch)
            if (not chunks or len(chunks) != expected or
                    [chunk["chunk_index"] for chunk in chunks] != list(range(expected))):
                raise RuntimeError("The selected document's search index is incomplete. Retry processing it in Sources.")
            upsert_chunks(document_id, workspace_id, [chunk["content"] for chunk in chunks])
            logger.info("Restored missing search vectors for document %s (%s chunks)", document_id, len(chunks))


def search_chunks(
    query: str,
    workspace_id: str,
    selected_doc_ids: list[str],
    top_k: int = None,
) -> list[dict]:
    if not selected_doc_ids:
        return []
    client = get_qdrant_client()
    top_k = top_k or settings.TOP_K_RESULTS

    try:
        restore_missing_document_vectors(workspace_id, selected_doc_ids)
        query_embedding = generate_embedding(query)
        logger.info(f"Generated query embedding, dim={len(query_embedding)}")
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"Failed to prepare document search: {e}", exc_info=True)
        raise RuntimeError("Document search is temporarily unavailable. Please retry.") from e

    must_conditions = [
        FieldCondition(key="embedding_profile", match=MatchValue(value=settings.EMBEDDING_PROFILE)),
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
        raise RuntimeError("Document search is temporarily unavailable. Please retry.") from e

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
    if not client.collection_exists(settings.QDRANT_COLLECTION):
        return
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
    # A free instance should not parse and embed multiple PDFs concurrently.
    async with _document_processing_lock:
        await _process_document_background(document_id, file_content, filename, workspace_id)


async def _process_document_background(document_id: str, file_content: bytes, filename: str, workspace_id: str):
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
            "error_message": None,
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
                "error_message": str(e)[:500] if isinstance(e, ValueError) else "Processing failed. Check that this file contains readable text, then retry.",
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
    await asyncio.to_thread(delete_document_chunks, document_id)


async def prepare_rag(
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

    budget = settings.LLM_INPUT_TOKEN_BUDGET
    if count_tokens(query) > budget - 1024:
        raise AnswerServiceError("This question is too long to leave room for document context. Shorten it and try again.")

    # Resolve follow-ups before retrieval, not just during answer generation.
    retrieval_query = query
    if chat_history:
        recent = recent_history(chat_history, min(800, max(0, budget - count_tokens(query) - 512)))
        retrieval_query = await asyncio.to_thread(
            generate_response,
            f"Conversation:\n{recent}\n\nLatest question: {query}",
            "Rewrite the latest question as a standalone document-search question using the conversation. "
            "Resolve pronouns and implied topics. Do not answer it or add facts. Return only the rewritten question.",
            max_tokens=256,
        )

    # Step 1: Search Qdrant
    chunks = await asyncio.to_thread(search_chunks,
        query=retrieval_query,
        workspace_id=workspace_id,
        selected_doc_ids=selected_doc_ids,
    )

    if not chunks:
        logger.warning("[RAG] No matching chunks in the selected documents.")
        return {
            "response": "I couldn't find relevant information in the selected documents for your query. Try selecting different documents or rephrasing your question.",
            "citations": [],
        }

    logger.info(f"[RAG] Using {len(chunks)} chunks for context")

    system_prompt = """You are a helpful AI assistant for NexusRAG. You answer questions based ONLY on the provided context from the user's documents.

Rules:
1. Answer ONLY based on the provided context. If the context doesn't contain enough information, say so.
2. When you use information from a source, reference it naturally (e.g., "According to [Source 1]...").
3. Be concise and accurate.
4. If multiple sources discuss the topic, synthesize the information.
5. Do not make up information not present in the context.
6. Use previous conversation only to understand the question, not as evidence. Ground every factual answer in the current selected-document context."""

    def make_prompt(context, history):
        return (f"Context from selected documents:\n\n{context}\n\n"
                f"Previous conversation (for question context only):\n{history}\n\n"
                f"User question: {query}\n\nProvide a clear, helpful answer based on the context above:")

    # Reserve output/message overhead via the configured input limit, then
    # share the remaining context across ranked sources. Never send every
    # 1,024-word chunk unbounded, and never silently truncate the question.
    available = budget - count_tokens(system_prompt) - count_tokens(make_prompt("", "")) - 128
    history_text = recent_history(chat_history, min(800, max(0, available // 5)))
    remaining = max(0, available - count_tokens(history_text))
    context_parts, selected_chunks = [], []
    for index, chunk in enumerate(chunks):
        source_number = len(selected_chunks) + 1
        name = trim_tokens(doc_map.get(chunk["document_id"], "Unknown Document"), 100)
        header = f"[Source {source_number}: {name}]\n"
        share = remaining // (len(chunks) - index)
        excerpt = trim_tokens(chunk["content"], max(0, share - count_tokens(header) - 16)).strip()
        if not excerpt:
            continue
        part = header + excerpt
        context_parts.append(part)
        selected_chunks.append({**chunk, "content": excerpt})
        remaining -= count_tokens(part) + 8
    if not selected_chunks:
        raise AnswerServiceError("This question leaves too little room for document context. Shorten it and try again.")
    chunks = selected_chunks
    prompt = make_prompt("\n\n---\n\n".join(context_parts), history_text)
    logger.info("Prepared bounded answer context: %s input tokens, %s passages", count_tokens(prompt) + count_tokens(system_prompt), len(chunks))

    citations = [
        {
            "source_number": i + 1,
            "chunk_index": chunk.get("chunk_index"),
            "document_id": chunk["document_id"],
            "filename": doc_map.get(chunk["document_id"], "Unknown"),
            "chunk_content": chunk["content"],
            "score": round(chunk["score"], 4),
        }
        for i, chunk in enumerate(chunks)
    ]

    return {"prompt": prompt, "system_prompt": system_prompt, "citations": citations}


async def query_rag(query, workspace_id, selected_doc_ids, chat_history, doc_map) -> dict:
    prepared = await prepare_rag(query, workspace_id, selected_doc_ids, chat_history, doc_map)
    if "response" in prepared:
        return prepared
    try:
        text = await asyncio.to_thread(generate_response, prepared["prompt"], prepared["system_prompt"])
    except AnswerServiceError:
        raise
    except Exception as exc:
        raise RuntimeError("The answer service is temporarily unavailable. Please retry.") from exc
    return {"response": text, "citations": prepared["citations"]}


async def stream_rag(query, workspace_id, selected_doc_ids, chat_history, doc_map):
    prepared = await prepare_rag(query, workspace_id, selected_doc_ids, chat_history, doc_map)
    yield {"type": "sources", "citations": prepared["citations"]}
    if "response" in prepared:
        yield {"type": "token", "text": prepared["response"]}
        return
    stream = stream_response(prepared["prompt"], prepared["system_prompt"])
    try:
        async for text in stream:
            yield {"type": "token", "text": text}
    finally:
        await stream.aclose()

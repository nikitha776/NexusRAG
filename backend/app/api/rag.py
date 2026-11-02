import logging
import json
import asyncio
from fastapi import Request
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import RAGQueryRequest, ChatMessageResponse
from app.services.rag import query_rag, stream_rag

router = APIRouter(prefix="/workspaces/{workspace_id}/rag", tags=["rag"])


def verify_workspace(workspace_id: str, user_id: str):
    supabase = get_supabase_admin()
    result = (
        supabase.table("workspaces")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workspace not found")


def prepare_query(workspace_id, data, user):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()

    session_check = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("id", str(data.session_id))
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not session_check.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    doc_ids = list(dict.fromkeys(data.selected_doc_ids))
    docs_result = (supabase.table("documents").select("id,filename,status")
        .in_("id", doc_ids).eq("workspace_id", workspace_id).execute())
    if len(docs_result.data) != len(doc_ids) or any(d["status"] != "ready" for d in docs_result.data):
        raise HTTPException(status_code=400, detail="Select ready documents from this workspace only.")
    doc_map = {d["id"]: d["filename"] for d in docs_result.data}

    history_result = (
        supabase.table("chat_messages")
        .select("role,content,selected_doc_ids,created_at")
        .eq("session_id", str(data.session_id))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    history = [
        {"role": m["role"], "content": m["content"], "selected_doc_ids": m.get("selected_doc_ids")}
        for m in reversed(history_result.data)
    ]

    return supabase, session_check, doc_ids, doc_map, history


def save_answer(supabase, session_check, data, doc_ids, rag_result):
    now = datetime.now(timezone.utc).isoformat()
    # Persist both sides in one insert only after successful generation.
    assistant_msg_id = str(uuid4())
    supabase.table("chat_messages").insert([
        {"id": str(uuid4()), "session_id": data.session_id, "role": "user",
         "content": data.query, "selected_doc_ids": doc_ids, "created_at": now},
        {"id": assistant_msg_id, "session_id": data.session_id, "role": "assistant",
         "content": rag_result["response"], "citations": rag_result["citations"],
         "selected_doc_ids": doc_ids, "created_at": datetime.now(timezone.utc).isoformat()},
    ]).execute()
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if session_check.data[0].get("title", "New Chat") == "New Chat":
        updates["title"] = data.query[:100]
    try:
        supabase.table("chat_sessions").update(updates).eq("id", data.session_id).execute()
    except Exception:
        # Do not report a send failure after the messages were already saved.
        logging.exception("Could not refresh session metadata")

    return ChatMessageResponse(
        id=assistant_msg_id,
        role="assistant",
        content=rag_result["response"],
        citations=rag_result["citations"],
        selected_doc_ids=[str(d) for d in data.selected_doc_ids],
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/query", response_model=ChatMessageResponse)
async def rag_query(workspace_id: str, data: RAGQueryRequest, user: dict = Depends(get_current_user)):
    supabase, session, ids, names, history = prepare_query(workspace_id, data, user)
    try:
        result = await query_rag(data.query, workspace_id, ids, history, names)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return save_answer(supabase, session, data, ids, result)


@router.post("/stream")
async def rag_stream(workspace_id: str, data: RAGQueryRequest, request: Request,
                     user: dict = Depends(get_current_user)):
    supabase, session, ids, names, history = await asyncio.to_thread(prepare_query, workspace_id, data, user)

    async def events():
        text, citations = "", []
        stream = stream_rag(data.query, workspace_id, ids, history, names)
        try:
            async for event in stream:
                if await request.is_disconnected():
                    return
                if event["type"] == "token":
                    text += event["text"]
                elif event["type"] == "sources":
                    citations = event["citations"]
                yield json.dumps(event) + "\n"
            if await request.is_disconnected():
                return
            # No partial turns enter conversation memory on errors or cancellation.
            message = await asyncio.to_thread(save_answer, supabase, session, data, ids,
                                             {"response": text, "citations": citations})
            yield json.dumps({"type": "done", "message": message.model_dump()}) + "\n"
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logging.exception("Streaming answer failed")
            detail = str(exc) if isinstance(exc, RuntimeError) else "Could not finish or save this answer. Please retry."
            yield json.dumps({"type": "error", "detail": detail}) + "\n"
        finally:
            await stream.aclose()

    return StreamingResponse(events(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

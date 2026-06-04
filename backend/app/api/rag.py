from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import RAGQueryRequest, ChatMessageResponse
from app.services.rag import query_rag

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


@router.post("/query", response_model=ChatMessageResponse)
async def rag_query(
    workspace_id: str, data: RAGQueryRequest, user: dict = Depends(get_current_user)
):
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

    now = datetime.now(timezone.utc).isoformat()
    user_msg_id = str(uuid4())
    supabase.table("chat_messages").insert({
        "id": user_msg_id,
        "session_id": str(data.session_id),
        "role": "user",
        "content": data.query,
        "selected_doc_ids": [str(d) for d in data.selected_doc_ids],
        "created_at": now,
    }).execute()

    history_result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("session_id", str(data.session_id))
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in reversed(history_result.data)
    ]

    doc_ids = [str(d) for d in data.selected_doc_ids]
    docs_result = (
        supabase.table("documents")
        .select("id,filename")
        .in_("id", doc_ids)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    doc_map = {d["id"]: d["filename"] for d in docs_result.data}

    rag_result = await query_rag(
        query=data.query,
        workspace_id=workspace_id,
        selected_doc_ids=doc_ids,
        chat_history=history,
        doc_map=doc_map,
    )

    assistant_msg_id = str(uuid4())
    supabase.table("chat_messages").insert({
        "id": assistant_msg_id,
        "session_id": str(data.session_id),
        "role": "assistant",
        "content": rag_result["response"],
        "citations": rag_result["citations"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    session_title = session_check.data[0].get("title", "New Chat")
    if session_title == "New Chat":
        supabase.table("chat_sessions").update({
            "title": data.query[:100],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(data.session_id)).execute()

    return ChatMessageResponse(
        id=assistant_msg_id,
        role="assistant",
        content=rag_result["response"],
        citations=rag_result["citations"],
        selected_doc_ids=[str(d) for d in data.selected_doc_ids],
        created_at=datetime.now(timezone.utc).isoformat(),
    )

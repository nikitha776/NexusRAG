from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import ChatSessionCreate, ChatSessionResponse, ChatMessageResponse

router = APIRouter(prefix="/workspaces/{workspace_id}/chat", tags=["chat"])


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


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_chat_sessions(workspace_id: str, user: dict = Depends(get_current_user)):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    result = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return [
        ChatSessionResponse(
            id=s["id"], title=s["title"],
            created_at=s["created_at"], updated_at=s["updated_at"],
        )
        for s in result.data
    ]


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    workspace_id: str, data: ChatSessionCreate, user: dict = Depends(get_current_user)
):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    session_data = {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "title": data.title or "New Chat",
        "created_at": now,
        "updated_at": now,
    }
    result = supabase.table("chat_sessions").insert(session_data).execute()
    s = result.data[0]
    return ChatSessionResponse(
        id=s["id"], title=s["title"],
        created_at=s["created_at"], updated_at=s["updated_at"],
    )


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def list_messages(
    workspace_id: str, session_id: str, user: dict = Depends(get_current_user)
):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()

    session_check = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not session_check.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [
        ChatMessageResponse(
            id=m["id"], role=m["role"], content=m["content"],
            citations=m.get("citations"), selected_doc_ids=m.get("selected_doc_ids"),
            created_at=m["created_at"],
        )
        for m in result.data
    ]


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    workspace_id: str, session_id: str, user: dict = Depends(get_current_user)
):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()

    session_check = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not session_check.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
    supabase.table("chat_sessions").delete().eq("id", session_id).execute()
    return {"detail": "Session deleted"}

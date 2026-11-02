"""Search saved chats through owner-scoped joins, without loading all history."""
import asyncio
import logging
import re
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import ChatSearchResponse

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


def snippet(content: str, query: str, size: int = 280) -> str:
    text = " ".join(content.split())
    position = text.lower().find(query.lower())
    start = max(0, position - 70) if position >= 0 else 0
    end = start + size
    return ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")


def search_saved_chats(user_id, query, workspace_id, message_offset, title_offset, limit):
    db = get_supabase_admin()
    # Escaped regex means punctuation such as C++, %, _, and * is literal.
    pattern = re.escape(query)
    messages = (db.table("chat_messages")
        .select("id,role,content,created_at,chat_sessions!inner(id,title,workspace_id,workspaces!inner(id,name,user_id))")
        .eq("chat_sessions.workspaces.user_id", user_id)
        .filter("content", "imatch", pattern))
    titles = (db.table("chat_sessions")
        .select("id,title,workspace_id,updated_at,workspaces!inner(id,name,user_id)")
        .eq("workspaces.user_id", user_id)
        .filter("title", "imatch", pattern))
    if workspace_id:
        messages = messages.eq("chat_sessions.workspace_id", workspace_id)
        titles = titles.eq("workspace_id", workspace_id)
    message_rows = messages.order("created_at", desc=True).order("id", desc=True).range(message_offset, message_offset + limit).execute().data
    title_rows = titles.order("updated_at", desc=True).order("id", desc=True).range(title_offset, title_offset + limit).execute().data
    hits = []
    for row in message_rows:
        session = row.get("chat_sessions") or {}
        workspace = session.get("workspaces") or {}
        if workspace.get("user_id") != user_id or (workspace_id and workspace.get("id") != workspace_id):
            continue
        hits.append({"id": f"message:{row['id']}", "match_type": "message", "message_id": row["id"],
            "session_id": session["id"], "title": session["title"], "workspace_id": workspace["id"],
            "workspace_name": workspace["name"], "role": row["role"], "snippet": snippet(row["content"], query),
            "created_at": row["created_at"]})
    for row in title_rows:
        workspace = row.get("workspaces") or {}
        if workspace.get("user_id") != user_id or (workspace_id and workspace.get("id") != workspace_id):
            continue
        hits.append({"id": f"title:{row['id']}", "match_type": "title", "message_id": None,
            "session_id": row["id"], "title": row["title"], "workspace_id": workspace["id"],
            "workspace_name": workspace["name"], "role": None, "snippet": snippet(row["title"], query),
            "created_at": row["updated_at"]})
    hits.sort(key=lambda hit: (hit["created_at"], hit["id"]), reverse=True)
    page = hits[:limit]
    # Advance each source only by the hits actually consumed in the merged page.
    # Both queries fetch one extra hit to detect another page, with bounded memory.
    cursor = None
    if len(hits) > limit:
        cursor = {"messages": message_offset + sum(hit["match_type"] == "message" for hit in page),
                  "titles": title_offset + sum(hit["match_type"] == "title" for hit in page)}
    return {"results": page, "next": cursor}


@router.get("/search", response_model=ChatSearchResponse)
async def search_conversations(
    q: str = Query(min_length=2, max_length=200),
    workspace_id: UUID | None = None,
    message_offset: int = Query(default=0, ge=0),
    title_offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    query = " ".join(q.replace("\x00", "").split())
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Enter at least two characters to search.")
    try:
        return await asyncio.to_thread(search_saved_chats, user["id"], query,
            str(workspace_id) if workspace_id else None, message_offset, title_offset, limit)
    except Exception as exc:
        logger.exception("Conversation search failed")
        raise HTTPException(status_code=503, detail="Conversation search is temporarily unavailable. Please retry.") from exc

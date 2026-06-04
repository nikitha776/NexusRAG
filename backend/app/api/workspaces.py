from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("workspaces")
        .select("*")
        .eq("user_id", user["id"])
        .order("updated_at", desc=True)
        .execute()
    )

    responses = []
    for ws in result.data:
        doc_count = (
            supabase.table("documents")
            .select("id", count="exact")
            .eq("workspace_id", ws["id"])
            .execute()
        )
        responses.append(
            WorkspaceResponse(
                id=ws["id"],
                name=ws["name"],
                description=ws.get("description"),
                created_at=ws["created_at"],
                updated_at=ws["updated_at"],
                document_count=doc_count.count or 0,
            )
        )
    return responses


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(data: WorkspaceCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    ws_data = {
        "id": str(uuid4()),
        "user_id": user["id"],
        "name": data.name,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
    }
    result = supabase.table("workspaces").insert(ws_data).execute()
    ws = result.data[0]
    return WorkspaceResponse(
        id=ws["id"], name=ws["name"], description=ws.get("description"),
        created_at=ws["created_at"], updated_at=ws["updated_at"], document_count=0,
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("workspaces")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws = result.data[0]
    doc_count = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("workspace_id", ws["id"])
        .execute()
    )
    return WorkspaceResponse(
        id=ws["id"], name=ws["name"], description=ws.get("description"),
        created_at=ws["created_at"], updated_at=ws["updated_at"],
        document_count=doc_count.count or 0,
    )


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(workspace_id: str, data: WorkspaceUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    existing = (
        supabase.table("workspaces")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Workspace not found")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:
        updates["name"] = data.name
    if data.description is not None:
        updates["description"] = data.description

    result = (
        supabase.table("workspaces").update(updates).eq("id", workspace_id).execute()
    )
    ws = result.data[0]
    doc_count = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("workspace_id", ws["id"])
        .execute()
    )
    return WorkspaceResponse(
        id=ws["id"], name=ws["name"], description=ws.get("description"),
        created_at=ws["created_at"], updated_at=ws["updated_at"],
        document_count=doc_count.count or 0,
    )


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    existing = (
        supabase.table("workspaces")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Workspace not found")

    docs = (
        supabase.table("documents")
        .select("id,file_path")
        .eq("workspace_id", workspace_id)
        .execute()
    )

    from app.services.rag import delete_document_vectors
    from app.services.storage import delete_file_from_s3

    for doc in docs.data:
        try:
            await delete_document_vectors(doc["id"])
        except Exception:
            pass
        try:
            await delete_file_from_s3(doc["file_path"])
        except Exception:
            pass
        supabase.table("document_chunks").delete().eq("document_id", doc["id"]).execute()

    sessions = (
        supabase.table("chat_sessions")
        .select("id")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    for s in sessions.data:
        supabase.table("chat_messages").delete().eq("session_id", s["id"]).execute()

    supabase.table("chat_sessions").delete().eq("workspace_id", workspace_id).execute()
    supabase.table("documents").delete().eq("workspace_id", workspace_id).execute()
    supabase.table("workspaces").delete().eq("id", workspace_id).execute()

    return {"detail": "Workspace and all associated data deleted"}

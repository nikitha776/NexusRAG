from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from uuid import uuid4
from datetime import datetime, timezone
import asyncio
import logging
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import DocumentResponse
from app.services.storage import upload_file_to_s3, delete_file_from_s3, download_file_from_s3
from app.services.rag import process_document_background

router = APIRouter(prefix="/workspaces/{workspace_id}/documents", tags=["documents"])


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
    return result.data[0]


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(workspace_id: str, user: dict = Depends(get_current_user)):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        DocumentResponse(
            id=d["id"], filename=d["filename"], file_type=d["file_type"],
            file_size=d["file_size"], status=d["status"],
            chunk_count=d.get("chunk_count", 0), created_at=d["created_at"],
        )
        for d in result.data
    ]


@router.post("/", response_model=list[DocumentResponse])
async def upload_documents(
    workspace_id: str,
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    uploaded = []

    async def process_file(file: UploadFile):
        if not file.filename:
            return None

        file_content = await file.read()
        file_path = f"{user['id']}/{workspace_id}/{file.filename}"
        await upload_file_to_s3(file_path, file_content, file.content_type or "application/octet-stream")

        doc_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc_data = {
            "id": doc_id,
            "workspace_id": workspace_id,
            "filename": file.filename,
            "file_path": file_path,
            "file_type": file.content_type or "application/octet-stream",
            "file_size": len(file_content),
            "status": "processing",
            "chunk_count": 0,
            "created_at": now,
        }
        supabase.table("documents").insert(doc_data).execute()

        asyncio.create_task(
            process_document_background(
                document_id=doc_id,
                file_content=file_content,
                filename=file.filename,
                workspace_id=workspace_id,
            )
        )

        return DocumentResponse(
            id=doc_id, filename=file.filename,
            file_type=doc_data["file_type"], file_size=doc_data["file_size"],
            status="processing", chunk_count=0, created_at=now,
        )

    results = await asyncio.gather(*[process_file(file) for file in files], return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            logging.error(f"File upload failed: {r}")
        elif r is not None:
            uploaded.append(r)

    return uploaded


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(workspace_id: str, document_id: str, user: dict = Depends(get_current_user)):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    d = result.data[0]
    return DocumentResponse(
        id=d["id"], filename=d["filename"], file_type=d["file_type"],
        file_size=d["file_size"], status=d["status"],
        chunk_count=d.get("chunk_count", 0), created_at=d["created_at"],
    )


@router.delete("/{document_id}")
async def delete_document(workspace_id: str, document_id: str, user: dict = Depends(get_current_user)):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = result.data[0]

    from app.services.rag import delete_document_vectors
    await delete_document_vectors(document_id)

    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    await delete_file_from_s3(doc["file_path"])
    supabase.table("documents").delete().eq("id", document_id).execute()

    return {"detail": "Document deleted"}


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    workspace_id: str, document_id: str, user: dict = Depends(get_current_user)
):
    verify_workspace(workspace_id, user["id"])
    supabase = get_supabase_admin()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = result.data[0]
    supabase.table("documents").update({"status": "processing", "chunk_count": 0}).eq("id", document_id).execute()
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()

    from app.services.rag import delete_document_vectors
    await delete_document_vectors(document_id)

    file_content = await download_file_from_s3(doc["file_path"])

    asyncio.create_task(
        process_document_background(
            document_id=document_id,
            file_content=file_content,
            filename=doc["filename"],
            workspace_id=workspace_id,
        )
    )

    return {"detail": "Reprocessing started"}

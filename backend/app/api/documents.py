from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path
from fastapi.responses import Response
from urllib.parse import quote
import logging
from app.api.deps import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.schemas.api import DocumentResponse, UploadResponse
from app.services.chunking import SUPPORTED_EXTENSIONS, MAX_FILE_BYTES
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
            chunk_count=d.get("chunk_count", 0), created_at=d["created_at"], error_message=d.get("error_message"),
        )
        for d in result.data
    ]


@router.post("/", response_model=UploadResponse)
async def upload_documents(
    workspace_id: str,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    verify_workspace(workspace_id, user["id"])
    if not 1 <= len(files) <= 10:
        raise HTTPException(status_code=400, detail="Upload between 1 and 10 files at a time.")
    supabase = get_supabase_admin()
    uploaded, errors = [], []
    for file in files:
        filename = Path((file.filename or "").replace("\\", "/")).name
        storage_key = None
        try:
            if not filename or len(filename) > 500 or Path(filename).suffix.lower() not in SUPPORTED_EXTENSIONS:
                raise ValueError("Use PDF, DOCX, TXT, MD, or CSV. Legacy DOC files must be converted to DOCX.")
            content = await file.read(MAX_FILE_BYTES + 1)
            if not content:
                raise ValueError("This file is empty.")
            if len(content) > MAX_FILE_BYTES:
                raise ValueError("This file exceeds the 50 MB limit.")
            doc_id = str(uuid4())
            storage_key = f"{user['id']}/{workspace_id}/{doc_id}/{filename}"
            await upload_file_to_s3(storage_key, content, file.content_type or "application/octet-stream")
            doc_data = {
                "id": doc_id, "workspace_id": workspace_id, "filename": filename,
                "file_path": storage_key, "file_type": Path(filename).suffix.lower().lstrip("."),
                "file_size": len(content), "status": "processing", "chunk_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("documents").insert(doc_data).execute()
            background_tasks.add_task(process_document_background, doc_id, content, filename, workspace_id)
            uploaded.append(DocumentResponse(**doc_data))
        except Exception as exc:
            logging.exception("Upload failed for %s", filename)
            if storage_key:
                try:
                    await delete_file_from_s3(storage_key)
                except Exception:
                    logging.exception("Could not clean up failed upload")
            errors.append({"filename": filename or "Unnamed file", "error": str(exc) if isinstance(exc, ValueError) else "Upload failed. Please retry."})
        finally:
            await file.close()
    return {"documents": uploaded, "errors": errors}


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
        chunk_count=d.get("chunk_count", 0), created_at=d["created_at"], error_message=d.get("error_message"),
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
    if doc["status"] == "processing":
        raise HTTPException(status_code=409, detail="Wait for processing to finish before deleting this document.")

    from app.services.rag import delete_document_vectors
    await delete_document_vectors(document_id)

    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    await delete_file_from_s3(doc["file_path"])
    supabase.table("documents").delete().eq("id", document_id).execute()

    return {"detail": "Document deleted"}


@router.get("/{document_id}/preview")
async def preview_document(workspace_id: str, document_id: str, user: dict = Depends(get_current_user)):
    """Return extracted text with stable passage positions, never a public storage URL."""
    verify_workspace(workspace_id, user["id"])
    db = get_supabase_admin()
    docs = (db.table("documents").select("id,filename,status,file_type")
            .eq("id", document_id).eq("workspace_id", workspace_id).execute().data)
    if not docs:
        raise HTTPException(status_code=404, detail="Document not found")
    if docs[0]["status"] != "ready":
        raise HTTPException(status_code=409, detail="This document is not ready for preview.")
    if docs[0].get("file_type") == "pdf":
        return {"id": document_id, "filename": docs[0]["filename"], "file_type": "pdf", "chunks": []}
    chunks, offset = [], 0
    while True:
        batch = (db.table("document_chunks").select("chunk_index,content")
                 .eq("document_id", document_id).order("chunk_index")
                 .range(offset, offset + 499).execute().data)
        chunks.extend(batch)
        if len(batch) < 500:
            break
        offset += len(batch)
    return {"id": document_id, "filename": docs[0]["filename"], "chunks": chunks}


@router.get("/{document_id}/file")
async def preview_pdf_file(workspace_id: str, document_id: str, user: dict = Depends(get_current_user)):
    verify_workspace(workspace_id, user["id"])
    db = get_supabase_admin()
    docs = (db.table("documents").select("filename,file_path,file_type")
            .eq("id", document_id).eq("workspace_id", workspace_id).execute().data)
    if not docs:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = docs[0]
    if doc["file_type"] != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files can be opened in the PDF viewer.")
    try:
        content = await download_file_from_s3(doc["file_path"])
    except Exception as exc:
        logging.exception("Could not load PDF preview")
        raise HTTPException(status_code=503, detail="Could not load this PDF. Please retry.") from exc
    return Response(content, media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(doc['filename'], safe='')}",
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    workspace_id: str, document_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)
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
    claimed = supabase.table("documents").update({"status": "processing", "error_message": None}).eq("id", document_id).neq("status", "processing").execute()
    if not claimed.data:
        raise HTTPException(status_code=409, detail="This document is already processing.")
    try:
        file_content = await download_file_from_s3(doc["file_path"])
        from app.services.rag import delete_document_vectors
        await delete_document_vectors(document_id)
        supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
        supabase.table("documents").update({"chunk_count": 0}).eq("id", document_id).execute()
    except Exception as exc:
        supabase.table("documents").update({"status": "error", "error_message": "Could not prepare this document for reprocessing. Please retry."}).eq("id", document_id).execute()
        raise HTTPException(status_code=503, detail="Could not start reprocessing. Please retry.") from exc
    background_tasks.add_task(process_document_background, document_id, file_content, doc["filename"], workspace_id)
    return {"detail": "Reprocessing started"}

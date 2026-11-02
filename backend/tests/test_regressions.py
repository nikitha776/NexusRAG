"""Offline regression checks. No production services or credentials are used."""
import asyncio
import json
import io
import os
import sys
import unittest
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

for key, value in {
    "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_ANON_KEY": "test",
    "SUPABASE_SERVICE_KEY": "test", "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
    "S3_ACCESS_KEY": "test", "S3_SECRET_KEY": "test", "GROQ_API_KEY": "test",
}.items():
    os.environ[key] = value

# Replace only external AI adapters; exercise real routing, scoping, and processing logic.
sys.modules["app.services.embedding"] = SimpleNamespace(generate_embedding=MagicMock(), generate_embeddings=MagicMock())
sys.modules["app.services.llm"] = SimpleNamespace(generate_response=MagicMock(), stream_response=MagicMock())
from fastapi import BackgroundTasks, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from app.api import deps, documents, rag
from app.schemas.api import RAGQueryRequest, WorkspaceCreate
from app.services.chunking import chunk_text, extract_text
from app.services import rag as retrieval


def table(data):
    builder = MagicMock()
    for method in ("select", "eq", "neq", "in_", "order", "limit", "update", "insert", "upsert", "delete"):
        getattr(builder, method).return_value = builder
    builder.execute.return_value = SimpleNamespace(data=data)
    return builder


class ExtractionTests(unittest.TestCase):
    def test_zero_overlap_and_exact_boundary(self):
        self.assertEqual(chunk_text("a b c d", 2, 0), ["a b", "c d"])
        self.assertEqual(chunk_text("a b c d", 4, 1), ["a b c d"])
        self.assertEqual(chunk_text("a b c d e", 3, 1), ["a b c", "c d e"])

    def test_invalid_chunk_settings(self):
        for size, overlap in [(0, 0), (2, 2), (2, -1)]:
            with self.assertRaises(ValueError):
                chunk_text("test", size, overlap)

    def test_docx_paragraphs_and_tables(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello world</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        self.assertEqual(extract_text(stream.getvalue(), "report.DOCX"), "Hello world\nTable cell")

    def test_unsupported_binary_and_blank_inputs(self):
        with self.assertRaises(ValueError):
            extract_text(b"binary", "legacy.doc")
        with self.assertRaises(ValueError):
            RAGQueryRequest(query=" ", session_id="s", selected_doc_ids=["d"])
        with self.assertRaises(ValueError):
            RAGQueryRequest(query="question", session_id="s", selected_doc_ids=[])
        with self.assertRaises(ValueError):
            WorkspaceCreate(name=" ")


class AuthTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_token(self):
        with self.assertRaises(HTTPException) as caught:
            await deps.get_current_user(None)
        self.assertEqual(caught.exception.status_code, 401)

    async def test_forged_or_expired_token_never_queries_database(self):
        client = MagicMock()
        rejected = Exception("invalid signature")
        rejected.status = 401
        client.auth.get_user.side_effect = rejected
        with patch.object(deps, "get_supabase_admin", return_value=client):
            with self.assertRaises(HTTPException) as caught:
                await deps.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="forged.jwt.value"))
        self.assertEqual(caught.exception.status_code, 401)
        client.table.assert_not_called()

    async def test_auth_outage_is_not_session_expiry(self):
        client = MagicMock()
        client.auth.get_user.side_effect = ConnectionError("offline")
        with patch.object(deps, "get_supabase_admin", return_value=client):
            with self.assertRaises(HTTPException) as caught:
                await deps.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="token"))
        self.assertEqual(caught.exception.status_code, 503)

    async def test_identity_comes_from_verified_user(self):
        client = MagicMock()
        client.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id="verified-id"))
        builder = table([{"id": "verified-id"}])
        client.table.return_value = builder
        with patch.object(deps, "get_supabase_admin", return_value=client):
            result = await deps.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="token"))
        self.assertEqual(result["id"], "verified-id")
        builder.eq.assert_called_with("id", "verified-id")


class UploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_same_filenames_get_unique_storage_and_partial_errors(self):
        client = MagicMock()
        client.table.return_value = table([])
        upload = AsyncMock()
        files = [UploadFile(filename="notes.txt", file=io.BytesIO(b"hello world")) for _ in range(2)]
        files.append(UploadFile(filename="old.doc", file=io.BytesIO(b"binary")))
        tasks = BackgroundTasks()
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client), patch.object(documents, "upload_file_to_s3", upload):
            result = await documents.upload_documents("workspace", tasks, files, {"id": "user"})
        keys = [call.args[0] for call in upload.await_args_list]
        self.assertEqual(len(set(keys)), 2)
        self.assertTrue(all(key.startswith("user/workspace/") for key in keys))
        self.assertEqual(len(result["documents"]), 2)
        self.assertEqual(result["errors"][0]["filename"], "old.doc")
        self.assertEqual(len(tasks.tasks), 2)

    async def test_oversized_file_never_reaches_storage(self):
        upload = AsyncMock()
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin"), patch.object(documents, "MAX_FILE_BYTES", 3), patch.object(documents, "upload_file_to_s3", upload):
            result = await documents.upload_documents("w", BackgroundTasks(), [UploadFile(filename="big.txt", file=io.BytesIO(b"1234"))], {"id": "u"})
        self.assertEqual(len(result["errors"]), 1)
        upload.assert_not_awaited()

    async def test_database_failure_cleans_uploaded_object(self):
        client = MagicMock()
        builder = table([])
        builder.execute.side_effect = RuntimeError("database offline")
        client.table.return_value = builder
        cleanup = AsyncMock()
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client), patch.object(documents, "upload_file_to_s3", AsyncMock()), patch.object(documents, "delete_file_from_s3", cleanup):
            result = await documents.upload_documents("w", BackgroundTasks(), [UploadFile(filename="file.txt", file=io.BytesIO(b"abc"))], {"id": "u"})
        self.assertEqual(result["documents"], [])
        cleanup.assert_awaited_once()

    async def test_retry_download_failure_sets_error_status(self):
        builder = table([{"id": "d", "filename": "f.txt", "file_path": "key", "status": "error"}])
        client = MagicMock()
        client.table.return_value = builder
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client), patch.object(documents, "download_file_from_s3", AsyncMock(side_effect=ConnectionError())):
            with self.assertRaises(HTTPException) as caught:
                await documents.reprocess_document("w", "d", BackgroundTasks(), {"id": "u"})
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(builder.update.call_args.args[0]["status"], "error")


class RetrievalTests(unittest.IsolatedAsyncioTestCase):
    async def test_foreign_or_processing_documents_rejected_before_generation(self):
        for rows in ([], [{"id": "d", "filename": "f", "status": "processing"}]):
            builders = {"chat_sessions": table([{"id": "s"}]), "documents": table(rows), "chat_messages": table([])}
            client = MagicMock()
            client.table.side_effect = builders.__getitem__
            generate = AsyncMock()
            with patch.object(rag, "verify_workspace"), patch.object(rag, "get_supabase_admin", return_value=client), patch.object(rag, "query_rag", generate):
                with self.assertRaises(HTTPException) as caught:
                    await rag.rag_query("w", RAGQueryRequest(query="question", session_id="s", selected_doc_ids=["d"]), {"id": "u"})
            self.assertEqual(caught.exception.status_code, 400)
            generate.assert_not_awaited()
            builders["chat_messages"].insert.assert_not_called()
            builders["documents"].eq.assert_called_with("workspace_id", "w")

    async def test_failed_generation_does_not_persist_half_conversation(self):
        builders = {"chat_sessions": table([{"id": "s"}]), "documents": table([{"id": "d", "filename": "f", "status": "ready"}]), "chat_messages": table([])}
        client = MagicMock()
        client.table.side_effect = builders.__getitem__
        with patch.object(rag, "verify_workspace"), patch.object(rag, "get_supabase_admin", return_value=client), patch.object(rag, "query_rag", AsyncMock(side_effect=RuntimeError("offline"))):
            with self.assertRaises(HTTPException) as caught:
                await rag.rag_query("w", RAGQueryRequest(query="question", session_id="s", selected_doc_ids=["d"]), {"id": "u"})
        self.assertEqual(caught.exception.status_code, 503)
        builders["chat_messages"].insert.assert_not_called()

    async def test_numbered_sources_retain_multiple_passages_from_same_document(self):
        chunks = [{"document_id": "d", "content": content, "score": .8} for content in ("first passage", "second passage")]
        with patch.object(retrieval, "search_chunks", return_value=chunks), patch.object(retrieval, "generate_response", return_value="Answer [Source 2]"):
            result = await retrieval.query_rag("q", "w", ["d"], [], {"d": "file.txt"})
        self.assertEqual([c["source_number"] for c in result["citations"]], [1, 2])
        self.assertEqual(result["citations"][1]["chunk_content"], "second passage")

    async def test_empty_selection_never_searches_all_workspace_documents(self):
        with patch.object(retrieval, "get_qdrant_client") as client:
            self.assertEqual(retrieval.search_chunks("query", "w", []), [])
        client.assert_not_called()


class ConversationFeaturesTests(unittest.IsolatedAsyncioTestCase):
    async def test_followup_is_resolved_before_scoped_search(self):
        with patch.object(retrieval, "generate_response", return_value="Explain Redis caching in detail"), patch.object(retrieval, "search_chunks", return_value=[]) as search:
            await retrieval.query_rag("explain that", "w", ["d"], [{"role": "user", "content": "What is Redis caching?"}], {"d": "f"})
        self.assertEqual(search.call_args.kwargs["query"], "Explain Redis caching in detail")
        self.assertEqual(search.call_args.kwargs["selected_doc_ids"], ["d"])

    async def test_preview_scopes_document_before_reading_text(self):
        client = MagicMock()
        docs = table([])
        client.table.return_value = docs
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client):
            with self.assertRaises(HTTPException) as error:
                await documents.preview_document("w", "foreign", {"id": "u"})
        self.assertEqual(error.exception.status_code, 404)
        docs.eq.assert_called_with("workspace_id", "w")
        client.table.assert_called_once_with("documents")

    async def test_pdf_file_requires_workspace_document_access_before_storage(self):
        client = MagicMock()
        client.table.return_value = table([])
        download = AsyncMock()
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client), patch.object(documents, "download_file_from_s3", download):
            with self.assertRaises(HTTPException) as error:
                await documents.preview_pdf_file("w", "foreign", {"id": "u"})
        self.assertEqual(error.exception.status_code, 404)
        download.assert_not_awaited()
        client.table.return_value.eq.assert_called_with("workspace_id", "w")

    async def test_pdf_file_returns_private_pdf_bytes_without_public_storage_link(self):
        client = MagicMock()
        client.table.return_value = table([{"filename": "Résumé.pdf", "file_type": "pdf", "file_path": "private/key"}])
        download = AsyncMock(return_value=b"%PDF-1.7 test")
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client), patch.object(documents, "download_file_from_s3", download):
            response = await documents.preview_pdf_file("w", "d", {"id": "u"})
        self.assertEqual(response.body, b"%PDF-1.7 test")
        self.assertEqual(response.media_type, "application/pdf")
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.assertIn("filename*=UTF-8", response.headers["content-disposition"])
        download.assert_awaited_once_with("private/key")

    async def test_preview_returns_ordered_passages(self):
        client = MagicMock()
        docs = table([{"id": "d", "filename": "f.txt", "status": "ready"}])
        chunks = table([{"chunk_index": 0, "content": "Evidence"}])
        chunks.range.return_value = chunks
        client.table.side_effect = lambda name: docs if name == "documents" else chunks
        with patch.object(documents, "verify_workspace"), patch.object(documents, "get_supabase_admin", return_value=client):
            result = await documents.preview_document("w", "d", {"id": "u"})
        self.assertEqual(result["chunks"][0]["content"], "Evidence")
        chunks.eq.assert_called_with("document_id", "d")

    async def stream_events(self, fail=False, disconnected=False):
        async def fake_stream(*args):
            yield {"type": "sources", "citations": []}
            yield {"type": "token", "text": "Partial"}
            if fail:
                raise RuntimeError("Provider unavailable")
            yield {"type": "token", "text": " answer"}
        request = SimpleNamespace(is_disconnected=AsyncMock(return_value=disconnected))
        saved = MagicMock(return_value=SimpleNamespace(model_dump=lambda: {"content": "Partial answer"}))
        data = RAGQueryRequest(query="q", session_id="s", selected_doc_ids=["d"])
        with patch.object(rag, "prepare_query", return_value=(None, None, ["d"], {}, [])), patch.object(rag, "stream_rag", fake_stream), patch.object(rag, "save_answer", saved):
            response = await rag.rag_stream("w", data, request, {"id": "u"})
            events = [json.loads(event) async for event in response.body_iterator]
        return saved, events

    async def test_stream_persists_only_after_completion(self):
        saved, events = await self.stream_events()
        self.assertEqual([e["type"] for e in events], ["sources", "token", "token", "done"])
        self.assertEqual(saved.call_args.args[-1]["response"], "Partial answer")
        saved.assert_called_once()

    async def test_stream_failure_or_disconnect_never_saves_partial_turn(self):
        for failure, disconnected in [(True, False), (False, True)]:
            saved, events = await self.stream_events(failure, disconnected)
            saved.assert_not_called()
            if failure:
                self.assertEqual(events[-1]["type"], "error")


if __name__ == "__main__":
    unittest.main()

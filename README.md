# NexusRAG — Multi-Workspace AI Knowledge Platform

A multi-tenant Retrieval-Augmented Generation (RAG) platform that allows users to create isolated workspaces, upload documents, and interact with an AI assistant using context retrieved only from selected files.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│   FastAPI    │────▶│  Supabase    │
│   Frontend   │     │   Backend    │     │  PostgreSQL  │
│  (Port 3000) │     │  (Port 8000) │     └──────────────┘
└──────────────┘     └──────┬───────┘
                            │
                   ┌────────┴────────┐
                   │                 │
            ┌──────▼──────┐  ┌──────▼──────┐
            │   Qdrant    │     S3/Minio   │
            │  Vectors    │     Storage    │
            │ (Port 6333) │               │
            └─────────────┘  └─────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Supabase REST |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL |
| File Storage | S3 |
| Vector DB | Qdrant |
| RAG components | LangChain core, LangChain Groq, FastEmbed (ONNX) |
| Embeddings | BAAI/bge-small-en-v1.5, CPU-only ONNX |
| LLM | Groq (openai/gpt-oss-20b) |

## Prerequisites

- Node.js 24+
- Python 3.11+
- Docker (for Qdrant)
- Supabase project with Google OAuth enabled
- Groq API key
- S3-compatible storage credentials

## Setup

### 1. Start Qdrant

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt

# Edit .env with your credentials
# Then start the server:
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Edit .env.local with your Supabase credentials
# Then start the dev server:
npm run dev
```

### 4. Supabase Configuration

1. Enable Google OAuth in Authentication > Providers
2. Add `http://localhost:3000/auth/callback` to Redirect URLs
3. Run `backend/migrations/001_initial_schema.sql` for a new database.
4. Run `backend/migrations/002_chat_session_pins.sql` for both new and existing databases. This adds the column required for chat pinning.

### 5. Environment Variables

**backend/.env**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql+asyncpg://postgres:password@db.your-project.supabase.co:5432/postgres
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
S3_BUCKET=nexusrag-documents
QDRANT_URL=http://localhost:6333
GROQ_API_KEY=your-groq-key
LLM_MODEL=openai/gpt-oss-20b
```

**frontend/.env.local**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/` | List workspaces |
| POST | `/api/workspaces/` | Create workspace |
| GET | `/api/workspaces/{id}` | Get workspace |
| PATCH | `/api/workspaces/{id}` | Update workspace |
| DELETE | `/api/workspaces/{id}` | Delete workspace |
| GET | `/api/workspaces/{id}/documents/` | List documents |
| POST | `/api/workspaces/{id}/documents/` | Upload documents (returns `documents` and per-file `errors`) |
| DELETE | `/api/workspaces/{id}/documents/{doc_id}` | Delete document |
| GET | `/api/workspaces/{id}/chat/sessions` | List chat sessions |
| POST | `/api/workspaces/{id}/chat/sessions` | Create session |
| GET | `/api/workspaces/{id}/chat/sessions/{sid}/messages` | List messages |
| POST | `/api/workspaces/{id}/rag/query` | RAG query |

## Features

- **Citation previews**: Click a numbered citation or **Open in document** to open a source in the right-hand panel. PDFs render the original file with selectable text, page navigation, zoom, and highlighted supporting text. Existing citations are matched directly against the PDF text layer, including across pages, so reprocessing and database changes are not needed. When extraction order differs, a substantial exact phrase may be highlighted and labeled as a partial match; unmatched or scanned passages show a clear notice. Other formats use extracted-text previews. On narrow screens the panel covers the chat until closed. Deleted or inaccessible documents show an error. Original PDFs are served through an authenticated workspace-scoped API, never a public storage link.
- **Streaming answers**: Answers appear as the model generates them. **Stop generating** cancels the request and restores the question for retry. Partial answers are discarded; only completed user/assistant turns are saved. Stream interruptions show an error rather than silently treating a partial answer as complete.
- **Follow-up memory**: Recent saved messages in the current chat resolve questions such as “explain that” before retrieval. Search remains restricted to the currently selected ready documents. New chats start fresh. Memory uses the latest six messages for query resolution and answer context, rather than the entire conversation.

- **Scoped Retrieval**: Select specific documents before querying
- **Workspace Isolation**: Each workspace maintains independent docs and chat
- **Citation-Aware**: Responses include source document references
- **Real-time Processing**: Documents are processed asynchronously after upload


## Supported documents

Upload PDF, DOCX, UTF-8 TXT, Markdown, or CSV files, up to 50 MB each and 10 files per request. Legacy `.doc` files must first be converted to DOCX. Scanned PDFs require OCR before upload; OCR is not included. Files become available for chat when processing is complete. Failed files show an explanation and a retry action.

Each upload has a unique storage key, even when filenames match. Deleting a document or workspace is blocked while its documents are processing. Background processing runs in the API process; for production workloads, use a durable worker queue before relying on processing across server restarts. If a restart interrupts processing, an administrator must reconcile affected jobs before retrying.

## Answer request limits

Answer requests use a 5,000-token input budget (`LLM_INPUT_TOKEN_BUDGET`) with room left for the configured 2,048-token answer and message overhead on the current 8,000-token provider allowance. Retrieved passages and recent history share that input budget; citation previews reflect the excerpt actually sent to the model. Follow-up query rewriting has a separate 256-token output cap. Oversized questions and provider rate/size errors have specific messages.

For GPT-OSS, token counting uses tiktoken's `o200k_base` vocabulary when it is already cached in `TIKTOKEN_CACHE_DIR` (or the standard tiktoken cache). Without that cache, a conservative UTF-8 byte budget keeps requests bounded. Chat never downloads tokenizer assets while handling a question. This budget prevents an individual oversized request; provider limits across repeated requests can still require waiting.

## PDF viewer assets

Mozilla PDF.js is loaded only when a PDF preview opens. Its versioned worker, fonts, CMaps, and WASM files are copied locally by `frontend/scripts/pdf-assets.mjs` during install and before development/build. Generated files under `frontend/public/pdfjs/` are ignored by Git. Docker builds include the setup script before dependency installation and copy the generated public assets into the runtime image.

## Using the workspace

- Home opens the workspace dashboard, with search, create, edit, and delete controls.
- Open **Sources** to upload, filter, and select ready documents. Selections are isolated by workspace.
- Open **Chats** to switch conversations. On phones, Chats and Sources open as drawers; on desktop, the panels can be collapsed.
- Responses support Markdown and expandable, numbered source passages. Source numbers identify retrieved passages, not confidence probabilities.
- Settings saves your profile through Supabase and persists your theme locally. Account security is managed through your sign-in provider; API keys and model selection are administrator concerns, not simulated user controls.

## Verification

```bash
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

```bash
cd backend
PYTHONDONTWRITEBYTECODE=1 venv/bin/python -m unittest discover -s tests -v
```

Regression tests use mock external services and never write to your Supabase, S3, Qdrant, or AI account. They cover authentication rejection, upload collisions and failures, DOCX extraction, document scoping, citation numbering, and chat/navigation failures. A live integration check still requires configured services and an authenticated user.

Backend and frontend upload contracts changed together: deploy them together. Existing stored conversations remain readable; older citations may lack source numbers. The pinning migration is additive and must be applied separately before using pins.

The production build uses Next.js’s supported Webpack engine. The upgraded Turbopack worker could not bind a local port in the restricted verification environment. Google fonts are downloaded at build time, so the build needs network access or a prepopulated font cache.

Dependency verification on 2026-10-20: the frontend production audit (`npm audit --omit=dev`) reported zero known vulnerabilities. Eight high-severity findings remain in development tooling; automatic recommendations involve incompatible downgrades and were not applied. This audit does not cover Python dependencies.


## LangChain migration

The backend uses `langchain-groq` (`ChatGroq`) for answer generation and a FastEmbed ONNX adapter implementing LangChain core's `Embeddings` interface. Retrieval remains explicit Python; no agent loop or LangGraph runtime is required. The backend requirements no longer include PyTorch or sentence-transformers.

Both document and query embeddings use normalized, raw BGE text encoding without additional instruction prefixes. The current vector payload includes an `embedding_profile` marker. Legacy vectors are preserved but excluded from current searches; selected ready documents are re-indexed from saved Supabase chunks when their current-profile vectors are missing. This keeps runtime changes from silently mixing encoders.

Install backend requirements and restart after updating. Local development downloads the model to `/tmp/fastembed` by default. The Docker image bundles the model at build time and uses offline inference at runtime. Five synthetic compatibility samples produced cosine similarities rounding to 1.00000 against the previous encoder; this is a limited check, not a claim that every input gives identical vectors.

For the manual Render/Qdrant Cloud setup, environment variables, and free-instance limitations, see [backend deployment instructions](backend/DEPLOYMENT.md).

The Python Supabase client was updated within version 2 to resolve a WebSocket dependency conflict with LangChain's tracing dependency. No LangSmith credentials or tracing configuration are required for normal operation. The LlamaIndex packages have been removed from the backend requirements.


If a ready document loses all of its Qdrant vectors, querying that selected document rebuilds its index from the saved Supabase chunks. Recovery validates workspace ownership scope and ready status, checks saved chunk completeness, and uses deterministic vector IDs so repeated recovery does not duplicate points. Incomplete saved chunks produce an explicit reprocessing error. This recovery does not change the original file or widen source selection.

## Conversation search

Use **Search chats** in the dashboard header or a workspace toolbar to search your saved chat titles, questions, and answers. Search matches a word or phrase without regard to case and treats punctuation literally. Results show the workspace, a matching excerpt, and date. Message results open the conversation at the highlighted message. A workspace can narrow search with **Only this workspace**; **Load more results** retrieves another page.

The authenticated `GET /api/chat/search` endpoint scopes both message and title queries to the current workspace owner. It uses the existing Supabase foreign keys, requires no database migration, and makes no LLM calls. Deploy both the backend and frontend updates to use search in production.

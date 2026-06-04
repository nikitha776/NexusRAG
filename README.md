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
| Backend | FastAPI, SQLModel |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL |
| File Storage | S3 |
| Vector DB | Qdrant |
| Embeddings | BAAI/bge-small-en-v1.5 |
| LLM | Groq (llama-3.3-70b-versatile) |

## Prerequisites

- Node.js 18+
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
3. Run the database migration (already applied via MCP)

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
| POST | `/api/workspaces/{id}/documents/` | Upload documents |
| DELETE | `/api/workspaces/{id}/documents/{doc_id}` | Delete document |
| GET | `/api/workspaces/{id}/chat/sessions` | List chat sessions |
| POST | `/api/workspaces/{id}/chat/sessions` | Create session |
| GET | `/api/workspaces/{id}/chat/sessions/{sid}/messages` | List messages |
| POST | `/api/workspaces/{id}/rag/query` | RAG query |

## Features

- **Scoped Retrieval**: Select specific documents before querying
- **Workspace Isolation**: Each workspace maintains independent docs and chat
- **Citation-Aware**: Responses include source document references
- **Real-time Processing**: Documents are processed asynchronously after upload

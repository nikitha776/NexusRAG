# Manual deployment: Render backend + Qdrant Cloud

These instructions prepare a small personal/demo deployment. Nothing is deployed automatically. Keep the frontend on Vercel and use the existing Supabase, S3, and Groq services. Free services have quotas; AWS S3 usage is billed separately.

## 1. Prepare Qdrant

1. Create a free Qdrant Cloud cluster in the region nearest your backend.
2. Copy its HTTPS cluster endpoint and a cluster API key with collection, payload-index, and point read/write permissions. Keep the key private.
3. No local Docker Qdrant service is needed on Render. The backend creates its collection and indexes on startup.

Existing vectors on your laptop are not copied to Cloud. For ready documents whose chunks are saved in Supabase, the backend rebuilds vectors when those documents are selected for a question. Original files remain in S3. This first question can take longer; documents without complete saved chunks need processing again.

## 2. Prepare your repository

Review the changes, run the backend tests, and push your project to your own GitHub repository. Do not commit `backend/.env`, virtual environments, or credentials. The `.env.example` file contains placeholders only.

Local checks, from `backend`:

```bash
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

## 3. Create the Render service

1. In Render choose **New → Web Service**, then connect your repository.
2. Set **Root Directory** to `backend` and choose the **Docker** runtime. Use the Dockerfile in that directory; leave Docker build context at that directory.
3. Choose the **Free** instance if offered for your account and region.
4. Set **Health Check Path** to `/api/health`.
5. Add these environment variables before creating the service:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Existing Supabase project URL |
| `SUPABASE_ANON_KEY` | Existing public/anon key |
| `SUPABASE_SERVICE_KEY` | Existing secret service-role key; backend only |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Existing storage credentials; backend only |
| `S3_BUCKET`, `S3_REGION` | Existing bucket name and its actual region |
| `S3_ENDPOINT` | Leave unset for AWS S3; set only for compatible storage |
| `GROQ_API_KEY` | Existing Groq secret key |
| `LLM_MODEL` | `openai/gpt-oss-20b` |
| `LLM_INPUT_TOKEN_BUDGET` | `5000` |
| `QDRANT_URL` | Qdrant Cloud HTTPS cluster endpoint |
| `QDRANT_API_KEY` | Qdrant cluster secret API key |
| `QDRANT_COLLECTION` | `nexusrag_chunks` |
| `CORS_ORIGINS` | `["https://nikitha.space","https://www.nikitha.space","https://YOUR-PROJECT.vercel.app"]` with your actual Vercel project hostname |

The `CORS_ORIGINS` value is a JSON array, including brackets and double quotes. Use only origins you will actually serve. Remove the placeholder Vercel origin until you know it, then add it before testing that URL. Preview deployment URLs need explicit entries too.

Do **not** copy the whole local `.env` into Render. In particular, do not override `EMBEDDING_CACHE_DIR` or `EMBEDDING_LOCAL_FILES_ONLY`: the image already includes the model at its own cache path and runs offline. Do not set `WEB_CONCURRENCY` or multiple workers. Render supplies `PORT`; the app reads it automatically. `DATABASE_URL` and `SUPABASE_JWT_SECRET` are optional for this API's Supabase REST authentication path.

The image build downloads and verifies the ONNX model without application credentials. If that download fails, retry the build after checking the provider/network logs. Changing the embedding model requires rebuilding the image and using a compatible dimension and a new embedding profile.

## 4. Connect the frontend yourself

1. Copy the resulting Render HTTPS service URL.
2. In your Vercel project set `NEXT_PUBLIC_API_URL` to that base URL, without `/api` at the end. Also set the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Redeploy the frontend after changing these variables.
4. Add `nikitha.space` to Vercel and follow the DNS records shown there.
5. In Supabase Auth URL Configuration set the production Site URL to `https://nikitha.space` and allow `https://nikitha.space/auth/callback`. Add the Vercel or www callbacks only if using them. Keep Google's authorized redirect pointing at the Supabase auth callback.

## 5. Verify

- Open `https://YOUR-SERVICE.onrender.com/api/health`; it should return status `ok`. This confirms the server is running, not that all external services are reachable.
- Check backend logs for successful vector index initialization; investigate Qdrant URL/key/permissions errors.
- Sign in through the deployed frontend, open/create a workspace, upload one small text PDF, and wait for it to become ready.
- Ask a question, check the streamed answer and source preview, then start another chat. Also test one existing document to verify vector recovery.
- Test after an idle period: free instances can sleep and the first request may take longer or need a retry.

## Memory and persistence limits

The backend uses a CPU-only ONNX encoder, one worker, serialized inference and document processing, and batch size one. A local sample workload peaked around 380 MiB. This is a sample measurement, not a guarantee under a 512 MiB limit: large PDFs, simultaneous users, or large uploads can still exhaust memory. Start with small files; use a larger instance or an external embedding service if needed.

Documents, saved chunks, conversations, and vectors live in S3, Supabase, and Qdrant Cloud. Do not rely on Render's local filesystem for durable data. The model is bundled into the image. Current document processing runs inside the web process; a host restart during processing can interrupt a job. Retry processing from the document panel if that happens. This setup is intended for a small demo rather than unattended production workloads.

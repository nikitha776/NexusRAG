FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    TOKENIZERS_PARALLELISM=false \
    MALLOC_ARENA_MAX=2 \
    EMBEDDING_CACHE_DIR=/app/.cache/fastembed

# Kept curl for the healthcheck; stripped gcc unless your pip packages complain
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home appuser
WORKDIR /app

# Safely copy dependencies with correct ownership
COPY --chown=appuser:appuser requirements.txt .

RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy source code with correct ownership
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser scripts ./scripts

# Ensure the app dir and uploads dir are writable by the non-root user
RUN chown -R appuser:appuser /app \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app/uploads

USER appuser

# Cache model artifacts in the image. Restarts do not need to download them.
RUN python scripts/cache_embedding_model.py
ENV EMBEDDING_LOCAL_FILES_ONLY=true

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-8000}/api/health" || exit 1

CMD ["python", "-m", "app.start"]

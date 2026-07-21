FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

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

# Ensure the app dir and uploads dir are writable by the non-root user
RUN chown -R appuser:appuser /app \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app/uploads

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
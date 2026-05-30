FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer cache)
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# Copy source into /app/backend/ so the package can be imported as `backend`
COPY . ./backend/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

EXPOSE 8000

# Apply DB migrations before API (keeps schema in sync when models gain columns)
# Exclude tests from reload watch to avoid scheduler/API restarts while editing pytest files
# Graceful shutdown: allow in-flight LLM / slow routes to finish when --reload triggers a restart
# (frontend NEXT_PROXY_TIMEOUT_MS is 180s for /api/recommended-path).
CMD ["sh", "-c", "cd /app/backend && alembic upgrade head && exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude backend/tests/** --timeout-graceful-shutdown 180"]

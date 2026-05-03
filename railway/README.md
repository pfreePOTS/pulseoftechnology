# Railway staging (Pulse of Technology)

Deploy as **three** pieces on [Railway](https://railway.app): Postgres, Backend (FastAPI), Frontend (Next.js). This repo is a monorepo; each Railway service sets a **different root directory** so the correct `railway.toml` + `Dockerfile.prod` applies.

## 1. Create the project

1. New project → provision **PostgreSQL** (Railway injects `DATABASE_URL` automatically on linked services).
2. **Backend** → Deploy from GitHub → select this repo → set **Root Directory** to `backend`.
3. **Frontend** → Add service from same repo → **Root Directory** `frontend`.

## 2. Environment variables

### Backend service (`backend/`)

Set at minimum (staging values are examples — use your Railway URLs):

| Variable | Purpose |
|---------|---------|
| `DATABASE_URL` | Reference Postgres variable Railway provides (`${{Postgres.DATABASE_URL}}` or duplicate). Must match PostgreSQL dialect used by SQLAlchemy. |
| `ENVIRONMENT` | `staging` or `production` (affects prod secret validation in `backend/config.py`). |
| `CORS_ORIGINS` | Comma-separated **browser origins** hitting the frontend, e.g. `https://your-frontend.up.railway.app` |
| `API_BASE_URL` | Public HTTPS URL of **this backend** API (survey links, read-online URLs). |
| `PUBLIC_SITE_URL` | Public HTTPS URL of **the frontend** (`https://your-frontend...`). |
| `ADMIN_JWT_SECRET` | Strong secret for admin cookies/JWTs. |
| `SUBSCRIBER_TOKEN_SECRET` | Strong secret for preference/unsubscribe links. |
| `SERVER_API_URL` | Not needed on backend; used by frontend only. |

Optional: AI keys (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`), `SENDGRID_API_KEY`, `HUBSPOT_API_KEY`, etc., per `.env.example`.

Railway assigns **`PORT`** — `backend/Dockerfile.prod` already binds Uvicorn to `${PORT:-8000}`.

### Frontend service (`frontend/`)

| Variable | When | Purpose |
|---------|------|---------|
| `NEXT_PUBLIC_API_URL` | **Build-time** — add under “Build” variables in Railway so the Dockerfile `ARG` is filled | Browser-facing API URL, e.g. `https://your-backend.up.railway.app`. |
| `SERVER_API_URL` | **Build-time** | SSR/server-side fetches inside the container URL to the backend (same public URL unless you introduce private networking). |

At **runtime**, Railway **`PORT`** is consumed by Next standalone (`server.js`).

## 3. Build args (Railway dashboard)

Frontend Docker build needs `NEXT_PUBLIC_API_URL` and `SERVER_API_URL` at **build** time.

In Railway: **Frontend service → Variables** — mark these as **available during build**, or define equivalent **Docker build arguments** in the UI if Railway exposes them for Dockerfile `ARG`s.

## 4. Postgres migrations

Backend container runs **`alembic upgrade head`** on start (`Dockerfile.prod` `CMD`). No separate release phase is required unless you prefer Railway’s optional pre-deploy step.

## 5. Paths in this repo

| Path | Role |
|------|------|
| `backend/Dockerfile.prod` | Production API image |
| `backend/railway.toml` | Dockerfile builder + `/health` check |
| `frontend/Dockerfile.prod` | Next standalone production image |
| `frontend/railway.toml` | Dockerfile builder + `/` health probe |

Development remains **`docker compose up`** with the existing `Dockerfile` (hot reload).

## 6. Deploy `staging` branch

Connect the GitHub integration to branch **`staging`** for both services (Railway Project → Settings → branch filter), then push commits to `staging` to trigger deploys.

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
| `FIRST_ADMIN_EMAIL` | Login email for the **first** console admin (`bootstrap_first_admin_if_empty`; runs on backend startup while `admin_users` is empty). |
| `ADMIN_PASSWORD` | When `ENVIRONMENT` is `staging` or `production`, must be set and must not equal the literal `pulseadmin`. Used to create the first admin row while `admin_users` is empty. If you **only** set `ADMIN_PASSWORD_HASH` and omit this variable, bootstrap will not create a user. |
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

## 5. Bootstrapping real content from another environment

To copy **everything currently in Postgres** (not only curated seeds), use the **data-only** archive workflow in **`scripts/db/README.md`**:

1. On dev: `./scripts/db/export_data.sh` (Compose `db` must be running).
2. Deploy the backend once so migrations create empty tables at head.
3. Set **`DATABASE_URL`** to Railway Postgres (with `sslmode=require` when required) and run **`./scripts/db/import_data.sh path/to.dump`**.

The dump omits **`alembic_version`** so the target keeps whatever revision migrations stamped. Imports are safest on a **fresh** migrated database.

## 6. Paths in this repo

| Path | Role |
|------|------|
| `backend/Dockerfile.prod` | Production API image |
| `backend/railway.toml` | Dockerfile builder + `/health` check |
| `frontend/Dockerfile.prod` | Next standalone production image |
| `frontend/railway.toml` | Dockerfile builder + `/` health probe |

Development remains **`docker compose up`** with the existing `Dockerfile` (hot reload).

## 7. Deploy `staging` branch

Connect the GitHub integration to branch **`staging`** for both services (Railway Project → Settings → branch filter), then push commits to `staging` to trigger deploys.

## 8. First console admin (no CSV / no invites yet)

Superusers live in Postgres table **`admin_users`**. While it is empty, **`bootstrap_first_admin_if_empty()`** (`backend/main.py` startup) inserts **one** account from env:

| Variable | Action |
|---------|--------|
| `FIRST_ADMIN_EMAIL` | e.g. `you@yourcompany.com` |
| `ADMIN_PASSWORD` | Strong password (not `pulseadmin` under `staging`/`production`; see validator in `backend/config.py`) |

Backend must **restart** after you set those variables **if `admin_users` was empty** when you first deployed without them.

Then sign in at:

`PUBLIC_SITE_URL` + **`/admin/login`** (cookie auth — use the same browser origin listed in **`CORS_ORIGINS`**). With **`staging`/`production`** the API sets **`SameSite=None; Secure`** on the admin cookie so split Railway hosts keep the session (`backend/routers/admin.py`).

### If bootstrap did not create a row

Ensure you did **not** only set **`ADMIN_PASSWORD_HASH`** with **`ADMIN_PASSWORD` empty** (`backend/dependencies.py` skips insertion in that case). Fix env, redeploy, or temporarily add `ADMIN_PASSWORD` for one boot.

Still stuck? Confirm in Postgres (**Query** tab): **`SELECT COUNT(*) FROM admin_users;`** If you need to re-run bootstrap on purpose, truncate that table in a **staging-only** DB, fix env, and restart backend (do not expose this workflow to production blindly).

## 9. Seed RSS feeds, radar topics, and roles (staging)

Empty **`sources`** ⇒ logs show ingestion for **0** feeds. Runs from any environment that can reach `DATABASE_URL` with the backend’s Python deps.

### From your laptop (Docker Compose backend image)

`docker compose up -d backend` first so the **`backend`** container exists. Railway Postgres URLs often require **`?sslmode=require`** on the URI string.

Railway Postgres may block direct connections from your home IP unless public networking allows it — if so, open **Railway → Backend → Shell** and run the `python -m …` line there (omit `DATABASE_URL` if the shell injects Postgres automatically).

From the repo root:

```bash
export DATABASE_URL='postgresql://…from Railway Postgres Connect…'

docker compose exec -T -e DATABASE_URL="$DATABASE_URL" backend python -m backend.seed_local_dev
```

That installs **`sources`**, publishes **core radar `topics`**, and upserts **standard `roles`**. For ingestion you still need scheduler ticks or manual processing; **`seed_*` modules do not load historical articles.**

Alternatively: restore a **`pg_restore` data-only** archive (`scripts/db/README.md`) instead of curated seeds alone.

### Railway CLI (recommended once `railway login` / `railway link` are set)

Backend variables expose **`DATABASE_URL`** that points at **`*.railway.internal`**. **`railway run`** injects those into your **laptop**, where that hostname does not resolve — use **`railway ssh`** into the Backend deployment instead:

```bash
cd /path/to/pulseoftechnology   # repo root (after railway link …)
railway ssh -- python -m backend.seed_local_dev
```

## Troubleshooting

### Builds use Railpack instead of Docker (monorepo tree in logs)

Railway inferred **Railpack/Nix-style** builds because the **service root directory** was the repo root. This repo only has **`Dockerfile.prod`** under **`backend/`** and **`frontend/`**, and each folder has its own **`railway.toml`** (`builder = "DOCKERFILE"`).

**Fix:** In each app service (**Settings → Service** / **Source** depending on Railway UI version), set **Root Directory** to **`backend`** (backend service only) or **`frontend`** (frontend service only). Redeploy. You should then see a **Docker** build path, not a Railpack trace of `./backend`, `./frontend`, etc. together at the repository root.

If offered an explicit builder choice, choose **Dockerfile** and **`Dockerfile.prod`**.

### Admin login never sticks (successful POST then bounced to login)

- Frontend must call the correct **`NEXT_PUBLIC_API_URL`** (HTTPS); rebuild after changing build vars.
- **`CORS_ORIGINS`** must include the exact frontend **`https://…`** origin.
- **`ENVIRONMENT`** on the backend must be **`staging`** or **`production`** on Railway — not **`development`** — so the cookie uses **`SameSite=None`** for cross-origin credentialed fetches between your two Railway URLs.

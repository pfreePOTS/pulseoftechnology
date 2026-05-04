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

Without `NEXT_PUBLIC_API_URL` baked at build, the deployed admin UI still calls **`http://localhost:8100`** (see `frontend/Dockerfile.prod` ARG default) → login shows “cannot contact API” even though Railway is reachable. **`server.js`** also needs **`SERVER_API_URL`** for SSR/server fetches pointing at `https://…your-backend…`.

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

### Railway CLI + SSH (recommended)

Link the **Staging** project and select the **Backend** service (`railway link`, then choose the backend). The backend image has `PYTHONPATH=/app` and the package lives under `/app/backend`; run modules as below.

**Important:** Variables like `DATABASE_URL` on the backend usually point at **`*.railway.internal`**. That hostname resolves **inside** Railway (e.g. `railway ssh`), but **not** on your laptop. Prefer **`railway ssh`** for seed/sync commands instead of `railway run` unless you switch Staging `DATABASE_URL` to a **public** Postgres URL.

#### A) Curated seeds only (same as repo — not a literal copy of Dev edits)

Installs **`sources`**, published core **`topics`**, and standard **`roles`**. Does **not** copy **`content_items`** or articles from Dev.

```bash
railway ssh -- python -m backend.seed_local_dev
```

Idempotent; safe to rerun.

#### B) Role Profiles + Content Library **exactly as on Dev**

1. In the **Dev** Railway project → **Postgres** → **Connect** → copy a **public** connection URL (must include `sslmode=require` if Railway shows it). Dev’s **private** `*.railway.internal` URL from the Dev backend usually cannot be reached from the **Staging** backend.
2. Link CLI to **Staging** → **Backend** and run:

```bash
railway ssh -- /bin/sh -c 'SOURCE_DATABASE_URL="postgresql://USER:PASS@DEV_HOST:PORT/DEV_DB?sslmode=require" TARGET_DATABASE_URL="$DATABASE_URL" python -m backend.sync_newsletter_cms_between'
```

Replace the `SOURCE_DATABASE_URL` value with your **Dev** public URL. `TARGET_DATABASE_URL` uses Staging’s injected `DATABASE_URL` (private Postgres in the same project — reachable from the Staging container).

This runs **`copy_roles`** + **`copy_content_items`** (upsert by name / UUID).

#### C) **Almost everything** in one Postgres **into Staging** (articles, radar, roles, analysis — **no** admin/subscriber PII)

**Export** runs **read-only** against the database that **has** the data (often your Staging Postgres plugin in this project — not necessarily “production”). **Import** must use **Staging** variables so `pg_restore` writes **only** to Staging:

```bash
# 1) Dump from the Postgres instance that actually contains rows (example: Staging plugin service).
railway run -e staging -s "Postgres-p6LC" -- ./scripts/db/export_data_from_url.sh --without-account-subscriber-data

# 2) Restore into Staging (Staging backend → Staging DB URL).
railway run -e staging -s "Backend - Staging" -- ./scripts/db/import_data.sh scripts/db/artifacts/pulse_db_data_latest_nousers.dump
```

Replace **`Postgres-p6LC`** with your project’s Staging Postgres service name if different (`railway status --json` lists services per environment).

This copies all table data **except** `admin_users`, `subscribers`, HubSpot sync audit rows, survey responses, and per-recipient `newsletter_issues`. Staging keeps its own empty (or existing) accounts/subscribers unless you truncate those tables first.

For a **literal full clone** including subscribers and admins, omit `--without-account-subscriber-data` **and** use a **fresh** Staging database so primary keys do not collide.

The production backend image does **not** include `pg_restore` or a full `pg_dump` workflow; run export/import on your laptop or CI, not inside `railway ssh`. Details: **`scripts/db/README.md`**.

### One-shot: catalog seeds **and** Dev CMS on Staging

If you want **repo** `sources` / `topics` / standard `roles` **and** Dev’s **role + content library** rows, run **both** inside `railway ssh` (same session):

```bash
railway ssh -- /bin/sh -c 'python -m backend.seed_local_dev && SOURCE_DATABASE_URL="postgresql://DEV_PUBLIC_URL" TARGET_DATABASE_URL="$DATABASE_URL" python -m backend.sync_newsletter_cms_between'
```

Replace `DEV_PUBLIC_URL` with the full Dev Postgres URL string (user, password, host, db, `sslmode`). `sync_newsletter_cms_between` **overrides** standard roles with Dev’s tags where names match and adds any extra roles from Dev; content items are upserted by id.

### Railway CLI (quick reference)

· **`railway ssh`** runs inside the latest **Backend** deploy and sees that service’s env (`DATABASE_URL`, etc.).  
· Use **`seed_local_dev`** for in-repo catalog parity.  
· Use **`sync_newsletter_cms_between`** (with a **public** Dev `SOURCE_DATABASE_URL`) to match Dev’s **roles + content library** on Staging.

## Troubleshooting

### Builds use Railpack instead of Docker (monorepo tree in logs)

Railway inferred **Railpack/Nix-style** builds because the **service root directory** was the repo root. This repo only has **`Dockerfile.prod`** under **`backend/`** and **`frontend/`**, and each folder has its own **`railway.toml`** (`builder = "DOCKERFILE"`).

**Fix:** In each app service (**Settings → Service** / **Source** depending on Railway UI version), set **Root Directory** to **`backend`** (backend service only) or **`frontend`** (frontend service only). Redeploy. You should then see a **Docker** build path, not a Railpack trace of `./backend`, `./frontend`, etc. together at the repository root.

If offered an explicit builder choice, choose **Dockerfile** and **`Dockerfile.prod`**.

### Admin login never sticks (successful POST then bounced to login)

- Frontend must call the correct **`NEXT_PUBLIC_API_URL`** (HTTPS); rebuild after changing build vars.
- **`CORS_ORIGINS`** must include the exact frontend **`https://…`** origin.
- **`ENVIRONMENT`** on the backend must be **`staging`** or **`production`** on Railway — not **`development`** — so the cookie uses **`SameSite=None`** for cross-origin credentialed fetches between your two Railway URLs.

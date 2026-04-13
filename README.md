# Pulse of Technology

AI-powered technology news aggregation and business intelligence platform.

## Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2   |
| Database | PostgreSQL 15                        |
| Infra    | Docker Compose                       |

---

## ⚠️ Development Rule: Always Use Docker Compose

**Do not run the frontend, backend, or database directly on your host machine.**
All services are managed through Docker Compose to ensure consistent environments,
correct service networking, and reproducible builds across all machines.

---

## Quick Start

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose plugin
- **Docker Buildx** — required for `docker compose build` without the classic-builder warning; see [`requirements-docker.txt`](requirements-docker.txt) for install commands
- No Python or Node.js installation required on your host

### 2. Environment setup

Copy the environment template (defaults work out of the box for local dev):

```bash
cp .env.example .env
```

### 3. Start all services

```bash
docker compose up --build
```

On subsequent runs (no dependency changes):

```bash
docker compose up
```

### 4. Verify

| Service     | URL                               |
|-------------|-----------------------------------|
| Frontend    | http://localhost:3100             |
| Admin Panel | http://localhost:3100/admin       |
| Backend API | http://localhost:8100             |
| API Docs    | http://localhost:8100/docs        |
| Database    | localhost:5532 (host-mapped)      |

---

## Common Commands

```bash
# Start all services (detached)
docker compose up -d

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Rebuild a single service after dependency changes
docker compose up --build backend

# Stop all services
docker compose down

# Stop and remove volumes (wipes database)
docker compose down -v

# Open a shell in a running container
docker compose exec backend bash
docker compose exec frontend sh
docker compose exec db psql -U pulse_user -d pulse_db
```

## Database Migrations (Alembic)

Run migrations inside the backend container (`alembic.ini` lives in `/app/backend`):

```bash
docker compose exec -w /app/backend backend alembic upgrade head
```

Generate a new migration after model changes:

```bash
docker compose exec -w /app/backend backend alembic revision --autogenerate -m "describe change"
```

---

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| **Backend lint** | `cd backend && ruff check . && ruff format --check .` | Requires `requirements-dev.txt` (see below) |
| **Backend unit tests** | `cd backend && pytest` | Uses mocks; no Postgres needed for most tests |
| **Frontend lint** | `cd frontend && npm run lint` | ESLint (Next.js config) |
| **Frontend unit tests** | `cd frontend && npm run test` | Vitest + Testing Library |
| **End-to-end** | `cd frontend && npm run test:e2e` | Playwright — **requires the stack running** |

One-shot local checks (after `make install-backend-dev` once — see `Makefile`):

```bash
make lint          # Ruff + ESLint
make test          # pytest + Vitest (no E2E)
```

**Backend dev dependencies:** `pip install -r requirements.txt -r requirements-dev.txt` (Ruff, pytest-cov). The runtime image only installs `requirements.txt`.

**E2E (Playwright):** start the app, apply migrations, install browsers once, then run tests:

```bash
docker compose up -d --build
docker compose exec -w /app/backend backend alembic upgrade head
docker compose restart backend
cd frontend && npm run test:e2e:install && npm run test:e2e
```

The backend restart ensures the first admin account is bootstrapped after `admin_users` exists (same ordering CI uses).

Environment variables for Playwright: `PLAYWRIGHT_BASE_URL` (default `http://localhost:3100`), `PLAYWRIGHT_API_URL` (default `http://localhost:8100`), and optional `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` for `e2e/admin.spec.ts` (defaults match Compose: `pulseoneadmin@pulseone.local` / `pulseadmin`). Specs live under `frontend/e2e/` (`smoke`, `public-site`, `api`, `admin`).

**CI:** `.github/workflows/ci.yml` runs backend Ruff, pytest with coverage, frontend ESLint + Vitest, then Docker Compose + Playwright E2E.

---

## Project Structure

```
pulseoftechnology/
├── docker-compose.yml      ← Single source of truth for all services
├── Makefile                ← lint / test shortcuts (optional)
├── .github/workflows/ci.yml
├── .env.example            ← Copy to .env before first run
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── requirements-dev.txt ← Ruff, pytest-cov (local/CI)
│   ├── pyproject.toml      ← Ruff + pytest settings
│   ├── main.py             ← FastAPI entrypoint
│   ├── config.py
│   ├── database.py
│   ├── scheduler.py        ← APScheduler RSS ingestion jobs
│   ├── models/             ← SQLAlchemy models
│   ├── services/           ← Business logic (ingestion, etc.)
│   └── tests/              ← pytest
└── frontend/
    ├── Dockerfile
    ├── e2e/                ← Playwright specs
    ├── src/app/            ← Next.js App Router pages
    ├── vitest.config.ts
    └── playwright.config.ts
```

---

## Environment Variables

| Variable               | Default            | Description                              |
|------------------------|--------------------|------------------------------------------|
| `POSTGRES_USER`        | `pulse_user`       | DB username                              |
| `POSTGRES_PASSWORD`    | `pulse_password`   | DB password                              |
| `POSTGRES_DB`          | `pulse_db`         | DB name                                  |
| `DATABASE_URL`         | auto-constructed   | Full connection string (set by Compose)  |
| `ANTHROPIC_API_KEY`    | —                  | **Required** for AI ingestion pipeline   |
| `ADMIN_PASSWORD`       | `pulseadmin`       | Password for the **bootstrap** superuser when `admin_users` is empty (with `FIRST_ADMIN_EMAIL`) |
| `FIRST_ADMIN_EMAIL`    | `pulseoneadmin@pulseone.local` | Login email for that bootstrap account (short name `pulseoneadmin` also works) |
| `ADMIN_JWT_SECRET`     | (see `.env.example`) | HS256 signing key for admin JWT sessions |
| `CORS_ORIGINS`         | `http://localhost:3000,http://localhost:3100` | Allowed browser origins (comma-separated) |
| `SENDGRID_API_KEY`     | —                  | Email delivery (optional for dev)        |
| `HUBSPOT_API_KEY`      | —                  | CRM sync (optional)                      |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8100` | Browser-facing API URL (Compose `frontend` service) |
| `SERVER_API_URL`       | `http://backend:8000` (Compose default) | Server-side RSC fetches — must reach the API from inside the `frontend` container |
| `PINECONE_*`           | —                  | Optional vector DB for signals (`config.py` names) |

**Dependency lockfiles:** Python packages are installed from `backend/requirements.txt` in `backend/Dockerfile`; Node packages from `frontend/package.json` / `package-lock.json` in `frontend/Dockerfile` (`npm ci`). After changing dependencies, run `docker compose up --build` (or `--build` the affected service).

> Production deployments should override all defaults via real secrets management.

### Scheduler and scaling

Background jobs (RSS ingestion, signal scorer, newsletter) run **inside the FastAPI process** via APScheduler. Running **multiple API replicas** would duplicate scheduled work unless you move jobs to a dedicated worker or add distributed locking.

### Admin authentication

Admin users live in the **`admin_users`** table. On first startup, if the table is empty, the API creates one **superuser** from **`FIRST_ADMIN_EMAIL`** and **`ADMIN_PASSWORD`**. Login is **email + password** (`POST /api/admin/login`); the response sets an **httpOnly** cookie. Superusers can invite additional users with **page-level access** and optional **SendGrid** invitation email. API scripts may use `Authorization: Bearer <access_token>` from the login JSON.

### Security hardening (audit-aligned)

| Area | Implementation |
|------|----------------|
| **Admin passwords** | Stored as **bcrypt** hashes; optional legacy **`ADMIN_PASSWORD_HASH`** for non-DB flows is unused by console login (see `dependencies.py`). |
| **Client storage** | No admin tokens in `localStorage`; session uses **httpOnly** cookie. |
| **LLM / RSS** | Untrusted article text is wrapped in **XML CDATA** (`<article>`, `<context>`) and system prompts instruct the model to **ignore instructions** inside those blocks. |
| **Rate limits** | **SlowAPI**: `POST /api/admin/login` **10/minute**, `POST /api/subscribe` **30/minute** per client IP (tune in `routers/`). |
| **Vector bucketing** | Placeholder embeddings use **SHA-256** for shingle buckets (not MD5). |
| **Enterprise SSO** | Microsoft Entra ID / similar is not wired in this repo; add an OAuth2/OIDC layer in front of admin when required. |

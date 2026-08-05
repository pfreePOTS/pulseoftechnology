# Backend — FastAPI

> **Always start via Docker Compose from the project root.**
> See the [root README](../README.md) for instructions.

```bash
# From project root
docker compose up --build backend
```

## Testing and lint (local)

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check . && ruff format --check .
pytest
```

`requirements-dev.txt` adds Ruff and pytest-cov (not installed in the production Docker image).

## Notes for maintainers

- Entrypoint: `backend.main:app` (run as a Python package, not a script)
- The `backend/` directory is mounted into the container at `/app/backend/` for hot reload
- Database connection uses the `db` service hostname inside Compose — `localhost:5432` will NOT work from inside the container

## Seeding curated data

After **`alembic upgrade head`** you have tables but no RSS rows unless you seeded before. Postgres is **not** auto-filled on startup (except the empty **`admin_users`** bootstrap).

One command for local or remote DB reachable from `DATABASE_URL`:

```bash
docker compose exec backend python -m backend.seed_local_dev
```

That runs **`seed_sources`** (RSS catalogue), **`seed_domains`** (domain registry), **`seed_topics`** (core radar domains, published on `/radar`), and **`seed_roles`** (CEO/CFO/CTO/CISO/COO/CMO personas). Scripts are **idempotent** — safe to rerun.

Alternatively run modules individually (`backend.seed_sources`, etc.). Scripts do **not** insert **articles**; use ingestion (`scripts/db/import_data.sh` for a full mirror).

## Running standalone (debugging only)

Only do this if you are debugging the backend in isolation and have PostgreSQL running separately:

```bash
cd backend/
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL to point at your local DB
python -m uvicorn backend.main:app --reload
```

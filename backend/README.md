# Backend — FastAPI

> **Always start via Docker Compose from the project root.**
> See the [root README](../README.md) for instructions.

```bash
# From project root
docker compose up --build backend
```

## Notes for maintainers

- Entrypoint: `backend.main:app` (run as a Python package, not a script)
- The `backend/` directory is mounted into the container at `/app/backend/` for hot reload
- Database connection uses the `db` service hostname inside Compose — `localhost:5432` will NOT work from inside the container

## Seeding RSS sources

The ingestion engine requires at least one active source. Run the seed script once after the database is up:

```bash
# Via Docker (recommended — uses the container's DATABASE_URL automatically)
docker compose exec backend python -m backend.seed_sources

# Locally (requires a .env with DATABASE_URL pointing at your DB)
cd backend && python -m seed_sources
```

The script inserts 10 real-world technology RSS feeds and is idempotent — running it again skips any URL that already exists.

## Running standalone (debugging only)

Only do this if you are debugging the backend in isolation and have PostgreSQL running separately:

```bash
cd backend/
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL to point at your local DB
python -m uvicorn backend.main:app --reload
```

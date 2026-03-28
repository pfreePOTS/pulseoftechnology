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

## Running standalone (debugging only)

Only do this if you are debugging the backend in isolation and have PostgreSQL running separately:

```bash
cd backend/
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL to point at your local DB
python -m uvicorn backend.main:app --reload
```

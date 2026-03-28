# Pulse of Technology

AI-powered technology news aggregation and business intelligence platform.

## Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
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

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:3000            |
| Backend API | http://localhost:8000         |
| API Docs | http://localhost:8000/docs       |
| Database | localhost:5432 (internal only)   |

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

Run migrations inside the backend container:

```bash
docker compose exec backend python -m alembic upgrade head
```

Generate a new migration after model changes:

```bash
docker compose exec backend python -m alembic revision --autogenerate -m "describe change"
```

---

## Project Structure

```
pulseoftechnology/
├── docker-compose.yml      ← Single source of truth for all services
├── .env.example            ← Copy to .env before first run
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py             ← FastAPI entrypoint
│   ├── config.py
│   ├── database.py
│   ├── scheduler.py        ← APScheduler RSS ingestion jobs
│   ├── models/             ← SQLAlchemy models
│   └── services/           ← Business logic (ingestion, etc.)
└── frontend/
    ├── Dockerfile
    ├── src/app/            ← Next.js App Router pages
    └── ...
```

---

## Environment Variables

| Variable          | Default                                              | Description              |
|-------------------|------------------------------------------------------|--------------------------|
| `POSTGRES_USER`   | `pulse_user`                                         | DB username              |
| `POSTGRES_PASSWORD` | `pulse_password`                                   | DB password              |
| `POSTGRES_DB`     | `pulse_db`                                           | DB name                  |
| `DATABASE_URL`    | auto-constructed from above                          | Full connection string    |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`                          | Browser-facing API URL   |

> Production deployments should override all defaults via real secrets management.

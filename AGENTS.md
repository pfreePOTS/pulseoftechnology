# Agent / contributor notes

- **Canonical instructions**: root `README.md` (Docker Compose, ports, migrations, env vars).
- **Operational runbook**: `docs/operational-runbook.md` (first boot, seeding, jobs, logs).
- **PulseOne AI identity** (services, scope, voice for customer-facing LLM copy): `backend/content/pulseone-identity.md` — loaded via `backend/services/pulseone_identity.py` into recommended-path and related advisor prompts. Edit this file instead of duplicating scope in `ai_service.py`.
- **Cursor rules**: `.cursor/rules/` for stack, backend, and frontend conventions.
- **Frontend Next.js quirks**: see `frontend/AGENTS.md` (Next 16 vs older training data).
- **Visual / UI work**: read root `DESIGN.md` first (typography, PulseOne colors `#E91D24` / `#019E7C`, spacing). Do not use deprecated slate `#425B76`; QA should flag drift from `DESIGN.md`.

When changing admin authentication or CORS, update both FastAPI (`backend/dependencies.py`, `backend/main.py`) and the admin UI (`frontend/src/lib/api.ts` and admin pages).

**Operational logging:** grep-friendly audit lines use `backend/log_events.py` (`[auth]`, `[subscribe]`, `[job]`, etc.). Add or extend `backend/tests/test_logging.py` when you add new high-value log paths. Configure verbosity with **`LOG_LEVEL`** (see `config.py` and `.env.example`).

## Testing

- **Backend:** `pytest` in `backend/` (dev deps: `requirements-dev.txt`). **Ruff** for lint/format (`pyproject.toml`).
- **Frontend:** `npm run lint` (ESLint), `npm run test` (Vitest), `npm run test:e2e` (Playwright; full stack via Docker Compose).
- **CI:** `.github/workflows/ci.yml` runs all of the above plus E2E against Compose.

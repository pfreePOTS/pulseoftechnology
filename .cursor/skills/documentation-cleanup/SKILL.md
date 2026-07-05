---
name: documentation-cleanup
description: >-
  Audit and update Pulse of Technology docs so README, AGENTS, runbooks, and
  env examples match the current codebase. Use when the user asks for documentation
  cleanup, doc sync, stale docs review, or operational runbook updates.
---

# Documentation cleanup (Pulse of Technology)

## Scope

Work **only** in `/home/pfree/App Dev Workspace/pulseoftechnology`. Do not edit sibling repos.

## Canonical sources (update these first)

| File | Role |
|------|------|
| `README.md` | Docker Compose, ports, migrations, env vars, testing |
| `AGENTS.md` | Agent/contributor pointers |
| `.env.example` | Env template (keep in sync with `backend/config.py`) |
| `docs/operational-runbook.md` | First-run ops for humans |
| `backend/README.md` | Backend-specific seeding and local dev |

Do **not** rewrite historical `docs/cursor-prompts/` or audit reports unless the user asks — they are archives.

## Checklist

1. **Commands** — Every `docker compose exec` example must use correct module paths (`python -m backend.seed_local_dev`, `-w /app/backend` for Alembic).
2. **Ports** — Frontend `3100`, API `8100`, Postgres host `5532`.
3. **Auth** — Admin login is **email + password** (`FIRST_ADMIN_EMAIL`, `ADMIN_PASSWORD`), not password-only.
4. **Seeding** — `seed_local_dev` wraps sources, domains, topics, roles; document idempotent reruns.
5. **Env vars** — Cross-check `backend/config.py` Settings fields against README table and `.env.example`.
6. **Observability** — Document `LOG_LEVEL`, grep-friendly log prefixes (`[auth]`, `[subscribe]`, `[job]`, `[contact]`), and `backend/tests/test_logging.py`.
7. **Design** — Point UI work to `DESIGN.md`; deprecated color `#425B76` must not appear in active docs (OK in historical prompts).
8. **Drift** — Remove duplicate/contradictory instructions between README and runbook; prefer README for reference tables, runbook for step-by-step.

## Verification

After edits, spot-check:

- No broken internal links to removed paths
- Env table includes any new Settings fields from recent features
- Runbook steps match current admin UI routes (`/admin/jobs`, etc.)

Do not commit unless the user asks.

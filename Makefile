# Pulse of Technology — local quality gates (run from repo root)
# Backend quality gates run inside the Compose backend image for parity.

.PHONY: lint lint-backend lint-frontend test test-backend test-frontend test-e2e install-backend-dev check

install-backend-dev:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt

check: lint test

lint: lint-backend lint-frontend

lint-backend:
	docker compose exec -w /app/backend backend ruff check . && docker compose exec -w /app/backend backend ruff format --check .

lint-frontend:
	cd frontend && npm run lint

test: test-backend test-frontend

test-backend:
	docker compose exec -w /app/backend backend pytest

test-frontend:
	cd frontend && npm run test

# Requires: docker compose up -d --build (and alembic upgrade if you use a fresh DB)
test-e2e:
	cd frontend && npm run test:e2e

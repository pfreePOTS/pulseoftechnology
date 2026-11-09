# Admin Email MFA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require email OTP after every admin password login before issuing the session cookie.

**Architecture:** Password `POST /api/admin/login` creates an `admin_mfa_challenges` row, emails a 6-digit code via SendGrid, and returns `{ mfa_required, mfa_token }` with no cookie. `POST /api/admin/login/mfa` verifies the code and issues the existing admin JWT cookie. Non-prod may accept `ADMIN_MFA_DEV_CODE` for e2e/pytest.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, bcrypt, PyJWT, SendGrid, Next.js login page, pytest, Playwright.

## Global Constraints

- MFA required for all admin password logins (no opt-out).
- Never log plaintext codes; never return codes in production/staging responses.
- `ADMIN_MFA_DEV_CODE` only honored when `environment` is not `production` or `staging`.
- Preserve existing cookie settings (`_issue_admin_cookie_response`).
- Match existing admin login dark UI / `#E91D24` primary.
- Run backend tests via Docker Compose when the stack is up: `docker compose exec -T backend bash -lc 'cd /app/backend && pytest -q'`.

## File map

| File | Responsibility |
|------|----------------|
| `backend/models/admin_mfa_challenge.py` | Challenge ORM model |
| `backend/alembic/versions/20261108_admin_mfa_challenges.py` | Migration |
| `backend/services/admin_mfa.py` | Create/verify/resend challenge helpers |
| `backend/services/email_service.py` | `send_admin_mfa_code_email` |
| `backend/dependencies.py` | MFA JWT create/decode (`typ=admin_mfa`) |
| `backend/config.py` | MFA settings |
| `backend/routers/admin.py` | Login + MFA endpoints |
| `backend/tests/test_admin_auth.py` + helpers | Auth coverage |
| `frontend/src/app/admin/login/page.tsx` | Two-step UI |
| `frontend/e2e/helpers.ts` + login spec | E2E MFA |
| `.env.example`, `docker-compose.yml`, runbook | Config docs |

---

### Task 1: Model, migration, config, MFA service + email

**Files:**
- Create: `backend/models/admin_mfa_challenge.py`
- Create: `backend/alembic/versions/20261108_admin_mfa_challenges.py` (revises `20261105_industry_analysis`)
- Create: `backend/services/admin_mfa.py`
- Modify: `backend/models/__init__.py`, `backend/config.py`, `backend/dependencies.py`, `backend/services/email_service.py`
- Test: `backend/tests/test_admin_mfa_service.py`

- [ ] **Step 1:** Add failing unit tests for code generation, challenge create/verify, and MFA JWT typ separation.
- [ ] **Step 2:** Implement model, migration, config (`admin_mfa_code_ttl_minutes`, `admin_mfa_max_attempts`, `admin_mfa_dev_code`), `create_admin_mfa_token` / `decode_admin_mfa_token`, `send_admin_mfa_code_email`, and `admin_mfa` service helpers.
- [ ] **Step 3:** Run `pytest backend/tests/test_admin_mfa_service.py -q` — expect PASS.

### Task 2: Wire login / MFA / resend endpoints

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_admin_auth.py`, `backend/tests/conftest.py` (login helper + default `admin_mfa_dev_code` + mock SendGrid)
- Update every test that expects cookie-on-password-login to use the helper.

- [ ] **Step 1:** Write/adjust failing auth tests for MFA-required login.
- [ ] **Step 2:** Change `/login` to challenge+email; add `/login/mfa` and `/login/mfa/resend`.
- [ ] **Step 3:** Run `pytest backend/tests/test_admin_auth.py backend/tests/test_admin_mfa_service.py -q` — expect PASS. Grep other tests posting `/api/admin/login` and update helpers.

### Task 3: Frontend login MFA step

**Files:**
- Modify: `frontend/src/app/admin/login/page.tsx`

- [ ] **Step 1:** After password success with `mfa_required`, show code UI (`admin-login-mfa-code`, `admin-login-mfa-submit`, `admin-login-mfa-resend`) matching existing dark styling; verify then redirect as today.

### Task 4: E2E + docs + Compose env

**Files:**
- Modify: `frontend/e2e/helpers.ts`, `frontend/e2e/admin-login-form.spec.ts`
- Modify: `docker-compose.yml`, `.env.example`, `docs/operational-runbook.md`
- Update design status to Implemented.

- [ ] **Step 1:** `loginAsAdmin` completes login + MFA using `ADMIN_MFA_DEV_CODE` (default `246801` in Compose).
- [ ] **Step 2:** Document MFA in runbook / env examples; apply migration when backend is up.

---

## Spec coverage check

- Pending MFA JWT + challenge table ✓
- Required for all admins ✓
- SendGrid failure → 503, no session ✓
- Resend ✓
- Dev code for e2e ✓
- UI two-step ✓
- Docs ✓

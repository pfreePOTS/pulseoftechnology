# Contact Form → HubSpot Deals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every real `/contact` submission creates a HubSpot contact, a company, and a new deal on the Connected deal pipeline, and shows that attempt on Admin → HubSpot.

**Architecture:** `POST /api/contact` keeps its current behavior (honeypot drop, structured log, SendGrid email, HTTP 201). After the honeypot check it enqueues a second background task, `submit_contact_form_to_hubspot`, beside the existing email task. That task upserts a contact by email, search-or-creates a company by exact name, creates a new deal on the configured pipeline, and associates contact↔company, deal↔contact, and deal↔company. The attempt is one row in `hubspot_sync_logs`. Subscriber newsletter sync is unchanged and is not used for this path.

**Tech Stack:** FastAPI background tasks, existing `hubspot-api-client`, HubSpot CRM v3 objects + v4 default associations, SQLAlchemy/Alembic, Admin → HubSpot page, pytest.

**Status:** Implemented. Go-live still waits on a HubSpot private-app scope grant and the two deal env ids, because the current token cannot read deals or companies.

## Locked decisions

- One new deal per submission. A repeat visit does not update or annotate an existing deal.
- Search-or-create a Company by exact `name`, then associate it to the contact and the deal.
- Contact-form people are not added to the newsletter list and `pulse_subscribed` / `pulse_domains` / `pulse_role` are left untouched.
- The public form still returns 201 when HubSpot fails. The marketing email still sends. The HubSpot log records the failure.
- Honeypot submissions (`website` filled) still return the thank-you response and do not email or call HubSpot.

## What exists today

`POST /api/contact` (`backend/routers/public.py`, `ContactRequest`) accepts name, email, company, message, and optional phone, industry, and role. It logs `[contact] inbound submission` and emails `CONTACT_FORM_TO_EMAIL`. It does not write a database row and does not call HubSpot.

`backend/services/hubspot_sync.py` only upserts **subscribers** as contacts (email, name, industry, `pulse_domains`, `pulse_subscribed`, `pulse_role`) and adjusts newsletter list membership. Admin → HubSpot (`frontend/src/app/admin/hubspot/page.tsx`) shows status, a contacts connectivity test, subscriber reconcile, and `hubspot_sync_logs`.

Live check against the configured private app (2026-11-13): contacts search returns 200. Companies, deals, deal pipelines, and owners return 403. Token scopes are only `crm.objects.contacts.read` and `crm.objects.contacts.write`. The Connected pipeline id cannot be read until deals scopes are granted.

## Global constraints

- Reuse the existing HubSpot client factory and sync-log writer. Do not create a `Subscriber` from a contact form.
- Contact updates from this path send only properties that have a value, so a blank optional field does not wipe an existing newsletter contact.
- Company match is exact `name` (`EQ`). Do not search or merge by email domain.
- Set company `domain` only when the email domain is not a public mailbox (`gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com`, `live.com`, `msn.com`, `icloud.com`, `aol.com`, `proton.me`, `protonmail.com`).
- Deal pipeline and entry stage come from env ids, not from a label lookup on each request.
- Deal name is `{company} — {name}`, trimmed to fit HubSpot. Description carries email, phone, role, industry, and the message.
- Do not set deal amount, close date, or owner. Leave assignment to HubSpot workflows.
- Do not set company `industry`. HubSpot's company industry property is an enumeration and our dropdown labels will not match it. Industry stays on the contact (same string subscriber sync already sends) and in the deal description.
- Log `[hubspot] contact_form` with ids and outcome. Do not log the message body (the form log already records length only). The admin sync-log payload may include the message, same as other CRM payloads on that page.
- No new custom HubSpot properties in this change.

## File map

| File | Responsibility |
|------|----------------|
| `backend/services/hubspot_contact_deals.py` | Form → contact, company, deal, associations |
| `backend/services/hubspot_sync.py` | Keep subscriber sync; share client + sync-log helper if imported, otherwise duplicate the small log writer rather than changing subscriber behavior |
| `backend/routers/public.py` | Enqueue the new task after the honeypot check |
| `backend/models/hubspot_sync_log.py` | Nullable `hubspot_deal_id`, `hubspot_company_id` |
| `backend/alembic/versions/20261113_hubspot_deal_company_ids.py` | Migration off head `20261108_admin_mfa` |
| `backend/config.py`, `.env.example`, `backend/.env.example`, `docker-compose.yml` | `HUBSPOT_CONTACT_DEAL_PIPELINE_ID`, `HUBSPOT_CONTACT_DEAL_STAGE_ID` |
| `backend/routers/admin.py` | Status fields + connectivity test covers contacts, companies, and deals |
| `frontend/src/app/admin/hubspot/page.tsx` | Show pipeline config, deal id, company id, and per-object test result |
| `backend/tests/test_hubspot_contact_deals.py` | Mocked HubSpot unit tests |
| `backend/tests/test_logging.py` | Assert the new `[hubspot] contact_form` line |
| `docs/operational-runbook.md` | Scope list, env ids, and what a form submission creates |

## Flow

```
POST /api/contact
  honeypot filled? → 201, stop
  log [contact]
  enqueue SendGrid notification          (existing)
  enqueue submit_contact_form_to_hubspot (new)
  return 201

submit_contact_form_to_hubspot
  no API key → log skipped, return
  pipeline or stage id missing → upsert contact + company anyway, log deal_skipped_no_pipeline
  1. Search contact by email. Create or partial-update.
  2. Search company by exact name. Create if missing. Associate contact → company.
  3. Create deal (pipeline, stage, name, description). Associate deal → contact and deal → company.
  4. Write one hubspot_sync_logs row.
```

Company failure does not block the deal: the contact and deal are still created and associated to each other, and the log operation is `deal_created_company_failed`. Contact failure stops the deal create; operation is `error_contact`. Deal failure after a good contact is `error_deal`. Full success is `deal_created`.

Name split: first whitespace-delimited token is `firstname`, the remainder is `lastname`. A single token sets `firstname` only.

## HubSpot calls

Use the official client where it already wraps the call. Associations use the v4 default-association endpoint:

- `PUT /crm/v4/objects/contacts/{contactId}/associations/default/companies/{companyId}`
- `PUT /crm/v4/objects/deals/{dealId}/associations/default/contacts/{contactId}`
- `PUT /crm/v4/objects/deals/{dealId}/associations/default/companies/{companyId}`

Deal create properties: `dealname`, `pipeline`, `dealstage`, `description`.

## Admin tracking

`GET /api/admin/hubspot/status` gains:

- `contact_deal_pipeline_configured`
- `contact_deal_stage_configured`

`POST /api/admin/hubspot/test-connection` returns `ok` only when contacts, companies, and deals all authenticate. The body includes a `checks` map so the page can say which object failed. A missing deals scope must not be reported as a green test.

Sync log table adds Company id and Deal id columns. `subscriber_id` stays null for these rows. Source is `contact_form`.

## Prerequisite before production traffic

On the HubSpot private app that owns `HUBSPOT_API_KEY`, add:

- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.schemas.deals.read`
- `crm.objects.companies.read`
- `crm.objects.companies.write`
- `crm.schemas.companies.read`

Then list deal pipelines (read-only) and set:

- `HUBSPOT_CONTACT_DEAL_PIPELINE_ID` to the pipeline whose label matches `connected` (case-insensitive). If more than one matches, stop and confirm which one.
- `HUBSPOT_CONTACT_DEAL_STAGE_ID` to that pipeline's first open stage (`metadata.isClosed` is not true, lowest `displayOrder`).

Set both in local `.env` and in Railway. Restart the API. The code does not guess a pipeline when the env ids are empty.

## Tasks

### Task 1: Config, log columns, and the submit function

**Files:** config, compose, env examples, model, migration, `backend/services/hubspot_contact_deals.py`, `backend/tests/test_hubspot_contact_deals.py`

- [x] Write failing tests for: name split; partial contact properties omit blank optionals and omit every `pulse_*` key; exact-name company create when search total is 0; company reuse when search total is 1; deal create called with pipeline and stage from settings; three default associations on the happy path; second call creates a second deal; company API error still creates the deal and the contact association; missing pipeline id skips the deal and still upserts contact and company; missing API key writes a skipped log and calls no client; contact API error does not create a deal.
- [x] Run `pytest backend/tests/test_hubspot_contact_deals.py -q` and confirm failure.
- [x] Implement the service and migration. Share or call the existing sync-log persist helper with the new id columns.
- [x] Re-run the new tests and `backend/tests/test_hubspot_sync.py` so subscriber sync still passes.

### Task 2: Wire the public contact endpoint

**Files:** `backend/routers/public.py`, contact/logging tests

- [x] Failing test: a normal `POST /api/contact` enqueues `submit_contact_form_to_hubspot` with the form fields and `source="contact_form"`, and still enqueues the SendGrid notification.
- [x] Failing test: honeypot `website` does not enqueue HubSpot or SendGrid.
- [x] Implement the background-task enqueue only after the honeypot return.
- [x] Assert a `[hubspot]` log is not required at request time (the work is background). Cover the service log line in the service tests.

### Task 3: Admin HubSpot page

**Files:** `backend/routers/admin.py`, `frontend/src/app/admin/hubspot/page.tsx`, admin hubspot tests if present

- [x] Extend status and the sync-log schema with the new fields.
- [x] Extend the connectivity test to probe companies search and deals search the same way it probes contacts, without creating records.
- [x] Show pipeline/stage configured, the per-object test result, and deal + company ids in the log table.
- [x] Subscriber reconcile stays a subscriber-only action.

### Task 4: Runbook

**Files:** `docs/operational-runbook.md`

- [x] Document the new env vars, the private-app scopes, and that a contact-form submission creates a contact, a company, and a deal while the marketing email is independent.

## Verification

- Unit tests above, then `docker compose exec -T backend bash -lc 'cd /app/backend && pytest -q backend/tests/test_hubspot_contact_deals.py backend/tests/test_hubspot_sync.py'` once the API container can reach Postgres.
- `ruff check` and `ruff format --check` on touched Python files.
- After scopes and env ids are in place: submit the public contact form once, confirm HTTP 201 and the thank-you state, then confirm in HubSpot a new deal on Connected, associated to the contact and the company, and a `contact_form` / `deal_created` row on Admin → HubSpot.
- Submit a second time with the same email and company. Expect a second deal, the same contact, and the same company.
- Submit with the honeypot filled. Expect thank-you, no email, no HubSpot record, no sync-log row.

## Out of scope

- Retry button for failed rows.
- Newsletter subscribe from the contact form.
- Deal owner, amount, or a stage other than the configured entry stage.
- Fuzzy company matching or merging duplicate company names.
- Changing subscriber reconcile to create deals.

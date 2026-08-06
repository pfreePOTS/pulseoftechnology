# Active bugs — Pulse of Technology

Living tracker for defects, security leftovers, and schedulable tech-debt.  
**ID scheme:** `PULSE-NNN` (increment from the highest Open/Fixed ID below).  
**Template:** [`bug-template.md`](bug-template.md).

Admin/radar UX rows formerly marked **REMAINING** in  
[`docs/cursor-prompts/29-remaining-gaps-comprehensive.md`](../cursor-prompts/29-remaining-gaps-comprehensive.md)  
were **re-validated 2026-08-05** against current `dev` — **none are still open defects** (see Stale doc notes).  
Do not promote gap-doc items here without a fresh code check.

When the PR Review Council approves with follow-ups, add each actionable follow-up here with the next `PULSE-` ID.

---

## Open

| ID | Summary | Severity | Status | Reported | Notes |
|----|---------|----------|--------|----------|-------|
| PULSE-001 | `client_ip` ignores `X-Forwarded-For` / Railway proxy — auth and subscribe logs may record the proxy hop, not the client | Minor | Open | 2026-08-05 | PR #12 council. `backend/log_events.py` `client_ip()`. Prefer trusted-proxy extraction (or SlowAPI’s remote address helper) before relying on IPs for abuse detection. |
| PULSE-002 | Operational logs include subscriber/admin emails on auth, subscribe, and contact paths — retention/access policy unclear for long-lived Railway logs | Minor | Open | 2026-08-05 | PR #12 council. Intentional for ops (`[auth]` / `[subscribe]` / `[contact]`). Document retention expectations or redact/hash emails in production sinks. |
| PULSE-003 | Signal velocity path still has embedding/Pinecone TODO — semantic topic velocity not re-enabled | Enhancement | Open | 2026-08-05 | `backend/services/signal_service.py` (~line 228). `vector_service` + Pinecone config exist; scorer still count-based until embeddings ship. Source: system audit / Prompt 24 lineage. |
| PULSE-016 | Audit newsletter + other dynamic surfaces for hardcoded AI/domain bias (follow-up to recommended-path industry-first) | Enhancement | Open | 2026-08-05 | PR #13 council. Recommended-path fixed; review `email_service` assembly ladder, `ISSUE_DOMAINS` / stage→domain injections, and any remaining customer-facing AI-attribution copy (e.g. stale prompt docs). |
| PULSE-017 | `_topic_industry_aligned` issues a per-topic article query while ranking the recommended-path pool | Minor | Open | 2026-08-05 | PR #13 council. `backend/routers/public.py` `_topics_for_recommended` → `_topic_industry_aligned`. Cap is ~48 topics; batch or cache if latency shows up under load. |

---

## Fixed (historical — do not re-file)

Validated against current `dev` when the tracker was created (2026-08-05). Kept so old audit docs are not treated as open work.

| ID | Summary | Severity | Status | Closed | Evidence |
|----|---------|----------|--------|--------|----------|
| PULSE-010 | Admin auth used static password as Bearer token (SEC-01) | Critical | Fixed | ~2026-04 | JWT + `admin_users`; `require_admin` / httpOnly `pulse_admin` cookie (`backend/dependencies.py`, `test_admin_auth.py`) |
| PULSE-011 | Admin token stored in `localStorage` (SEC-02) | Critical | Fixed | ~2026-04 | Cookie-only session; `frontend/src/lib/api.ts` `adminFetch` — no localStorage token |
| PULSE-012 | No rate limiting on login/subscribe (SEC-04) | Major | Fixed | ~2026-04 | SlowAPI `limiter` on login/subscribe (`backend/rate_limits.py`, routers) |
| PULSE-013 | Untrusted RSS text in LLM prompts without delimiters (SEC-03) | Major | Fixed | ~2026-05 | `<article>` CDATA wrappers + system prompt warnings (`ai_service.py`, `domain_registry.py`) |
| PULSE-014 | Role Profiles UI limited to hardcoded domain tag pills | Major | Fixed | ~2026-05 | Freeform `TagInput` on `frontend/src/app/admin/roles/page.tsx` |
| PULSE-015 | Classification feedback dropped AI `original_domain` when article had no topic (ternary/`or` precedence after ruff wrap) | Major | Fixed | 2026-08-05 | `e8e7a36`; assert in `backend/tests/test_article_review_api.py` |
| PULSE-004 | Staging `/recommended-path` Our Process cards showed flat SVG bands instead of photos — `recommended_path_process_card_library` was empty on Staging (0 rows vs 84 on Dev), so every cell 404'd and the frontend used its band fallback | Major | Fixed | 2026-08-05 | Data gap, not code: table exists at the shared head `20260530_domain_registry`, but the library was seeded on Dev after the last Staging restore, and Staging has no `OPENAI_API_KEY` to re-render. Copied all 84 cells with the new `backend/copy_process_card_images_between` (see [`scripts/db/README.md`](../../scripts/db/README.md)); Staging now serves 1536×1024 PNGs for all 21 industries × 4 sections. Regression test: `backend/tests/test_copy_process_card_images_between.py`. |

---

## Stale doc notes (re-validated 2026-08-05)

| Doc claim | Current reality | Track here? |
|-----------|-----------------|-------------|
| Prompt 29 **28-9 / DR-3** — Analysis still accordion+sliders | **Done** — `/admin/analysis` is a CSS-grid spreadsheet (`gridTemplateColumns`, Impact/Risk cells) | No |
| Prompt 29 **28-10** — signal rationale full-length inline | **Done** — Trend Discovery table uses `line-clamp-2` on `signal_rationale` | No |
| Prompt 29 **DR-2** — Trend Discovery flat table, no drawer | **Done** — detail drawer (`selectedTopicId` / `drawerEntered` on `/admin`) | No |
| Prompt 29 **DR-4** — Newsletter left rail + manual refresh | **Done** — horizontal chip bar + debounced auto-refresh in `NewsletterSandboxPanel` | No |
| Prompt 29 **DR-5** — Publishing has no radar controls | **Done** — `/admin/publishing` hosts `RadarPublishingSection`; Newsletter links there | No |
| Prompt 29 **DR-6** — Radar hover-only (no click-to-lock) | **Done** — `lockedKey` in `RadarChart.tsx` | No |
| Prompt 29 **DR-7** — Default panel “Hover a star” | **Done** — `RadarDefaultPanel` intro + Top 3 + subscribe CTA | No |
| Prompt 29 **DR-8** — No subscribe CTA in tooltip | **Done** — “Get briefings on {topic} →” with domain prefill | No |
| Prompt 29 **DR-9** — Empty domains = All, no visual “All” | **Superseded** — wizard requires ≥1 domain (`validateStep4`); not empty=all anymore | No |
| Prompt 29 **ER-1** — approve lacks explicit `begin()` | **Not a validated defect** — `approve_topic` uses try/`commit`/`rollback`; no observed failure mode | No |
| Prompt 29 **CL-1** — unused `Workbench*.tsx` | **Gone** | No |
| Prompt 29 **CL-2** — `/admin/signals` stale | **OK** — explains merge + link to `/admin` | No |
| Prompt 29 **CL-3** — separate Radar Preview vs Publishing | **Intentional** — Publishing = live toggles; Radar Preview = chart modes; not a bug | No |
| `security/audit-report.md` SEC-01/02/04 | **Superseded** by PULSE-010–012 Fixed | — |
| `system-audit-report.md` Role tags UI | **Fixed** (PULSE-014) | — |
| `system-audit-report.md` Pinecone/embeddings gap | Partial — tracker **PULSE-003** only | PULSE-003 |

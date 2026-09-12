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
| PULSE-034 | Nightly newsletter: SendGrid accepted (HTTP 202) at 12:00 AM PT but recipient did not see mail | Major | Open | 2026-09-02 | User report. 2026-09-02 job ran local (2) + staging (3). Subjects about METR credential theft. No bounce/block/spam/unsub for those addresses. Dual send from local Compose + Railway at the same minute. Inbox/quarantine vs SendGrid activity still unconfirmed. |
| PULSE-032 | Staging Collection filling with `raw`/`retry`; AI Performance shows 0 runs because `LLMAPIError` (provider billing/outage) writes no AgentRun | Critical | Open | 2026-08-18 | Keys recovered later 2026-08-18. Staging review leftovers (889 LLMAPIError rows) bulk-requeued to retry 2026-08-18 19:58 PT. Admin bulk action: `POST /api/admin/articles/review/requeue-provider-errors`. Empty-JSON retries: PULSE-033. |
| PULSE-031 | Newsletter tip-of-week CTA still generic (`pulseone.com`) — not aligned to rotated Marketplace offer / assessment | Enhancement | Open | 2026-08-13 | PR #27 council. `_build_tip_block` in `email_service.py`. |
| PULSE-026 | Recommended-path / everyone synthesis cache is in-process only (lost on restart; not shared across replicas) | Enhancement | Deferred (single-replica ops) | 2026-08-05 | Documented in `docs/operational-runbook.md` + `railway/README.md`: keep Backend at 1 replica. Shared Postgres/Redis cache is the follow-on when multi-replica is required. |
| PULSE-003 | Signal velocity path still has embedding/Pinecone TODO — semantic topic velocity not re-enabled | Enhancement | Deferred (needs real embeddings) | 2026-08-05 | Placeholder hash embedder in `vector_service` is not production-ready. SQL coverage counts remain authoritative; comment clarified in `signal_service._article_count_in_window`. Unblock only after Voyage/OpenAI embeds + index backfill. |

### Hardcoded bias audit notes (2026-08-05)

| Severity | Finding | Where |
|----------|---------|-------|
| Major | `Leadership` → `ai` legacy slug | `domain_registry.LEGACY_DOMAIN_TO_SLUG` → PULSE-018 |
| Major | Newsletter can fill from domain cohort without industry once ≥5 fresh | `email_service._resolve_newsletter_topic_pool` → PULSE-019 |
| Minor | Broad stage AI tokens (`assistant`, `generative`, `copilot`) | `public._domains_for_intake` → PULSE-020 |
| Minor | Hero art maps many tech industries/issues to AI image | `recommendedPathHero.ts` → PULSE-021 |
| Note | `Finance` → `compliance` legacy slug | intentional consolidation, not AI bias |
| Cleared | Static `/custom-solutions` mock is Healthcare CEO + AI focus | route removed during SEO/AIEO pass; replaced by `/services` |
| Note | README “AI-powered…” | repo-only, not public site |
| Cleared | Strategy → AI hard-map + AI-curation customer copy | PR #13 |

---

## Fixed (historical — do not re-file)

Validated against current `dev` when the tracker was created (2026-08-05). Kept so old audit docs are not treated as open work.

| ID | Summary | Severity | Status | Closed | Evidence |
|----|---------|----------|--------|--------|----------|
| PULSE-033 | Ingest classify/cluster empty DeepSeek JSON (`deepseek-v4-pro` thinking ate `max_tokens`) | Major | Fixed | 2026-08-18 | `_call_result` forces `disable_thinking=True` on every `json_response` call (ingest nodes + topic_persona, subdomain_topic, industry_positioning, trend_pick, topic_summary, signal). `tests/test_pipeline_disable_thinking.py` |
| PULSE-030 | Document Marketplace Content Library seed for Staging/prod | Minor | Fixed | 2026-08-13 | README + `docs/operational-runbook.md` + `railway/README.md`; `seed_local_dev` includes `seed_marketplace_offers` |
| PULSE-029 | Homepage `LoopSection` lowercase IT wordplay vs `/approach` / radar | Minor | Fixed | 2026-08-07 | `See IT coming` / `Make the most of IT` in `LoopSection.tsx`; body pronouns stay lowercase |
| PULSE-028 | Voice regression missed backend identity / `ai_service` brochure phrases | Enhancement | Fixed | 2026-08-07 | `backend/tests/test_backend_voice_bans.py` scans `pulseone-identity.md` + `ai_service.py` |
| PULSE-025 | Staging process-card library lagged Dev on people-inclusive cells | Minor | Fixed | 2026-08-07 | Compared 84/42 both sides; `copy_process_card_images_between` → Staging 42 updated / 42 current; recipe in `railway/README.md` |
| PULSE-001 | `client_ip` ignored `X-Forwarded-For` behind Railway | Minor | Fixed | 2026-08-07 | `log_events.client_ip` + `TRUST_PROXY_HEADERS`; `test_log_events_privacy.py` |
| PULSE-002 | Ops logs logged cleartext emails without retention guidance | Minor | Fixed | 2026-08-07 | `LOG_REDACT_EMAILS` hashes local-part in staging/prod; runbook retention note; privacy tests |
| PULSE-027 | Published/selected radar topics stayed live with zero non-archived articles (duplicate Identity and access + other empty published rows) | Major | Fixed | 2026-08-06 | `demote_radar_topics_without_articles` in signal flow; publish guard; public `/topics/published` requires ≥1 active article. Live: 14 demoted; Identity id=2 kept (25 arts). `backend/tests/test_demote_empty_radar_topics.py` |
| PULSE-010 | Admin auth used static password as Bearer token (SEC-01) | Critical | Fixed | ~2026-04 | JWT + `admin_users`; `require_admin` / httpOnly `pulse_admin` cookie (`backend/dependencies.py`, `test_admin_auth.py`) |
| PULSE-011 | Admin token stored in `localStorage` (SEC-02) | Critical | Fixed | ~2026-04 | Cookie-only session; `frontend/src/lib/api.ts` `adminFetch` — no localStorage token |
| PULSE-012 | No rate limiting on login/subscribe (SEC-04) | Major | Fixed | ~2026-04 | SlowAPI `limiter` on login/subscribe (`backend/rate_limits.py`, routers) |
| PULSE-013 | Untrusted RSS text in LLM prompts without delimiters (SEC-03) | Major | Fixed | ~2026-05 | `<article>` CDATA wrappers + system prompt warnings (`ai_service.py`, `domain_registry.py`) |
| PULSE-014 | Role Profiles UI limited to hardcoded domain tag pills | Major | Fixed | ~2026-05 | Freeform `TagInput` on `frontend/src/app/admin/roles/page.tsx` |
| PULSE-015 | Classification feedback dropped AI `original_domain` when article had no topic (ternary/`or` precedence after ruff wrap) | Major | Fixed | 2026-08-05 | `e8e7a36`; assert in `backend/tests/test_article_review_api.py` |
| PULSE-004 | Staging `/recommended-path` Our Process cards showed flat SVG bands instead of photos — `recommended_path_process_card_library` was empty on Staging (0 rows vs 84 on Dev), so every cell 404'd and the frontend used its band fallback | Major | Fixed | 2026-08-05 | Data gap, not code: table exists at the shared head `20260530_domain_registry`, but the library was seeded on Dev after the last Staging restore, and Staging has no `OPENAI_API_KEY` to re-render. Copied all 84 cells with the new `backend/copy_process_card_images_between` (see [`scripts/db/README.md`](../../scripts/db/README.md)); Staging now serves 1536×1024 PNGs for all 21 industries × 4 sections. Regression test: `backend/tests/test_copy_process_card_images_between.py`. |
| PULSE-016 | Audit newsletter + other surfaces for hardcoded AI/domain bias | Enhancement | Fixed | 2026-08-05 | Audit complete; remediations PULSE-018–021. Notes in Open section. |
| PULSE-017 | Per-topic article queries in recommended-path industry alignment | Minor | Fixed | 2026-08-05 | Batched `_industry_aligned_topic_ids`; `test_industry_aligned_topic_ids_batches_article_lookup` |
| PULSE-018 | Legacy `Leadership` domain slugified to `ai` | Major | Fixed | 2026-08-05 | Now → `other`; migrate drops Leadership; `test_domain_registry.py` |
| PULSE-019 | Newsletter domain tiers dropped industry ordering | Major | Fixed | 2026-08-05 | `_order_newsletter_pool_industry_first`; email_service test |
| PULSE-020 | Broad stage AI soft-boost tokens | Minor | Fixed | 2026-08-05 | Tight regex in `_domains_for_intake` |
| PULSE-021 | Recommended-path hero defaulted tech sectors to AI art | Minor | Fixed | 2026-08-05 | `recommendedPathHero.ts` + Vitest |
| PULSE-022 | `/approach` page carried legacy voice and stale claims ("best-in-class", "global IT services company", retired `Leadership` insight tag, 4.3★ stats band; temporary ban of brand IT wordplay) | Minor | Fixed | 2026-08-05 | Partnership-framed hero kept. Brochure phrases stay banned in `voice.test.ts`. Brand IT wordplay (**Better IT** / **get IT done** / **Doing IT Right**) restored intentionally in PR #25 with ≤1 play per copy block. |
| PULSE-024 | Public `/radar` loading screen exposed internal ops notes to visitors ("verify the Pulse API is running (e.g. `docker compose up`) — server-side loads use `SERVER_API_URL` … `http://backend:8000`") | Minor | Fixed | 2026-08-05 | Visitor-appropriate copy in `frontend/src/app/radar/loading.tsx`; swept all public loading/error/empty states (admin excluded) — no other leaks. Regression test: dev-note phrases added to the banned list in `frontend/src/app/approach/voice.test.ts`. |
| PULSE-023 | `/recommended-path` builds took 90–145s and hung the "Preparing how to engage" overlay step; concurrent/abandoned builds each held a DB pool connection for the full LLM round-trip, exhausting the pool (`QueuePool limit … reached`) and 500-ing even the fast `skip_ai=true` shell request. Root causes: interactive synthesis ran on the pro reasoning tier (`deepseek-v4-pro`) whose reasoning tokens consumed most of `max_tokens` and truncated the JSON (every view fell back and re-ran); no result caching; DB connection held through the provider call. `/everyone-overview` shared the same family (plus a fragile `json.loads` with no repair). | Major | Fixed | 2026-08-05 | Family fix across both call sites of interactive synthesis (`generate_path_synthesis`, `generate_everyone_overview` in `backend/services/ai_service.py`): fast-tier model via `RECOMMENDED_PATH_LLM_MODEL` (default `deepseek-v4-flash`), `disable_thinking` passthrough in `backend/services/llm_client.py`, 1h TTL cache + single-flight per intake, `db.rollback()` before the LLM round-trip, JSON-repair on the everyone parse; client fetch effect keyed on intake values (`RecommendedPathProgressiveBody.tsx`). Measured: first build 112s → 19s, repeat view 72ms, `/everyone-overview` repeat 11ms. Regression tests: `backend/tests/test_recommended_path_synthesis_cache.py` (fails on pre-fix code: no cache, wrong tier, no connection release). |

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

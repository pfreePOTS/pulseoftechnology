# Stale review expiry + prompt-optimizer unblock

**Date:** 2026-09-02  
**Status:** Implemented  
**Primary files:** `backend/services/archive_service.py`, `backend/scheduler.py`, `backend/services/optimizer_service.py`

## Goal

Clear leftover Collection review rows that are older than the evidence window, and stop a single forgotten prompt proposal from blocking the nightly optimizer forever.

## Review expiry

- No new cron. Runs inside the existing archive job (05:00 UTC / 10:00 PM PT).
- Function: `expire_stale_review_articles(db)`.
- Eligible: `status=review` whose coverage time (`published_at` else `ingested_at`) is older than the merged evidence window (`trend_window_days + trend_prior_window_days`, currently 14).
- Action: `status=skipped`, set `archived_at` if missing, append a short `review_notes` line. No LLM, no delete.
- Honors `article_archive_enabled` (same as the other archive passes).
- Recent review rows stay for a curator.

## Prompt optimizer

- No new cron. Same 02:00 UTC / 7:00 PM PT job.
- Before the pending-proposal gate: reject any `pending` proposal older than 14 days (`status=rejected`, rationale `Expired unused after 14 days.`).
- Fresh pending proposals still block so a curator can review them.
- The April 2026 leftover is older than 14 days and will expire on the next job run (or when the expire helper is invoked).

## Out of scope

- Stale Trend Discovery `watch` signal expiry
- RSS feed parser fixes
- Newsletter delivery (PULSE-034)
- Re-running AI on expired review rows

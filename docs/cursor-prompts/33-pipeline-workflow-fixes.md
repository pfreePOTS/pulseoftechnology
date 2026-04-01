# Prompt 33: Pipeline Workflow Fixes (Trends & Newsletter)

## Context
The user has requested an audit of the end-to-end ingestion and newsletter pipeline. The goal is to ensure that trend analysis can operate over configurable time windows (e.g., 10, 20, 30 days), that emotion/sentiment is factored into the trend discovery, and that the newsletter reliably picks up "new" articles for selected topics without being overly constrained by strict 24-hour ingestion cutoffs.

## Implementation Steps

### Step 1: Configurable Trend Windows
Currently, `trend_service.py` and `signal_service.py` hardcode a 7-day lookback window (`timedelta(days=7)`).

1. In `backend/config.py`, add two new settings:
   - `trend_window_days: int = 14` (Default to 14 days for the primary trend window)
   - `trend_prior_window_days: int = 14` (Default to 14 days for the comparison window)
2. In `backend/services/trend_service.py` (`build_positioning_insights`), replace the hardcoded `timedelta(days=7)` and `timedelta(days=14)` with the new config values.
3. Update the `_TREND_SYSTEM` prompt in `trend_service.py` to instruct Claude to look for "emotion, alarm, or crisis tone" in the titles, not just volume.
4. In `backend/services/signal_service.py`, replace `VELOCITY_THRESHOLD` and `ACCELERATION_THRESHOLD` with config-driven values if possible, or at least replace the hardcoded 7-day `week_start` with `settings.trend_window_days`.

### Step 2: Newsletter Article Recency Logic
Currently, `run_daily_newsletter` in `email_service.py` only selects topics if they have an article ingested in the last 24 hours (`Article.ingested_at >= cutoff`). This means a selected topic might be omitted from the newsletter even if it's still highly relevant, just because no *new* article arrived that exact day.

1. In `backend/services/email_service.py` (`run_daily_newsletter`), change the `cutoff` logic. Instead of strictly requiring an article in the last 24 hours to include the *topic*, we should include all `selected` topics, but only show articles published within a configurable `newsletter_article_lookback_days` (default 7 days).
2. Update `_build_html` to ensure that if a topic is included, it only lists articles from the recent lookback window. If a topic has no recent articles, it can be included as a "Trend to Watch" without specific article links, or omitted entirely based on a new config flag.
3. Ensure that the article filtering in `_build_html` continues to prioritize the intersection of `Article.tags` and `Role.tags`.

### Step 3: Industry-Specific Newsletter Filtering
Currently, the newsletter filters topics by `Domain` (via `subscriber.domains`), but it doesn't explicitly filter the *content* of the topic by the subscriber's `Industry`.

1. In `email_service.py` (`_build_html`), when assembling the `why_it_matters` text, check if the topic has an `industry_positions` JSON block.
2. If `subscriber.industry` matches a key in `topic.industry_positions`, prepend or append the industry-specific `rationale` to the persona-specific impact. This ensures the newsletter explicitly tells the user why this matters to *their* industry, not just their role.

## Validation Checklist
- [ ] `trend_window_days` is configurable in `.env` and used in `trend_service.py`.
- [ ] The AI trend prompt explicitly asks for emotion/tone analysis.
- [ ] The daily newsletter includes selected topics based on a wider article lookback, not a strict 24-hour ingestion cutoff.
- [ ] The newsletter explicitly surfaces industry-specific rationale from the topic's `industry_positions`.

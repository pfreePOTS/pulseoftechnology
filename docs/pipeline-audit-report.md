# Pulse of Technology: Pipeline Workflow Audit

## User Intent vs. Current Implementation

The user described a specific 4-step pipeline:
1. **Collection**: Automatically search for updated news on a cron cycle.
2. **Trend Analysis**: Keep articles and evaluate them for trends over configurable time windows (10, 20, 30 days). Look for volume, velocity, or emotion increases *before* topics are picked.
3. **Selection**: Topics are reviewed, selected, and put on the radar.
4. **Newsletter**: New articles for the selected topics are added to the newsletter using tags for industry, title, topic, etc.

Here is how the current `dev` branch code actually behaves against that intent:

### 1. Collection (Cron Job)
*   **Intended**: Celery/Beat cron cycle fetching hundreds of articles.
*   **Current Code**: Uses `APScheduler` running in-process inside the FastAPI app (`backend/scheduler.py`). It runs `_ingestion_job` every 1 hour.
*   **Gap**: While it is automated, running APScheduler inside FastAPI means it will duplicate jobs if the app is scaled horizontally (multiple workers). It is not a true Celery/Beat setup, though it functions well enough for a single-instance MVP.

### 2. Trend Analysis (Windows & Emotion)
*   **Intended**: Configurable retention (10-20-30 days), pre-topic trend discovery, and evaluation of volume/velocity/emotion.
*   **Current Code**: 
    *   **Windows**: Hardcoded to a single 7-day vs prior 7-day window (`backend/services/trend_service.py` and `backend/services/signal_service.py`). There is no configurable 10/20/30 day logic.
    *   **Emotion**: The AI prompt in `trend_service.py` (`_TREND_SYSTEM`) asks Claude to look at whether titles suggest "escalating crisis, steady attention, or fading coverage" (emotion/tone), but this is only applied to *already-created* topics.
    *   **Pre-Topic Discovery**: The system clusters articles into topics *immediately* upon ingestion (`ai_service.py` -> `_node_cluster`). Trend analysis is then run on the Topic, not on the raw article pool. There is no concept of a "trend" that isn't already a "topic".
*   **Gap**: The biggest gap is the hardcoded 7-day window. The system needs to support configurable lookback windows (e.g., 30 days) to identify slower-moving trends.

### 3. Selection & Radar
*   **Intended**: Topics are analyzed by industry/risk and published to the radar.
*   **Current Code**: This works as intended. `ai_service.py` has `suggest_industry_positions` which evaluates risk/impact per industry, and the `admin.py` router handles state transitions (`watch`, `select`, `approve`, `publish`).

### 4. Newsletter (New Articles & Tags)
*   **Intended**: "Once they are on the radar, then the new articles need to be added to the newsletter, using the tags for industry, title, topic, etc."
*   **Current Code**: 
    *   `email_service.py` uses a 24-hour cutoff to find "recently approved" topics with new articles (`Article.ingested_at >= cutoff`).
    *   It filters topics by the subscriber's `domains`.
    *   It filters articles within a topic by intersecting `Article.tags` with `Role.tags` (via the subscriber's role).
    *   It prefers persona-specific impact statements (`article.persona_impacts[role.name]`).
*   **Gap**: The logic is mostly correct, but the 24-hour cutoff in `run_daily_newsletter` means if a topic is on the radar but hasn't had an article ingested *exactly* in the last 24 hours, it won't appear in the newsletter at all. Furthermore, the filtering is based on `Role.tags` intersecting with `Article.tags`, but there's no explicit filtering by `Industry` at the article level (only domain filtering at the topic level).

## Summary of Required Fixes

1.  **Trend Windows**: Refactor `trend_service.py` and `signal_service.py` to accept configurable lookback windows (e.g., 14, 30, 60 days) instead of hardcoded 7-day windows.
2.  **Newsletter Article Recency**: Ensure the newsletter logic clearly defines what a "new" article is (e.g., published since the last newsletter was sent) rather than strictly requiring ingestion within 24 hours for the topic to be included.
3.  **Job Architecture (Optional)**: Move from `APScheduler` to `Celery/Beat` if scale-out is required, though for MVP `APScheduler` is sufficient. We will document this but perhaps not force a Celery rewrite right now unless requested, as it requires infrastructure changes (Redis/RabbitMQ).

# Prompt 33: Pipeline Workflow Fixes — Configurable Trends, Article Archiving, Newsletter Recency & Admin Scheduling

## Context

The ingestion → trend analysis → topic selection → newsletter pipeline has structural gaps between the intended workflow and the current implementation. This prompt addresses all of them in 5 steps.

**Intended workflow:**
1. Cron job collects hundreds of articles across many technology topics (hourly).
2. Articles are retained for a configurable window (default 30 days). Older articles are archived and excluded from trend evaluation.
3. Trend analysis looks at all articles within the retention window for volume, velocity, and emotion increases — *before* topics are picked for the radar.
4. Once topics are on the radar, new articles feed into the newsletter using tags for industry, role, topic, etc.
5. The newsletter sends automatically on a configurable schedule (default: daily). No manual button push required.

**Current gaps:**
- Trend windows are hardcoded to 7 days in both `trend_service.py` and `signal_service.py`.
- There is no article archiving — articles accumulate forever with no retention policy.
- The newsletter excludes topics entirely if no article was ingested in the last 24 hours, even if the topic is still on the radar.
- There is no `last_sent_at` tracking, so "since last newsletter" cannot be computed.
- There is no admin UI to configure schedule timing, retention windows, or newsletter cadence.
- The newsletter sends automatically via APScheduler at 07:00 UTC (this is correct), but the admin has no way to change the time or frequency.

---

## Step 1: Add Configuration Settings to `backend/config.py`

Add these new fields to the `Settings` class:

```python
# Trend analysis
trend_window_days: int = 7          # Primary lookback window (default 7, admin can set 14/30/60)
trend_prior_window_days: int = 7    # Comparison window (same size as primary by default)

# Article retention
article_retention_days: int = 30    # Articles older than this are archived and excluded from trend eval
article_archive_enabled: bool = True

# Newsletter
newsletter_article_lookback_days: int = 7   # Show articles from this many days in the newsletter
newsletter_send_hour_utc: int = 7           # Hour (0-23) to send the daily newsletter
newsletter_send_minute_utc: int = 0         # Minute (0-59)
newsletter_enabled: bool = True             # Master on/off for automatic sending
```

These must also be loadable from `.env` via the existing Pydantic mechanism. Update `.env.example` with all new keys and sensible defaults.

---

## Step 2: Create `SiteConfig` Model and Admin Settings Page

### Backend

Create `backend/models/site_config.py`:

```python
class SiteConfig(Base):
    __tablename__ = "site_config"
    id: int  # Always 1 (singleton row)
    key: str  # e.g. "trend_window_days", "newsletter_send_hour_utc"
    value: str  # Stored as string, parsed by type
    updated_at: datetime
```

Alternatively, use a single-row JSON blob approach:

```python
class SiteConfig(Base):
    __tablename__ = "site_config"
    id: int = 1  # singleton
    config: dict  # JSON column with all admin-configurable settings
    updated_at: datetime
```

Add endpoints in `backend/routers/admin.py`:
- `GET /api/admin/settings` — returns current config (merged: DB overrides `.env` defaults)
- `PUT /api/admin/settings` — updates the DB config row

### Frontend

Create `frontend/src/app/admin/settings/page.tsx`:
- Add "Settings" to the admin sidebar nav in `layout.tsx` (below "System Jobs")
- Display a form with grouped sections:
  - **Trend Analysis**: `trend_window_days` (dropdown: 7/14/30/60), `trend_prior_window_days` (same)
  - **Article Retention**: `article_retention_days` (dropdown: 14/30/60/90), toggle for `article_archive_enabled`
  - **Newsletter Schedule**: `newsletter_send_hour_utc` (time picker or dropdown 0-23), `newsletter_send_minute_utc`, toggle for `newsletter_enabled`
- Save button calls `PUT /api/admin/settings`
- Show a "Last newsletter sent" timestamp (see Step 4)

---

## Step 3: Configurable Trend Windows + Emotion Analysis

### `backend/services/trend_service.py`

In `build_positioning_insights()`:
- Replace `timedelta(days=7)` with `timedelta(days=settings.trend_window_days)` (or the DB-overridden value)
- Replace `timedelta(days=14)` with `timedelta(days=settings.trend_window_days + settings.trend_prior_window_days)`
- Update the `_TREND_SYSTEM` prompt to explicitly instruct the AI to evaluate **emotion, alarm, urgency, and crisis tone** in article titles, not just volume. Replace the current prompt text:

```
Compare the last {trend_window_days} days vs the {trend_prior_window_days} days before:
article volume, velocity of publication, and whether titles suggest escalating alarm,
urgency, crisis, optimism, or fading interest. Weight emotional intensity alongside
raw volume — a small number of alarming articles can outweigh a large number of routine ones.
```

- Update the AI payload to include `articles_ingested_last_Xd` and `articles_ingested_prior_Xd` with the actual window sizes, not hardcoded "7d" labels.

### `backend/services/signal_service.py`

In `compute_topic_velocity_metrics()` and `run_signal_scorer()`:
- Replace `timedelta(days=7)` with `timedelta(days=settings.trend_window_days)`
- Replace `timedelta(days=14)` with `timedelta(days=settings.trend_window_days + settings.trend_prior_window_days)`

---

## Step 4: Article Archiving + Retention

### Backend

Add an `archived_at` nullable datetime column to the `Article` model (`backend/models/article.py`). Create an Alembic migration for this.

Create a new function in `backend/services/ingestion.py` (or a new `backend/services/archive_service.py`):

```python
def archive_old_articles(db: Session) -> int:
    """Archive articles older than article_retention_days. Archived articles are excluded from trend analysis."""
    cutoff = datetime.now(UTC) - timedelta(days=settings.article_retention_days)
    stale = db.query(Article).filter(
        Article.ingested_at < cutoff,
        Article.archived_at.is_(None),
    ).all()
    for article in stale:
        article.archived_at = datetime.now(UTC)
    db.commit()
    return len(stale)
```

Add this as a scheduled job in `backend/scheduler.py` — run it daily at 05:00 UTC (before signal scoring).

**Critical:** Update ALL queries in `trend_service.py`, `signal_service.py`, and `email_service.py` to add `.filter(Article.archived_at.is_(None))` so archived articles are excluded from trend evaluation and newsletter assembly. Do NOT delete archived articles — they remain in the database for historical reference but are invisible to the active pipeline.

### Frontend

On the Collection page (`frontend/src/app/admin/research/page.tsx`), add a toggle or tab to show "Archived" articles separately from active ones. Display the archive count.

---

## Step 5: Newsletter Recency + Automatic Sending

### `backend/services/email_service.py`

**Change the topic selection logic in `run_daily_newsletter()`:**

Currently:
```python
cutoff = datetime.now(UTC) - timedelta(hours=24)
eligible_topics = db.query(Topic).filter(...).filter(
    sa_exists().where((Article.topic_id == Topic.id) & (Article.ingested_at >= cutoff))
).all()
```

Replace with:
```python
article_cutoff = datetime.now(UTC) - timedelta(days=settings.newsletter_article_lookback_days)

# Include ALL selected/watched topics — they're on the radar, they belong in the newsletter
eligible_topics = db.query(Topic).filter(
    Topic.status.in_([TopicStatus.watched, TopicStatus.selected])
).all()
```

Then in `_build_html()`, when fetching articles for each topic, add a recency filter:
```python
.filter(Article.ingested_at >= article_cutoff)
.filter(Article.archived_at.is_(None))
```

This means: all radar topics appear in the newsletter, but only recent (non-archived) articles are shown under each topic.

**Add `last_newsletter_sent_at` tracking:**

After successfully dispatching all newsletters in `run_daily_newsletter()`, update the `SiteConfig` singleton with `last_newsletter_sent_at = datetime.now(UTC)`. This timestamp is displayed on the admin Settings page and can be used in the future to compute "articles since last send" instead of a fixed window.

**Add industry-specific rationale:**

When building the topic block in `_build_html()`, check if `topic.industry_positions` is a dict and if `subscriber.industry` matches a key. If so, append the industry-specific `rationale` to the topic summary:

```python
industry_rationale = ""
if subscriber.industry and isinstance(topic.industry_positions, dict):
    pos = topic.industry_positions.get(subscriber.industry)
    if isinstance(pos, dict) and pos.get("rationale"):
        industry_rationale = f" For {subscriber.industry}: {pos['rationale']}"
```

### `backend/scheduler.py`

Update `start_scheduler()` to read `newsletter_send_hour_utc` and `newsletter_send_minute_utc` from config instead of hardcoding `hour=7, minute=0`. Also add the archive job:

```python
scheduler.add_job(
    _archive_job,
    trigger="cron",
    hour=5, minute=0,
    id="article_archiver",
    replace_existing=True,
)
scheduler.add_job(
    _newsletter_job,
    trigger="cron",
    hour=settings.newsletter_send_hour_utc,
    minute=settings.newsletter_send_minute_utc,
    id="daily_newsletter",
    replace_existing=True,
)
```

**Note on Railway compatibility:** APScheduler's `BackgroundScheduler` runs in-process and works fine on Railway as long as only one instance of the FastAPI app is running (which is the default). The `replace_existing=True` flag prevents duplicate jobs on app restart. This is documented in the Jobs page already. No Celery migration is needed at this stage.

---

## Validation Checklist

- [ ] `trend_window_days` and `trend_prior_window_days` are configurable via `.env` and the admin Settings page
- [ ] The AI trend prompt explicitly asks for emotion, alarm, and crisis tone analysis
- [ ] All trend queries use the configurable window, not hardcoded 7 days
- [ ] Articles older than `article_retention_days` are marked `archived_at` and excluded from all trend/newsletter queries
- [ ] The daily newsletter includes ALL selected/watched topics, not just those with 24-hour-fresh articles
- [ ] Articles shown in the newsletter are filtered by `newsletter_article_lookback_days` and `archived_at IS NULL`
- [ ] Industry-specific rationale from `topic.industry_positions` is injected into the newsletter when the subscriber's industry matches
- [ ] `last_newsletter_sent_at` is tracked and displayed on the admin Settings page
- [ ] Newsletter send time is configurable via the admin Settings page
- [ ] The archive job runs daily at 05:00 UTC before signal scoring
- [ ] The Collection page has an "Archived" tab/toggle
- [ ] `.env.example` is updated with all new config keys

## Files Modified

| File | Changes |
|------|---------|
| `backend/config.py` | Add 7 new settings fields |
| `backend/models/site_config.py` | **New file** — singleton config model |
| `backend/models/article.py` | Add `archived_at` column |
| `backend/routers/admin.py` | Add `GET/PUT /api/admin/settings` endpoints |
| `backend/services/trend_service.py` | Use configurable windows, update AI prompt for emotion |
| `backend/services/signal_service.py` | Use configurable windows |
| `backend/services/email_service.py` | Remove 24h cutoff, add article lookback filter, add industry rationale, track last_sent_at |
| `backend/services/ingestion.py` or `archive_service.py` | Add `archive_old_articles()` function |
| `backend/scheduler.py` | Add archive job, use configurable newsletter time |
| `frontend/src/app/admin/settings/page.tsx` | **New file** — admin settings UI |
| `frontend/src/app/admin/layout.tsx` | Add "Settings" nav item |
| `frontend/src/app/admin/research/page.tsx` | Add archived articles tab |
| `.env.example` | Add all new config keys |
| Alembic migration | Add `archived_at` to articles, create `site_config` table |

# Refactor Admin Pipeline: 4-Step Editorial Flow

## Context

The current admin interface blurs the lines between raw article ingestion, topic curation, and signal intelligence. The user expects a strict 4-step editorial pipeline:

1. **Collection (Research):** Raw articles from RSS feeds.

1. **Trending (Signals/Discovery):** AI-clustered topics with velocity/acceleration metrics.

1. **Analysis (Positioning):** Industry-specific risk and adoption state adjustments.

1. **Publishing (Radar/Newsletter):** Final review and dispatch.

Currently, "Research" shows topics instead of articles, and "Signals" is a separate page that requires admins to check velocity disconnected from the curation approval step.

## Objective

Refactor the admin UI and backend endpoints to explicitly match this 4-step flow.

## Step 1: Create "Raw Research" View (Step 1 of Pipeline)

1. Create a new page at `frontend/src/app/admin/research/page.tsx`.

1. This page should fetch from a new endpoint `GET /api/admin/articles?status=raw,processed`.

1. Display a simple data table of the raw firehose: `Source`, `Title`, `Published Date`, and `Status` (Raw/Processed).

1. **Do not** include topic clustering here. This is purely to monitor the ingestion engine's output.

1. In `backend/routers/admin.py`, add the `GET /articles` endpoint that returns a list of `Article` models, ordered by `published_at` descending.

## Step 2: Merge Signals into Trend Discovery (Step 2 of Pipeline)

1. Rename the current `frontend/src/app/admin/page.tsx` (which acts as the "Research" page) to "Trend Discovery".

1. In `backend/routers/admin.py`, update the `GET /topics` endpoint. When fetching `status=pending` topics, perform a left join or subquery to include the latest `SignalRecommendation` for that topic.

1. The `TopicOut` schema should include `velocity_score`, `acceleration_score`, and `signal_rationale`.

1. In the frontend `page.tsx` table, replace the generic `Urgency` column with the actual `Velocity` and `Acceleration` metrics from the signal data.

1. If a topic has a pending signal, show the `signal_rationale` inline as the reason *why* this topic is trending.

1. The admin should be able to click "Approve" directly from this table, which approves the topic *and* accepts the signal's suggested adoption state simultaneously.

## Step 3: Centralize Industry Analysis (Step 3 of Pipeline)

1. Create a new page at `frontend/src/app/admin/analysis/page.tsx`.

1. This page fetches `GET /api/admin/topics?status=approved`.

1. Instead of burying the industry positioning inside the individual `TopicEditor`, render a master table or grid where admins can see the `industry_positions` for all approved topics at once.

1. Provide inline edit capability for the `adoption_state` and `urgency_score` per industry.

## Step 4: Update Admin Navigation

1. In `frontend/src/app/admin/layout.tsx`, update the sidebar navigation to reflect the strict 4-step flow:
  - **1. Collection:** `/admin/research` (Raw Articles)
  - **2. Trending:** `/admin` (Topic Discovery & Signals)
  - **3. Analysis:** `/admin/analysis` (Industry Positioning)
  - **4. Publishing:** `/admin/newsletter` (Radar & Dispatch)

1. Remove the standalone `/admin/signals` link from the sidebar, as that data is now merged into Step 2.

## Eng Review Findings (from GStack autoplan)

These findings must be addressed during implementation:

1. **Transaction safety on topic approval.** The `POST /api/admin/topics/{id}/approve` endpoint must wrap both the `Topic.status` update and the `SignalRecommendation.status` update in a single database transaction. If either fails, both must roll back.

2. **Signal deduplication in the JOIN.** When joining `SignalRecommendation` onto the topics list, filter for the *latest* pending signal per topic (`ORDER BY created_at DESC LIMIT 1`). The existing `signal_service.py` prevents duplicates, but the query must be defensive.

3. **Pagination on Raw Research.** The `GET /api/admin/articles` endpoint must implement `limit`/`offset` pagination from day one. Do not attempt to return all raw articles at once.

4. **Null-safe velocity display.** If the signal scorer has not run, `velocity_score` and `acceleration_score` will be `null`. The frontend must render a dash or "Pending" instead of `0` or a blank cell.

5. **Industry Analysis grid layout.** A standard HTML table with 6+ industry columns will be cramped. Use a CSS Grid with sticky headers, or a card-per-topic layout with inline dropdowns for adoption state.

6. **Signal rationale truncation.** AI-generated rationale text can be long. Truncate to 2 lines with a "Read more" expander or collapsible sub-row beneath the main topic row.

## Validation

- The `Article` model should be queryable directly via the new admin endpoint with pagination.

- Approving a topic in the Trend Discovery page should correctly update both the `Topic` status and the associated `SignalRecommendation` status in a single transaction.

- The sidebar should clearly read as a 1-2-3-4 pipeline.

- Velocity/acceleration columns must handle null values gracefully.

- Industry Analysis page must be usable with 10+ topics across 6 industries without horizontal scrolling.


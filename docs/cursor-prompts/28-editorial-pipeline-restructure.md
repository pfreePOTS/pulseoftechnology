# Refactor Admin Pipeline: 4-Step Editorial Flow

## Context
The current admin interface blurs the lines between raw article ingestion, topic curation, and signal intelligence. The user expects a strict 4-step editorial pipeline:
1. **Collection (Research):** Raw articles from RSS feeds.
2. **Trending (Signals/Discovery):** AI-clustered topics with velocity/acceleration metrics.
3. **Analysis (Positioning):** Industry-specific risk and adoption state adjustments.
4. **Publishing (Radar/Newsletter):** Final review and dispatch.

Currently, "Research" shows topics instead of articles, and "Signals" is a separate page that requires admins to check velocity disconnected from the curation approval step.

## Objective
Refactor the admin UI and backend endpoints to explicitly match this 4-step flow.

## Step 1: Create "Raw Research" View (Step 1 of Pipeline)
1. Create a new page at `frontend/src/app/admin/research/page.tsx`.
2. This page should fetch from a new endpoint `GET /api/admin/articles?status=raw,processed`.
3. Display a simple data table of the raw firehose: `Source`, `Title`, `Published Date`, and `Status` (Raw/Processed).
4. **Do not** include topic clustering here. This is purely to monitor the ingestion engine's output.
5. In `backend/routers/admin.py`, add the `GET /articles` endpoint that returns a list of `Article` models, ordered by `published_at` descending.

## Step 2: Merge Signals into Trend Discovery (Step 2 of Pipeline)
1. Rename the current `frontend/src/app/admin/page.tsx` (which acts as the "Research" page) to "Trend Discovery".
2. In `backend/routers/admin.py`, update the `GET /topics` endpoint. When fetching `status=pending` topics, perform a left join or subquery to include the latest `SignalRecommendation` for that topic.
3. The `TopicOut` schema should include `velocity_score`, `acceleration_score`, and `signal_rationale`.
4. In the frontend `page.tsx` table, replace the generic `Urgency` column with the actual `Velocity` and `Acceleration` metrics from the signal data.
5. If a topic has a pending signal, show the `signal_rationale` inline as the reason *why* this topic is trending.
6. The admin should be able to click "Approve" directly from this table, which approves the topic *and* accepts the signal's suggested adoption state simultaneously.

## Step 3: Centralize Industry Analysis (Step 3 of Pipeline)
1. Create a new page at `frontend/src/app/admin/analysis/page.tsx`.
2. This page fetches `GET /api/admin/topics?status=approved`.
3. Instead of burying the industry positioning inside the individual `TopicEditor`, render a master table or grid where admins can see the `industry_positions` for all approved topics at once.
4. Provide inline edit capability for the `adoption_state` and `urgency_score` per industry.

## Step 4: Update Admin Navigation
1. In `frontend/src/app/admin/layout.tsx`, update the sidebar navigation to reflect the strict 4-step flow:
   - **1. Collection:** `/admin/research` (Raw Articles)
   - **2. Trending:** `/admin` (Topic Discovery & Signals)
   - **3. Analysis:** `/admin/analysis` (Industry Positioning)
   - **4. Publishing:** `/admin/newsletter` (Radar & Dispatch)
2. Remove the standalone `/admin/signals` link from the sidebar, as that data is now merged into Step 2.

## Validation
- The `Article` model should be queryable directly via the new admin endpoint.
- Approving a topic in the Trend Discovery page should correctly update both the `Topic` status and the associated `SignalRecommendation` status.
- The sidebar should clearly read as a 1-2-3-4 pipeline.

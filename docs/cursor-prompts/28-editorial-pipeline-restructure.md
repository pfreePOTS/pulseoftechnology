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

## Design & Eng Review Findings (from GStack autoplan & design-review)

These findings must be addressed during implementation:

1. **Transaction safety on topic approval.** The `POST /api/admin/topics/{id}/approve` endpoint must wrap both the `Topic.status` update and the `SignalRecommendation.status` update in a single database transaction. If either fails, both must roll back.

2. **Signal deduplication in the JOIN.** When joining `SignalRecommendation` onto the topics list, filter for the *latest* pending signal per topic (`ORDER BY created_at DESC LIMIT 1`). The existing `signal_service.py` prevents duplicates, but the query must be defensive.

3. **Pagination on Raw Research.** The `GET /api/admin/articles` endpoint must implement `limit`/`offset` pagination from day one. Do not attempt to return all raw articles at once.

4. **Null-safe velocity display.** If the signal scorer has not run, `velocity_score` and `acceleration_score` will be `null`. The frontend must render a dash or "Pending" instead of `0` or a blank cell.

5. **Industry Analysis grid layout.** Do not use nested accordions. Rebuild this as a dense, spreadsheet-like data grid (CSS Grid). Rows are Topics, Columns are Industries. Admins should be able to quickly tab through and type numbers (1-10) for Impact/Risk. Persona impacts must be separated from this view into their own distinct sub-tab or modal.

6. **Signal rationale truncation.** AI-generated rationale text can be long. Truncate to 2 lines with a "Read more" expander or collapsible sub-row beneath the main topic row.

7. **Collection View Layout.** The raw research view MUST be a dense, high-throughput data table (like TweetDeck or a Bloomberg terminal). Do not reuse the heavy rounded cards from the Signals tab.

8. **Trend Discovery Split-Pane.** Do not use the current "accordion within accordion" design. Build Trend Discovery as a master-detail split view: left pane is a sortable list of Topics with inline sparklines for velocity; clicking a topic opens a right-side drawer showing the AI rationale and supporting articles.

9. **Publishing View Separation.** In `WorkbenchPreviewPublishTab`, redesign the layout so the top half is "Publish to Radar" and the bottom half is "Newsletter Preview". Move the Role/Industry/Domain filters in `NewsletterSandboxPanel` from the left rail to a top horizontal control bar so the preview iframe can take full width. Make the preview auto-refresh on filter change.

10. **Public Radar Interactions.** In `RadarChart.tsx`, add `onClick` state to the stars (hover is insufficient for mobile). Clicking a star should lock the side panel open. Add default summary content to the side panel for when no star is selected. Add a "Subscribe to alerts for [Topic]" CTA deep-link in the tooltip. Fix the Subscribe Wizard domains step so "None selected" defaults to "All" visually.

## Validation

- The `Article` model should be queryable directly via the new admin endpoint with pagination.

- Approving a topic in the Trend Discovery page should correctly update both the `Topic` status and the associated `SignalRecommendation` status in a single transaction.

- The sidebar should clearly read as a 1-2-3-4 pipeline.

- Velocity/acceleration columns must handle null values gracefully.

- Industry Analysis page must be usable with 10+ topics across 6 industries without horizontal scrolling.


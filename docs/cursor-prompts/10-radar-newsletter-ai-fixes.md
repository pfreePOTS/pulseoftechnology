# Prompt 10: Radar Wiring, Newsletter Redesign, and AI Pipeline Activation

This prompt addresses several key areas to bring the Pulse of Technology platform to life: wiring the Radar to show all topics by default, redesigning the newsletter template to match the reference style, fixing the simulator, updating the seed script, and activating the full AI pipeline.

## 1. Radar Chart Wiring (Show All Topics by Default)

**Context:** Currently, the `RadarSection.tsx` requires the user to select a single topic from a dropdown before anything is displayed on the radar. The goal is to show all approved topics simultaneously across all industries by default, and use the dropdowns/filters to narrow down the view.

**Instructions for Cursor:**
1.  **Modify `frontend/src/components/RadarSection.tsx`**:
    *   Change the default state to show *all* topics if no specific filter is applied.
    *   Replace the single "Choose Topic" dropdown with two filters: "Filter by Industry" and "Filter by Domain".
    *   When no filters are selected, pass all `topics` to the `RadarChart` component.
    *   When an Industry is selected, filter the topics to only show points relevant to that industry (using `industry_positions`).
    *   When a Domain is selected, filter the topics to only show topics from that domain.
2.  **Modify `frontend/src/components/RadarChart.tsx`**:
    *   Ensure `buildPlotPoints` correctly handles the case where multiple topics and industries are displayed simultaneously.
    *   Update the hover tooltip to show the AI rationale for the positioning (if available in the data model) or at least ensure the tooltip clearly identifies the Topic Name, Domain, Industry (if filtered), Urgency, and Adoption State.
    *   Add a visual distinction (e.g., different shapes or just rely on the existing color coding) if multiple industries are shown for the same topic.

## 2. Newsletter Template Redesign & Simulator Fix

**Context:** The current email template in `backend/services/email_service.py` is a basic dark-mode layout. We need to redesign it to match the clean, professional, light-mode style of the reference newsletter (Forward Future style). The simulator also needs to accurately reflect this new design.

**Instructions for Cursor:**
1.  **Update `backend/services/email_service.py`**:
    *   Rewrite `_EMAIL_TEMPLATE` and `_TOPIC_BLOCK` to match the structure of the provided reference newsletter.
    *   Key design elements to include:
        *   Clean white background with readable dark text (e.g., `#111827`).
        *   A header with the date, a "Read online" link placeholder, and the "PulseOne Radar" branding.
        *   A "Good morning" intro paragraph summarizing the top domains/topics.
        *   A "YOUR DAILY ROLLUP / Top Stories of the Day" section header.
        *   Topic blocks should have clear, bold titles, with the domain as a subtle tag, followed by the summary paragraph.
        *   Remove the heavy dark-mode styling (`#0f172a`, `#1e293b`).
        *   Ensure the HTML is email-client safe (tables for structure where necessary, inline styles).
2.  **Fix Newsletter Simulator (`frontend/src/app/admin/newsletter/page.tsx`)**:
    *   Ensure the iframe renders the new light-mode template correctly.
    *   Verify that selecting different industries and domains in the simulator correctly filters the topics passed to the preview endpoint (`/api/admin/newsletter/preview`).
    *   Ensure the "No approved topics" fallback message in `generate_newsletter_preview` also uses the new light-mode styling so it doesn't flash dark mode.

## 3. Seed Script Enhancement

**Context:** The `seed_topics.py` script populates the 8 core domains but needs to ensure the data is perfectly formatted for the new all-topics radar view.

**Instructions for Cursor:**
1.  **Update `backend/seed_topics.py`**:
    *   Ensure `DEFAULT_POSITIONS` covers all industries defined in `RadarChart.tsx` (`INDUSTRY_COLORS` keys) so that when the radar shows "All Industries", there is a rich set of data points scattered across the radar.
    *   Vary the `urgency_score` and `adoption_state` across different industries for the same topic to demonstrate the radar's capability to show industry-specific positioning.
    *   Run the seed script locally to verify: `docker compose exec backend python -m backend.seed_topics`.

## 4. AI Pipeline Activation & Topic Discovery

**Context:** The AI service currently assigns articles to domains but needs to be smarter about clustering articles into specific, dynamically generated *Topics* (not just the high-level domains).

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py` (`process_raw_articles`)**:
    *   Modify the `_EVALUATE_SYSTEM` prompt. Instead of just returning a `domain`, the AI should suggest a specific `topic_name` (e.g., "AI Video Generation Tools" instead of just "AI").
    *   Implement logic to cluster articles:
        *   When an article is evaluated, take the AI-suggested `topic_name` and `domain`.
        *   Search the database for an existing `Topic` with a similar name (using a simple string match or ILIKE for MVP).
        *   If a matching topic exists, assign the article to it and update the topic's `urgency_score` if the new article is more urgent.
        *   If no matching topic exists, create a *new* `Topic` with `status=pending` (so human curators can review it).
    *   Ensure `ANTHROPIC_API_KEY` is documented as a required environment variable in the `.env` file for this pipeline to run.

## 5. End-to-End Testing Instructions

Once the above changes are implemented, perform the following steps to validate:
1.  Add `ANTHROPIC_API_KEY` to `backend/.env`.
2.  Run the seed script: `docker compose exec backend python -m backend.seed_topics`.
3.  Navigate to the Admin Dashboard -> System Jobs and click "Trigger RSS Ingestion" to fetch real articles.
4.  Check the "Pending Topics" tab in the curation dashboard to see AI-generated topics.
5.  Approve a few topics.
6.  Navigate to the public home page (`/`) and verify the Radar Chart shows all approved topics simultaneously, scattered across the axes.
7.  Navigate to Admin -> Newsletter Sandbox and verify the new light-mode email template renders beautifully.

# Prompt 11: Critical Bug Fixes (Ingestion, Radar Rationale, and Article Linking)

This prompt addresses several critical bugs preventing the platform from functioning end-to-end: the ingestion pipeline not triggering AI processing, missing AI rationales on the radar, and articles not linking to topics.

## 1. Fix Ingestion Pipeline (Missing AI Processing Step)

**Symptom:** Running the "RSS Ingestion" job fetches articles but they never appear in the Curation Dashboard or link to topics. The dashboard says "No pending topics" and the topic editor shows "0 source articles".
**Root Cause:** The `run_all_sources` function in `backend/services/ingestion.py` fetches and saves raw articles but *never calls* the AI service to process them. Thus, articles stay stuck in the `raw` state with no `topic_id`.

**Instructions for Cursor:**
1.  **Update `backend/services/ingestion.py`**:
    *   Import `process_raw_articles` from `..services.ai_service`.
    *   At the end of the `run_all_sources(db: Session)` function, after the loop that fetches all RSS feeds, add a call to `process_raw_articles(db)`.
    *   Log the number of articles successfully processed by the AI.

## 2. Add AI Rationale to Radar Tooltips

**Symptom:** The radar stars show urgency and adoption state, but do not explain *why* the AI placed them there.
**Root Cause:** The `industry_positions` JSON column in the `Topic` model only stores `urgency_score` and `adoption_state`. It does not store the AI's rationale, and the frontend `RadarChart.tsx` tooltip does not display it.

**Instructions for Cursor:**
1.  **Update `backend/seed_topics.py`**:
    *   Update `DEFAULT_POSITIONS` to include a `rationale` string for every industry entry. (e.g., `"rationale": "High regulatory pressure requires immediate action."`).
2.  **Update `backend/services/ai_service.py`**:
    *   In `suggest_industry_positions`, the `_INDUSTRY_POSITIONING_SYSTEM` prompt already asks for a `rationale`. Ensure the returned JSON structure is preserved when saving to the database.
3.  **Update `frontend/src/components/RadarChart.tsx`**:
    *   Update the `IndustryPosition` interface to include `rationale?: string`.
    *   Update the `PlotPoint` interface to include `rationale?: string`.
    *   In `buildPlotPoints`, map the `rationale` from the industry position (or provide a fallback for domain-level points).
    *   In the tooltip rendering section (around line 250), add a new `<text>` element to display the `rationale`. You may need to use a `<foreignObject>` with HTML text wrapping if the rationale is long, or truncate it, as SVG `<text>` does not auto-wrap. A `<foreignObject>` with a `<div>` is highly recommended for the tooltip text to handle the multi-line rationale cleanly.

## 3. Fix Topic Editor Article Linking

**Symptom:** The Topic Editor shows "No articles linked" even when articles exist.
**Root Cause:** This is primarily caused by Bug #1 (articles never getting assigned a `topic_id`). However, we also need to ensure the backend eager-loads or explicitly queries the articles when fetching a topic.

**Instructions for Cursor:**
1.  **Update `backend/routers/admin.py`**:
    *   In the `get_topic` endpoint (`@router.get("/topics/{topic_id}")`), ensure the `articles` relationship is loaded. You can do this by using SQLAlchemy's `joinedload`:
        ```python
        from sqlalchemy.orm import joinedload
        topic = db.query(Topic).options(joinedload(Topic.articles)).filter(Topic.id == topic_id).first()
        ```
    *   Ensure the `ArticleOut` schema in `admin.py` matches the fields needed by the frontend `TopicEditor.tsx`.

## 4. Ensure AI Suggests Topic Names (Follow-up to Prompt 10)

**Symptom:** The radar might look "hardcoded" because all articles are currently just dumping into the broad "AI" or "Security" buckets, rather than creating granular, specific topics.
**Root Cause:** The `process_raw_articles` logic currently groups by `domain`.

**Instructions for Cursor:**
1.  **Verify/Update `backend/services/ai_service.py`**:
    *   Ensure the `_EVALUATE_SYSTEM` prompt requires the AI to return a specific `topic_name` (e.g., "Generative AI Video Tools") in addition to the broad `domain` (e.g., "AI").
    *   In `process_raw_articles`, change the find-or-create logic to search by `Topic.name == topic_name` instead of `Topic.domain == domain`. This ensures the system dynamically creates new, specific stars on the radar based on the news cycle, rather than just updating the 8 hardcoded seed domains.

## End-to-End Testing Instructions

1. Run `docker compose exec backend python -m backend.seed_sources` to ensure RSS feeds exist.
2. Run `docker compose exec backend python -m backend.seed_topics` to update the seed data with rationales.
3. Go to Admin -> System Jobs and click "Run RSS Ingestion Now".
4. Check the backend logs (`docker compose logs -f backend`). You should see it fetching RSS feeds AND then calling Claude to process them.
5. Go to the Curation Dashboard. You should now see dynamically generated topics in the "Trending Topics" tab.
6. Click "Review" on a topic. You should see the source articles listed on the right side.
7. Click "Generate AI Suggestions" for industry positions.
8. Approve the topic.
9. Go to the public Radar page (`/`) and hover over the new star. The tooltip should now display the AI rationale.

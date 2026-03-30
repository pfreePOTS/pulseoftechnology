# Prompt 25: Comprehensive UI and Data Fixes

## Context
During system testing, four specific issues were identified across the frontend and backend:
1. **Signal Intelligence Empty State:** The Signal Scorer runs and generates database records, but the UI shows "No pending signals" because of a query parameter name mismatch between the frontend fetch and the backend route.
2. **Newsletter Missing Article Links:** The email template renders the "What is it" and "Why it matters" AI summaries for each article, but fails to include the actual article title and hyperlink, making it impossible for readers to click through to the source.
3. **Missing Executive Summary Generation:** The `TopicEditor` UI has a text area for "Executive Summary", but it is always empty. There is a backend function `generate_topic_summary` in `ai_service.py`, but no endpoint exposes it and no UI button triggers it.
4. **No Aggregation of Information:** Because the summary generation is not wired up, the Topic Editor lacks any synthesized aggregation of the underlying source articles.

## Instructions for Cursor

### 1. Fix Signal Intelligence Query Parameter
*   **File:** `backend/routers/admin.py`
*   **Fix:** In the `list_signals` endpoint (`GET /signals`), change the query parameter definition from `signal_status: str = Query(default="pending")` to `status: str = Query(default="pending")`.
*   **Reason:** The frontend `SignalsPage` calls `/api/admin/signals?status=pending`, so the backend must accept `status` instead of `signal_status` to correctly filter and return the records.

### 2. Add Article Links to Newsletter Template
*   **File:** `backend/services/email_service.py`
*   **Fix:**
    *   Update the `_ARTICLE_BLOCK` HTML string to include the article title as a clickable link above the "What is it" section.
    *   Add something like: `<p style="margin:0 0 8px;font-size:14px;font-weight:bold;"><a href="{url}" style="color:#4f46e5;text-decoration:none;">{title}</a></p>`
    *   Update the `_build_html` function where it formats `_ARTICLE_BLOCK` to pass in `title=a.title` and `url=a.url`.

### 3 & 4. Wire Up Topic Executive Summary Generation
*   **File 1:** `backend/routers/admin.py`
    *   **Fix:** Add a new POST endpoint: `@router.post("/topics/{topic_id}/generate-summary", response_model=TopicOut)`.
    *   **Logic:** Fetch the topic and its articles. Import and call `generate_topic_summary(topic, topic.articles)` from `..services.ai_service`. Commit the changes to the database and return the updated topic.
*   **File 2:** `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`
    *   **Fix:** Add a "✨ Generate Summary" button next to the "Executive Summary" label (similar to the "Generate AI Suggestions" button for industry positions).
    *   **Logic:** When clicked, show a loading state, call the new `/api/admin/topics/{id}/generate-summary` endpoint, and update the `summary` state with the returned text. This provides the missing "aggregation of information" for the topic.

## End-to-End Testing
1. **Signals:** Go to the Signal Intelligence page and verify that pending signals now load correctly.
2. **Newsletter:** Go to the Newsletter Preview page and verify that every article under a topic now has a clickable title link.
3. **Summary:** Go to the Curation Dashboard, click "Inspect & Promote" on a topic, and click the new "Generate Summary" button. Verify that Claude synthesizes the source articles into a cohesive executive summary and populates the text area.

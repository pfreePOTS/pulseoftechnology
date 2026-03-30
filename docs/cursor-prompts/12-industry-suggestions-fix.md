# Prompt 12: Fix AI Suggestions and Model IDs

This prompt addresses the failure of the "Generate AI Suggestions" button in the Topic Editor and ensures the generated rationales are permanently saved.

## 1. Fix Invalid Anthropic Model IDs

**Symptom:** Clicking "Generate AI Suggestions" immediately fails. The ingestion pipeline (if run) also fails silently to process articles.
**Root Cause:** The `ai_service.py` is using invalid, placeholder model IDs (`claude-haiku-4-5` and `claude-sonnet-4-6`), causing the Anthropic API to reject the requests with a 400 or 404 error, which bubbles up to the frontend as a failure.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Change `HAIKU_MODEL` to `"claude-3-5-haiku-latest"`.
    *   Change `SONNET_MODEL` to `"claude-3-7-sonnet-latest"` (or `"claude-3-5-sonnet-latest"`).
    *   Add error handling for `anthropic.APIError` in `suggest_industry_positions`, `evaluate_article`, and `generate_topic_summary` so that API failures are logged clearly rather than crashing the app or failing silently.

## 2. Save Rationales to the Database

**Symptom:** The AI generates rationales, and they briefly appear in the UI, but they disappear after saving or refreshing because they aren't sent to the backend.
**Root Cause:** The frontend `TopicEditor.tsx` stores rationales in a separate, temporary state (`rationales`) rather than integrating them into the `industryPositions` payload that gets saved.

**Instructions for Cursor:**
1.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Update the `IndustryPosition` interface to include `rationale?: string`.
    *   When `handleSuggest` receives data, merge the `rationale` directly into the `industryPositions` state alongside `urgency_score` and `adoption_state`.
    *   Remove the separate `rationales` state variable entirely.
    *   Update the rendering loop to read the rationale from `pos.rationale` instead of `rationales[industry]`.
    *   Ensure `buildPayload()` includes the `rationale` field when sending data to the backend.
2.  **Update `backend/routers/admin.py`**:
    *   Ensure the `TopicUpdate` schema and `update_topic` endpoint accept the `rationale` inside the `industry_positions` JSON dictionary. (Since it's defined as a `dict`, SQLAlchemy's JSON column will naturally accept it, but verify no Pydantic validation strips it out).

## 3. Improve Suggestion UX

**Symptom:** When the user clicks "Generate AI Suggestions", the sliders jump to new values immediately, overwriting any manual tweaks the user might have made, without a clear "Apply" or "Discard" step.
**Root Cause:** The `handleSuggest` function directly mutates the `industryPositions` state.

**Instructions for Cursor:**
1.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Instead of immediately overwriting `industryPositions`, store the fetched suggestions in a new state variable: `pendingSuggestions`.
    *   When `pendingSuggestions` is not null, display a UI block (e.g., a callout box) showing the suggested values and rationales, with two buttons: "Apply Suggestions" and "Discard".
    *   Only overwrite `industryPositions` when the user clicks "Apply Suggestions".

## End-to-End Testing Instructions

1. Ensure `ANTHROPIC_API_KEY` is set in `backend/.env`.
2. Open a topic in the Curation Dashboard.
3. Click "Generate AI Suggestions". It should now succeed and display the pending suggestions.
4. Click "Apply Suggestions". The sliders should update, and the rationales should be visible below each industry.
5. Click "Save Changes".
6. Refresh the page. The rationales and slider positions should persist, correctly, persist.

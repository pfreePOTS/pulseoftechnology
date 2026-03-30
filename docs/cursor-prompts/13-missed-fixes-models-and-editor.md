# Prompt 13: Missed Fixes (Model IDs and Topic Editor UX)

In the previous round of updates, a few critical instructions were skipped by the AI coder. This prompt enforces those missed changes to ensure the AI pipeline actually runs and the generated rationales are permanently saved to the database.

## 1. Fix Invalid Anthropic Model IDs

**Symptom:** The AI service still fails because the model IDs are invalid placeholders.
**Root Cause:** `HAIKU_MODEL` and `SONNET_MODEL` were not updated in `backend/services/ai_service.py`.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Change `HAIKU_MODEL = "claude-haiku-4-5"` to `HAIKU_MODEL = "claude-3-5-haiku-latest"`
    *   Change `SONNET_MODEL = "claude-sonnet-4-6"` to `SONNET_MODEL = "claude-3-7-sonnet-latest"` (or `claude-3-5-sonnet-latest`).

## 2. Fix Rationale Saving in Topic Editor

**Symptom:** AI-generated rationales appear in the UI but are lost upon saving or refreshing because they are not included in the payload sent to the backend.
**Root Cause:** `TopicEditor.tsx` still uses a separate `rationales` state variable instead of merging the rationale into the `industryPositions` state.

**Instructions for Cursor:**
1.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Update the `IndustryPosition` interface to include `rationale?: string;`.
    *   Delete the `const [rationales, setRationales] = useState<Record<string, string>>({});` state variable entirely.
    *   In `handleSuggest`, when updating `next[industry]`, include `rationale: suggestions[industry].rationale` alongside `urgency_score` and `adoption_state`.
    *   In the rendering loop (around line 420), change `{rationales[industry] && ... {rationales[industry]}}` to `{pos.rationale && ... {pos.rationale}}`.
    *   Ensure `buildPayload()` just sends `industryPositions` as-is, which will now naturally include the `rationale` strings.

## 3. Implement Pending Suggestions UX (Apply/Discard)

**Symptom:** Clicking "Generate AI Suggestions" immediately overwrites the user's current slider positions without confirmation.
**Root Cause:** `handleSuggest` directly mutates `industryPositions`.

**Instructions for Cursor:**
1.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Add a new state variable: `const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, IndustryPosition> | null>(null);`
    *   In `handleSuggest`, instead of calling `setIndustryPositions`, construct the merged suggestions object and call `setPendingSuggestions(mergedSuggestions)`.
    *   In the UI, just below the "Industry Positions" header, add a conditional block:
        ```tsx
        {pendingSuggestions && (
          <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
            <p className="text-sm font-medium text-indigo-300">AI Suggestions Ready</p>
            <p className="mt-1 text-xs text-indigo-400/80">Review the suggested positions below. Apply them to overwrite current settings.</p>
            <div className="mt-3 flex gap-3">
              <button onClick={() => { setIndustryPositions(pendingSuggestions); setPendingSuggestions(null); }} className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">Apply Suggestions</button>
              <button onClick={() => setPendingSuggestions(null)} className="rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600">Discard</button>
            </div>
          </div>
        )}
        ```
    *   Update the rendering loop to display the data from `pendingSuggestions` if it exists, otherwise display `industryPositions`. (e.g. `const displayPositions = pendingSuggestions ?? industryPositions;`).

## End-to-End Testing Instructions
1. Run `docker compose restart backend` to pick up the model ID changes.
2. Go to the Curation Dashboard and open a topic.
3. Click "Generate AI Suggestions". The API call should now succeed.
4. The new Apply/Discard UI should appear. The sliders should preview the new values.
5. Click "Apply Suggestions".
6. Click "Save Changes".
7. Refresh the page. The rationales and new slider positions should persist.

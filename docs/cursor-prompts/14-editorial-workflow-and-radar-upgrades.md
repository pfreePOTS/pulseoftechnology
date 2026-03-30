# Prompt 14: Editorial Workflow, Radar Labels, and Missed AI Fixes

This prompt completes the end-to-end architecture by introducing a true "Sandbox vs. Live" editorial workflow, upgrading the radar UI with a label toggle, unifying the admin preview with the public radar, and applying the missed AI model/rationale fixes from the previous round.

## 1. Missed Fixes: AI Models & Rationale Saving

**Context:** The AI service is still using invalid model IDs, and the generated rationales are not being saved to the database.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Change `HAIKU_MODEL = "claude-haiku-4-5"` to `HAIKU_MODEL = "claude-3-5-haiku-latest"`
    *   Change `SONNET_MODEL = "claude-sonnet-4-6"` to `SONNET_MODEL = "claude-3-7-sonnet-latest"` (or `claude-3-5-sonnet-latest`).
2.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Update the `IndustryPosition` interface to include `rationale?: string;`.
    *   Delete the `const [rationales, setRationales] = useState<Record<string, string>>({});` state variable entirely.
    *   Add a new state: `const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, IndustryPosition> | null>(null);`
    *   In `handleSuggest`, instead of updating `industryPositions` directly, build the new object (including `rationale: suggestions[industry].rationale`) and call `setPendingSuggestions(merged)`.
    *   In the UI, just below the "Industry Positions" header, add an Apply/Discard block if `pendingSuggestions` is not null:
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
    *   Update the rendering loop to use `const displayPositions = pendingSuggestions ?? industryPositions;` and map over `Object.entries(displayPositions)`.
    *   Ensure the rationale display uses `pos.rationale` instead of `rationales[industry]`.
    *   Ensure `buildPayload()` sends `industryPositions` exactly as-is, which now naturally includes the `rationale` strings.

## 2. Editorial Workflow: Sandbox vs. Live Radar

**Context:** Currently, approving a topic immediately puts it on the public radar. We need a 3-state flow: Pending (AI Discovered) → Approved (Sandbox/Vetted) → Published (Live on Public Radar).

**Instructions for Cursor:**
1.  **Update `backend/models/topic.py`**:
    *   Add `is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")` to the `Topic` class.
2.  **Update `backend/routers/admin.py`**:
    *   Add `is_published: bool = False` to `TopicOut` and `TopicDetail` schemas.
    *   Add two new POST endpoints: `/topics/{topic_id}/publish` (sets `is_published = True`) and `/topics/{topic_id}/unpublish` (sets `is_published = False`). Both should return the updated `TopicOut`.
3.  **Update `backend/routers/public.py`**:
    *   In `get_published_topics`, change the filter from `Topic.status == TopicStatus.approved` to `Topic.is_published == True`.
4.  **Update `backend/seed_topics.py`**:
    *   When creating or updating topics in `CORE_TOPICS`, set `is_published=True` so the seed data populates the live radar immediately.
5.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   Add `is_published: boolean;` to the `TopicDetail` interface.
    *   Add state `const [isPublished, setIsPublished] = useState(topic.is_published);`
    *   Add `handleTogglePublish` function that calls the new publish/unpublish endpoints and updates the `isPublished` state.
    *   In the UI, next to the "Approve & Publish" (which should be renamed to just "Approve Topic"), add a toggle switch or button for "Live on Public Radar" that is only visible if `isApproved` is true.

## 3. Radar UI Upgrades: Unifying Preview & Adding Label Toggle

**Context:** The admin radar preview page uses a hardcoded single-topic dropdown instead of the new `RadarSection` filters. We also need a toggle to show topic names directly on the radar canvas.

**Instructions for Cursor:**
1.  **Update `frontend/src/components/RadarChart.tsx`**:
    *   Add `showLabels?: boolean` to the props interface.
    *   In the SVG rendering loop for `positions`, add a `<text>` element right after the `<path>` star if `showLabels` is true.
    *   Example: `<text x={pt.x + 12} y={pt.y + 4} fontSize="10" fill={pt.color} fontWeight="600" style={{ pointerEvents: "none" }}>{pt.topic.name}</text>`
2.  **Update `frontend/src/components/RadarSection.tsx`**:
    *   Add state `const [showLabels, setShowLabels] = useState(false);`
    *   In the Control Bar (next to the Clear Filters button), add a simple checkbox or toggle switch labeled "Show topic names".
    *   Pass `showLabels={showLabels}` down to `<RadarChart />`.
3.  **Update `frontend/src/app/admin/radar-preview/page.tsx`**:
    *   Delete the custom `<select>` dropdown and the custom rendering logic.
    *   Simply render `<RadarSection topics={topics} />` inside the page.
    *   Because `RadarSection` now defaults to showing all topics and includes the Industry/Domain filters, the admin preview will perfectly mirror the public radar's capabilities, allowing you to see the "All Topics" view and filter by industry exactly as requested.

## End-to-End Testing
1. Run `docker compose exec backend alembic revision --autogenerate -m "add is_published to topic"` and `alembic upgrade head` (or if using SQLite without migrations, just recreate the db or manually add the column). *Note: if you don't have alembic set up, you may need to drop and recreate the topics table since a new column was added.*
2. Run `docker compose exec backend python -m backend.seed_topics` to seed the published topics.
3. Visit the public home page. The radar should be fully populated with stars.
4. Toggle "Show topic names" to see the labels appear next to the stars.
5. Visit the Admin Radar Preview. It should now look identical to the public radar control bar, showing all approved topics by default.

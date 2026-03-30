# Prompt 17: Newsletter Sandbox Role Filter and Article Tag Filtering

This prompt adds a "Role" dimension to the Newsletter Simulation Sandbox and wires the newsletter generation logic to filter articles based on the simulated role's tags.

## 1. Update Preview API to Accept Role

**Context:** The preview endpoint currently accepts `industry` and `domains`. We need it to also accept a `role_id` so it can simulate a specific persona (e.g., CEO, CTO) and fetch their tags.

**Instructions for Cursor:**
1.  **Update `backend/routers/admin.py`**:
    *   In `newsletter_preview`, add a new query parameter: `role_id: int | None = Query(default=None)`.
    *   Pass `role_id` down to `generate_newsletter_preview`.
2.  **Update `backend/services/email_service.py`**:
    *   Update the signature of `generate_newsletter_preview` to accept `role_id: int | None = None`.
    *   Import the `Role` model if not already imported.
    *   If `role_id` is provided, fetch the `Role` from the database: `role = db.query(Role).filter(Role.id == role_id).first()`.
    *   When creating the `dummy` Subscriber, set `role_id=role_id`. Also, dynamically attach the role object to the dummy so `_build_html` can access its tags: `dummy.role = role`.

## 2. Implement Role-Based Article Filtering

**Context:** The newsletter must filter articles under each topic so that a subscriber only sees articles matching their role's tags.

**Instructions for Cursor:**
1.  **Update `backend/services/email_service.py`**:
    *   In `_build_html`, when iterating through `topic.articles`, check if `subscriber.role` exists and has `tags`.
    *   **Filtering Logic**: 
        *   If the subscriber has role tags, filter the `topic.articles`: an article is included *only if* its `tags` list intersects with the `subscriber.role.tags` list (case-insensitive comparison).
        *   If the subscriber has NO role tags (or no role), fall back to showing the top 3 most recent articles for the topic.
        *   Sort the matching articles by `urgency_score` descending (if available) or `published_at` descending, and take the top 3.
    *   **Topic Skipping**: If filtering by role tags results in 0 articles for a given topic, skip rendering that `_TOPIC_BLOCK` entirely for this subscriber.
    *   Ensure the `{articles_html}` is injected into the topic block as implemented in Prompt 16.

## 3. Update Sandbox UI with Role Filter

**Context:** The frontend sandbox needs a dropdown to select a Role, which it then passes to the preview API.

**Instructions for Cursor:**
1.  **Update `frontend/src/app/admin/newsletter/page.tsx`**:
    *   Add an interface for `Role` (id, name).
    *   Add state for roles: `const [roles, setRoles] = useState<Role[]>([])`.
    *   Add state for selected role: `const [selectedRoleId, setSelectedRoleId] = useState<number | "">("")`.
    *   Create a `loadRoles` function that fetches from `/api/admin/roles` (the endpoint created in Prompt 15) and call it in the `useEffect` on mount.
    *   In the `loadPreview` function, append `role_id` to the `URLSearchParams` if `selectedRoleId` is not empty.
    *   Add a new UI section in the sidebar above "Industry" called "Role Persona". Render a `<select>` dropdown with a default "No Role (All Articles)" option, followed by the fetched roles.
    *   Update the `simDesc` variable to include the selected role name (e.g., `Simulating: CEO · Technology · AI`).

## End-to-End Testing
1. Ensure Prompt 15 (Roles) and Prompt 16 (Article Rendering) have been applied and migrations run.
2. Create at least one Role in the Admin -> Roles UI (e.g., "CEO" with tags "Strategy", "Risk").
3. Go to the Newsletter Simulation Sandbox.
4. Select the "CEO" role from the new dropdown and click "Run Simulation".
5. Verify that the newsletter only shows topics that contain articles matching the CEO's tags, and that only those specific articles are rendered under the topic.

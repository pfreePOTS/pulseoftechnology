# Prompt 19: Content Library and Newsletter Promos

This prompt builds a first-party Content Library in the admin area, allowing PulseOne to upload owned articles, landing pages, and YouTube videos, tag them, and have them automatically promoted in the daily newsletter based on the subscriber's role.

## 1. Data Model: Content Library

**Context:** We need a new database table to store owned assets.

**Instructions for Cursor:**
1.  **Create `backend/models/content.py`**:
    *   Create a `ContentItem` SQLAlchemy model.
    *   Fields: `id` (UUID), `title` (String), `url` (String), `type` (String: 'article', 'video', 'landing_page'), `summary` (Text, optional), `tags` (JSON, default `[]`), `is_active` (Boolean, default `True`), `created_at` (DateTime).
2.  **Update `backend/models/__init__.py`**:
    *   Import `ContentItem` so it's registered with the Base metadata.
3.  **Update `backend/routers/admin.py`**:
    *   Add full CRUD endpoints for `/api/admin/content`: `GET`, `POST`, `PUT /{id}`, `DELETE /{id}`.
    *   Create Pydantic schemas: `ContentItemCreate`, `ContentItemUpdate`, `ContentItemOut`.

## 2. Admin UI: Content Library Manager

**Context:** The admin needs a UI to manage these links and tag them.

**Instructions for Cursor:**
1.  **Create `frontend/src/app/admin/library/page.tsx`**:
    *   Build a page similar to the Sources or Roles page.
    *   Include a table listing all `ContentItem` records.
    *   Include an "Add Content" modal/form with fields: Title, URL, Type (dropdown), Summary (textarea), and Tags (comma-separated string input that converts to an array).
    *   Include Edit/Delete functionality.
2.  **Update `frontend/src/app/admin/layout.tsx`**:
    *   Add "Content Library" to the admin sidebar navigation, linking to `/admin/library`.

## 3. Newsletter Integration: Promoted Content Block

**Context:** The newsletter needs to pull active content items that match the subscriber's role tags and display them in a dedicated section at the bottom.

**Instructions for Cursor:**
1.  **Update `backend/services/email_service.py`**:
    *   Add a new HTML constant `_PROMO_SECTION` and `_PROMO_ITEM_BLOCK`.
    *   The `_PROMO_SECTION` should have a header like "FROM PULSEONE" or "RECOMMENDED RESOURCES" with a distinct visual style (e.g., a slightly different background or border).
    *   The `_PROMO_ITEM_BLOCK` should render the `title` (linked to `url`), `type` badge (e.g., "[Video]", "[Article]"), and the `summary`.
    *   Update `_build_html` signature to accept `promoted_content: list[ContentItem]`.
    *   If `promoted_content` is not empty, render the `_PROMO_SECTION` and inject it into the `_EMAIL_TEMPLATE` just above the footer.
    *   Update `_EMAIL_TEMPLATE` to include a `{promo_html}` placeholder.
2.  **Update Newsletter Generation Logic**:
    *   In `run_daily_newsletter` and `generate_newsletter_preview` (in `backend/services/email_service.py` or wherever the preview is assembled), query the `ContentItem` table for `is_active=True`.
    *   **Filtering Logic**: If the subscriber has a `role` with `tags`, filter the `ContentItem` list so that at least one tag matches. If the subscriber has no role/tags, include all active content items (or a random selection of top 3).
    *   Limit the final promoted content list to a maximum of 3 items per newsletter to avoid clutter.
    *   Pass this filtered list to `_build_html`.

## End-to-End Testing
1. Run database migrations to create the `content_items` table.
2. Open the Admin UI, navigate to "Content Library", and add a test YouTube video and a test landing page. Assign them tags like "AI" or "Security".
3. Go to the Newsletter Simulation Sandbox.
4. Run a simulation for a persona (e.g., CEO) whose tags match the content you just added.
5. Verify the new "FROM PULSEONE" section appears at the bottom of the newsletter with the correct links and summaries.

# PulseOne Unified Content Admin Plan

## 1. The Problem
Currently, the `pulseoftechnology` admin area features a basic `/admin/library` page designed only to inject external links (articles, videos) into the automated newsletter. It stores `title`, `url`, `type`, `summary`, `image_url`, and `tags`.

With the new website architecture—specifically the dynamic `/recommended-path` page—PulseOne needs to host its own rich-text content (Blog Posts, Case Studies, Service Pages). Maintaining a separate WordPress or Webflow CMS alongside the Pulse of Technology platform creates fragmented data and prevents the Recommended Path AI from easily accessing and recommending PulseOne's own services.

## 2. The Solution: A Unified Content Hub
We will upgrade the existing `ContentItem` model and `/admin/library` interface to support full website content authoring, creating a single source of truth for both the newsletter and the corporate website.

---

## 3. Database Architecture Upgrades

The `ContentItem` model (`backend/models/content.py`) requires an Alembic migration to add the following fields:

| Field | Type | Purpose |
|---|---|---|
| `slug` | `String(255)` (Unique, Index) | SEO-friendly URL path (e.g., `the-future-of-ai-in-healthcare`) |
| `body_markdown` | `Text` | The full rich-text content of the post or page |
| `body_html` | `Text` | The compiled HTML for fast frontend rendering |
| `author_name` | `String(120)` | The person or team who wrote the piece |
| `publish_date` | `DateTime` | When the post goes live |

**Expanded Content Types:**
The `CONTENT_TYPES` enum must be expanded from `{"article", "video", "landing_page"}` to:
`{"external_link", "blog_post", "case_study", "service_page", "whitepaper", "webinar"}`

---

## 4. Backend API Upgrades

**Admin Endpoints (`backend/routers/admin.py`):**
- Update `POST /content` and `PUT /content/{id}` to accept the new fields.
- Add an auto-slug generation utility (e.g., converting "The Future of AI" to `the-future-of-ai`).
- If `body_markdown` is provided, automatically compile it to `body_html` using a library like `markdown2` or `mistune` before saving.

**Public Endpoints (`backend/routers/public.py`):**
- Create `GET /api/content/{slug}` to retrieve a single published post by its slug for frontend rendering.
- Create `GET /api/content` with filtering by `type` and `tags` to support blog index pages and the Recommended Path grid.

---

## 5. Frontend Admin UI Upgrades

The current `/admin/library/page.tsx` will be renamed to `/admin/content` and rebuilt as a comprehensive Content Hub with three main views:

### A. The Dashboard (List View)
- A data table showing all content items.
- Filters for `Type` (Blog Post vs. External Link) and `Status` (Draft vs. Published).
- Quick actions to Edit, Preview, or Delete.

### B. The Editor (Form View)
- A split-pane or tabbed editor.
- **Metadata Tab:** Title, Slug, Author, Publish Date, Tags (crucial for Recommended Path matching), Hero Image URL.
- **Content Tab:** A Markdown editor (e.g., `react-simplemde-editor` or `uiw/react-md-editor`) for writing the `body_markdown`.

### C. The Taxonomy Manager
- A dedicated section to manage the standardized Tags used across the system.
- Ensures that tags applied to Content Items perfectly match the `Industry` and `Challenge` options in the homepage Executive Intake Form.

---

## 6. Public Frontend Integration

To display the authored content on the live website, we will create dynamic Next.js routes:

**`frontend/src/app/insights/[slug]/page.tsx`**
- A Server Component that fetches `GET /api/content/{slug}`.
- Renders the `title`, `author_name`, `publish_date`, and injects the `body_html` using `dangerouslySetInnerHTML`.
- Includes the `GlobalHeader` and `GlobalFooter`.

**`frontend/src/app/services/[slug]/page.tsx`**
- Identical architecture, but styled specifically for Service Pages rather than editorial blog posts.

---

## 7. Execution Plan (Cursor Prompt 40)

This entire upgrade can be executed as **Prompt 40**, run immediately after the Recommended Path (Prompt 39) is complete.

**Prompt 40 Instructions:**
1. Generate Alembic migration for `ContentItem` (slug, body, author, date).
2. Update FastAPI admin/public routers to handle the new fields and Markdown-to-HTML conversion.
3. Replace `/admin/library` with `/admin/content` featuring a Markdown editor component.
4. Build the dynamic `app/insights/[slug]/page.tsx` route to render the posts.

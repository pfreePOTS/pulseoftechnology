# Prompt 15: Role Profiles, Article Summaries, and Role-Based Filtering

This prompt introduces a new Role Profile system to tailor content for specific C-level personas (CEO, CFO, CTO, etc.), extracts article-level "What is it / Why it matters" summaries during AI ingestion, and injects the actual curated articles into the newsletter based on role tags.

## 1. Data Model Updates (Roles & Articles)

**Context:** We need a new `Role` model to define personas and their interests via tags. We also need to store article-level summaries and tags.

**Instructions for Cursor:**
1.  **Create `backend/models/role.py`**:
    *   Define a `Role` SQLAlchemy model: `id` (Integer), `name` (String, unique, e.g., "CEO"), `tags` (JSON, list of strings, e.g., `["Strategy", "Risk", "M&A"]`).
2.  **Update `backend/models/subscriber.py`**:
    *   Add `role_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("roles.id"), nullable=True)` to the `Subscriber` model.
    *   Add relationship: `role = relationship("Role")`.
3.  **Update `backend/models/article.py`**:
    *   Add `what_is_it: Mapped[str | None] = mapped_column(Text, nullable=True)`
    *   Add `why_it_matters: Mapped[str | None] = mapped_column(Text, nullable=True)`
    *   Add `tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)`
4.  **Database Migration**:
    *   Add instructions in a comment to run `alembic revision --autogenerate -m "add roles and article summaries"` and `alembic upgrade head`.

## 2. AI Pipeline Updates (Article Extraction)

**Context:** The AI needs to extract the summary, impact, and tags for *each article* during the initial evaluation phase.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Modify `_EVALUATE_SYSTEM` JSON schema to include:
        ```json
        {
          "relevant": true | false,
          "domain": "<string>",
          "urgency_score": <integer 1-10>,
          "suggested_topic_name": "<specific 3-5 word trend>",
          "what_is_it": "<1-2 sentence summary of the article>",
          "why_it_matters": "<1-2 sentence explanation of the business impact>",
          "tags": ["<tag1>", "<tag2>", "<tag3>"]
        }
        ```
    *   In `evaluate_article`, extract these new fields from the parsed JSON and return them in the dictionary.
    *   In `process_raw_articles`, when creating or updating the `Article` object, save `what_is_it`, `why_it_matters`, and `tags` to the database.

## 3. Admin UI: Role Manager & Article View

**Context:** Admins need a place to define Roles and their tags, and the Topic Editor needs to show the actual articles with their summaries.

**Instructions for Cursor:**
1.  **Update `backend/routers/admin.py`**:
    *   Add CRUD endpoints for Roles (`/roles` GET, POST, PUT, DELETE).
    *   Update `ArticleOut` schema to include `what_is_it`, `why_it_matters`, `tags`, and `url`.
2.  **Create `frontend/src/app/admin/roles/page.tsx`**:
    *   Build a simple CRUD interface for Roles. It should list existing roles and allow creating/editing a role's `name` and comma-separated `tags`.
    *   Add a link to this new Roles page in the Admin layout/navigation sidebar.
3.  **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`**:
    *   In the "Source Articles" sidebar panel, instead of just showing the count, map over `topic.articles`.
    *   For each article, render its `title` (as a link to `url`), `what_is_it`, `why_it_matters`, and a visual list of its `tags`.

## 4. Newsletter Template & Role-Based Filtering

**Context:** The newsletter must include the actual articles under each topic, filtered by the subscriber's role tags.

**Instructions for Cursor:**
1.  **Update `backend/services/email_service.py`**:
    *   Update `_TOPIC_BLOCK` HTML to include a placeholder for articles: `{articles_html}`.
    *   Create a new `_ARTICLE_BLOCK` HTML template:
        ```html
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="{url}" style="font-size: 15px; font-weight: bold; color: #2563eb; text-decoration: none;">{title}</a>
          <p style="margin: 8px 0 4px; font-size: 13px; color: #374151;"><strong>What is it:</strong> {what_is_it}</p>
          <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Why it matters:</strong> {why_it_matters}</p>
        </div>
        ```
    *   In `send_daily_newsletter` (or `generate_newsletter_preview`), retrieve the `Subscriber`'s role tags (if they have a role).
    *   When looping through `topics`, filter each topic's `articles`:
        *   If the subscriber has role tags, only include articles where at least one article tag matches a role tag (case-insensitive intersection).
        *   If no articles match, you can either skip the topic or show the top 1-2 highest urgency articles as a fallback.
    *   Generate the `{articles_html}` string by formatting `_ARTICLE_BLOCK` for each filtered article, and inject it into `_TOPIC_BLOCK`.

## End-to-End Testing
1. Run database migrations to add the Role table and Article columns.
2. Go to Admin -> Roles and create a "CEO" role with tags: `["Strategy", "Risk", "M&A"]`.
3. Run the ingestion pipeline so the AI populates `what_is_it`, `why_it_matters`, and `tags` for new articles.
4. Check the Topic Editor to verify articles and summaries are visible in the sidebar.
5. Assign a subscriber to the "CEO" role (via DB or Admin UI if added).
6. Run the newsletter preview/send and verify that the email now includes the specific articles, filtered by the CEO's tags, complete with titles, links, and summaries.

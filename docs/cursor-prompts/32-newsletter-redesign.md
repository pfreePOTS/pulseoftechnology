# 32. Newsletter Redesign (Forward Future Style)

## Context
The current Pulse of Technology newsletter is functional but visually flat. We need to redesign the HTML email template to match the engaging, section-driven layout of top-tier newsletters (like Forward Future), while strictly adhering to the new PulseOne brand identity (`DESIGN.md`).

## Core Structural Changes

The new newsletter should follow this exact vertical flow:

1. **Utility Header:** Date | Read Online link | Social Icons (X, LinkedIn)
2. **Brand Banner:** PulseOne Logo + "Technology Radar Briefing"
3. **Personalized Intro:** "Good morning, [Name]." + 2 sentences summarizing the top signals for their industry/role.
4. **THE RADAR (Top Stories):** 3-4 quick-hit summaries of the most urgent topics, presented as a single block with a shared hero image (or stylized graphic).
5. **DEEP DIVES (Topic Sections):** Each major topic gets its own section:
   - Category Label (e.g., "AI ADOPTION" in red/teal uppercase)
   - Topic Name (H2)
   - "Where you stand:" [Posture label, e.g., "Get ahead of it"]
   - 2-paragraph summary (AI-generated summary + Persona Impact)
   - "Read the full articles →" links below.
6. **PULSEONE INSIGHT (Promo Content):** The current `promoted_content` block, restyled to look like an editorial feature or video embed.
7. **SURVEY:** "What did you think of today's briefing?" with 3 simple links: 
   - [🟢 Highly Relevant]
   - [🟡 Somewhat Relevant]
   - [🔴 Not Relevant]
8. **Footer:** Unsubscribe, manage preferences, PulseOne contact info.

## Implementation Steps

### 1. Schema & API Updates (Content & Survey)
- **File:** `backend/models/content.py`
- **Action:** Add an `image_url` (String, nullable) field to `ContentItem` so promo blocks can have hero images or video thumbnails.
- **File:** `backend/routers/admin.py`
- **Action:** Update `ContentItemCreate`, `ContentItemUpdate`, and `ContentItemOut` schemas to include `image_url`.
- **File:** `backend/routers/public.py`
- **Action:** Create a new lightweight `GET /api/survey` endpoint that accepts `?subscriber_id=X&score=Y`, logs the click (can just be a print/logger for now), and returns a simple HTML "Thank you for your feedback" page.

### 2. Email Template Rewrite
- **File:** `backend/services/email_service.py`
- **Action:** Completely rewrite `_EMAIL_TEMPLATE`, `_TOPIC_BLOCK`, `_ARTICLE_BLOCK`, and `_PROMO_ITEM_BLOCK`.
- **Design Constraints:**
  - **Fonts:** Since email clients strip web fonts, use `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;` for everything.
  - **Colors:** Use `#E91D24` (PulseOne Red) for primary links/buttons, `#019E7C` (Teal) for category labels, `#FFFFFF` background, `#111827` text.
  - **Layout:** Use `max-width: 600px` centered tables. Use generous padding (`24px` or `32px` between sections).
  - **Separators:** Use clean horizontal rules (`border-top: 1px solid #E5E7EB;`) between major sections.

### 3. Topic Block Refactoring
- **File:** `backend/services/email_service.py`
- **Action:** Update `_build_html` logic.
  - Separate the highest urgency topic (or top 3) into a "Top Stories" block at the top.
  - Render the remaining topics as "Deep Dives".
  - In the Deep Dive block, inject the subscriber's persona impact directly into the narrative text, rather than keeping it as a separate "Why it matters" sub-bullet. Make it read like an executive summary.

### 4. Survey Injection
- **File:** `backend/services/email_service.py`
- **Action:** Add the survey block at the bottom of `_EMAIL_TEMPLATE`.
  - Use `a` tags styled as simple buttons or text links for the 3 options.
  - The `href` should point to the new `/api/survey` endpoint, injecting the subscriber's ID or email.

## Validation
- [ ] The newsletter preview in the admin panel renders the new layout perfectly.
- [ ] The "Top Stories" section is visually distinct from the "Deep Dives".
- [ ] Category labels are uppercase and use brand colors.
- [ ] The survey links are present and point to a valid endpoint.
- [ ] The `ContentItem` model now supports images, allowing the promo section to look like a featured video or article.

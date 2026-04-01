# 32. Newsletter Redesign — Complete Overhaul

## Context

The current newsletter (`backend/services/email_service.py`) is a flat list of topic blocks with nested article sub-blocks. It uses off-brand colors (`#818cf8`, `#f87171`, etc.), Georgia serif headings, and a dark `#111827` top bar. It has no visual hierarchy between top stories and deep dives, no images, no survey/feedback mechanism, and no posture/adoption-state callouts.

The redesign transforms it into a section-driven editorial newsletter inspired by Forward Future (beehiiv-powered), while enforcing PulseOne brand identity from `DESIGN.md`.

**Reference:** The Forward Future newsletter uses these distinct sections in order: Utility Header → Logo Banner → Personalized Greeting → Top Stories Rollup (single shared image, 3-4 quick-hit summaries) → Video Section → Event Promo → Deep-Dive Articles (each with category label, hero image, 2-paragraph narrative, "Read full article" link) → Quick-Hit News Roundup → Prompt of the Week → Survey/Feedback → Sign-off → Footer.

## Brand Constraints (from DESIGN.md)

Email clients strip web fonts, so use this font stack everywhere:
```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

| Token | Hex | Usage in Newsletter |
|-------|-----|---------------------|
| PulseOne Red | `#E91D24` | Primary CTA buttons, survey highlight, logo accent |
| PulseOne Teal | `#019E7C` | Category labels, secondary links, posture badges |
| Text Primary | `#111827` | Headings, body text |
| Text Secondary | `#4A5F6D` | Metadata, captions |
| Surface | `#F4F8FA` | Article card backgrounds, news roundup bg |
| Background | `#FFFFFF` | Email body, outer card |
| Outer Wrap | `#F3F4F6` | Behind the 600px card |

**Domain Colors (for category labels):**

| Domain | Hex |
|--------|-----|
| AI | `#7C3AED` |
| Security | `#E91D24` |
| Cloud | `#0284C7` |
| Finance | `#019E7C` |
| Leadership | `#D97706` |
| Other | `#6B7280` |

---

## Step 1: Schema Changes

### 1A. Add `image_url` to ContentItem

**File:** `backend/models/content.py`

Add after the `summary` field:
```python
image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
```

**File:** `backend/routers/admin.py`

Find the `ContentItemCreate`, `ContentItemUpdate`, and `ContentItemOut` Pydantic models. Add `image_url: str | None = None` to each.

### 1B. Create Alembic Migration

**File:** `backend/alembic/versions/20260401_add_image_url_to_content_items.py`

Create a migration that adds `image_url VARCHAR(2048) NULL` to the `content_items` table.

### 1C. Create Survey Feedback Model and Endpoint

**File:** `backend/models/survey_response.py` (new file)

```python
import uuid
from datetime import UTC, datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base

class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscriber_email: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=not relevant, 2=somewhat, 3=highly
    newsletter_date: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-04-01"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
```

**File:** `backend/routers/public.py`

Add a new endpoint:
```python
@router.get("/survey")
def record_survey(email: str, score: int, date: str, db: Session = Depends(get_db)):
    """Record a newsletter feedback click and return a thank-you page."""
    from ..models.survey_response import SurveyResponse
    response = SurveyResponse(subscriber_email=email, score=score, newsletter_date=date)
    db.add(response)
    db.commit()
    html = """<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F4F8FA;color:#111827;}
    .card{text-align:center;padding:48px;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);}
    h1{font-size:24px;margin:0 0 12px;} p{font-size:16px;color:#4A5F6D;margin:0;}
    </style></head><body><div class="card"><h1>Thank you for your feedback!</h1>
    <p>Your response helps us make the briefing more relevant.</p></div></body></html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)
```

Create the corresponding Alembic migration for the `survey_responses` table.

---

## Step 2: Rewrite Email Template Constants

**File:** `backend/services/email_service.py`

Replace the entire `_DOMAIN_COLORS` dict with brand-aligned colors:

```python
_DOMAIN_COLORS: dict[str, str] = {
    "AI": "#7C3AED",
    "Security": "#E91D24",
    "Cloud": "#0284C7",
    "Finance": "#019E7C",
    "Leadership": "#D97706",
    "Other": "#6B7280",
}
```

Replace `_EMAIL_TEMPLATE` with a new template that has these sections in order. The template must use `{placeholders}` for dynamic content. Here is the exact section flow:

### Section 1: Utility Header
- White background bar (not dark `#111827`)
- Left: date in `#4A5F6D`
- Right: "Read online →" link in `#019E7C`

### Section 2: Brand Banner
- PulseOne logo (use a hosted image URL or text fallback: "PULSE**ONE**" in bold with the red dot)
- Below logo: "TECHNOLOGY RADAR BRIEFING" in `#4A5F6D`, 10px uppercase tracking

### Section 3: Personalized Greeting
- "Good morning, {first_name}." in 18px bold `#111827`
- Below: "Here are the top technology signals your team needs to know about{industry_line}, curated by AI and reviewed by PulseOne analysts." in 14px `#4A5F6D`
- Below: "Share this briefing · Forward to a colleague" links in `#019E7C`

### Section 4: Top Stories Rollup
- Section header: horizontal rule (`1px solid #E5E7EB`) then "YOUR RADAR BRIEFING · Top Stories" in 10px uppercase `#4A5F6D`
- Render the top 3 topics (by urgency_score) as quick-hit summaries:
  - Each: **Topic Name** (bold, 15px) + 2-3 sentence summary (13px `#4A5F6D`)
  - No individual images, no article sub-blocks
  - Separated by 12px spacing, not horizontal rules

### Section 5: Deep-Dive Sections
- For each remaining topic (after the top 3), render a full section:
  - Section divider: `1px solid #E5E7EB`
  - Category label: domain name in uppercase, 10px, bold, colored with `_DOMAIN_COLORS[topic.domain]`
  - Topic name: 20px bold `#111827`
  - Posture badge: "YOUR POSTURE: {adoption_state}" — render as an inline span with `#019E7C` background, white text, 10px uppercase, border-radius 4px, padding 3px 10px
  - Summary: 14px `#111827`, line-height 1.75
  - Persona impact (if available for subscriber's role): render as a highlighted callout box with `#F4F8FA` background, left border `3px solid #019E7C`, containing "What this means for you as a {role_name}:" in bold 12px, followed by the persona-specific text in 13px
  - Article links: for each article (max 3), render as: "→ {article.title}" linked to `article.url`, in 13px `#019E7C`

### Section 6: PulseOne Insight (Promo Content)
- Section divider
- Header: "FROM PULSEONE · Recommended Resources" in 10px uppercase `#E91D24`
- For each ContentItem (max 3):
  - If `image_url` is set, render a 560px-wide image above the title
  - Type badge (Article/Video/Landing Page) in 10px uppercase, `#E91D24` text on `#FEE2E2` background
  - Title as a link in 15px bold `#111827`
  - Summary in 13px `#4A5F6D`

### Section 7: Quick-Hit News
- Section header: "ALSO ON OUR RADAR" in 10px uppercase `#4A5F6D`
- Background: `#F4F8FA` rounded card
- Render any topics beyond the deep-dive limit (or articles not assigned to a topic) as single-line items:
  - "**Topic Name:** {first sentence of summary}" in 13px
  - Separated by 8px spacing

### Section 8: PulseOne Tip of the Week
- Section header: "PULSEONE TIP OF THE WEEK" in 10px uppercase `#019E7C`
- This is a static placeholder block. Render a bordered box with:
  - A short, practical technology tip or assessment question
  - Placeholder text: "Is your organization prepared for [top topic]? Take our free 5-minute readiness assessment → [link]"
  - Style: `#F4F8FA` background, `#019E7C` left border, 14px text

### Section 9: Survey/Feedback
- Section divider
- "Before you go — how relevant was today's briefing?" in 16px bold `#111827`, centered
- "Your feedback helps us personalize future issues." in 13px `#4A5F6D`, centered
- Three clickable options, rendered as `<a>` tags styled as inline blocks:
  - "Highly Relevant" — background `#019E7C`, white text, border-radius 6px, padding 10px 20px
  - "Somewhat Relevant" — background `#F4F8FA`, `#111827` text, border `1px solid #E5E7EB`, border-radius 6px, padding 10px 20px
  - "Not Relevant" — same style as "Somewhat"
  - Each links to: `{base_url}/api/survey?email={subscriber_email}&score={1|2|3}&date={newsletter_date}`
- Below: "Thanks for reading. — The PulseOne Team" in 14px `#4A5F6D`, centered

### Section 10: Footer
- Background: `#F4F8FA`
- Top row: "Stay Connected" with links to PulseOne LinkedIn and X (text links in `#019E7C`)
- Middle row: "You're receiving this because you subscribed to PulseOne Radar. Domains: {domains_label} · Industry: {industry_label}" in 11px `#6B7280`
- Bottom row: "Manage preferences · Unsubscribe" links in `#019E7C`, 11px
- Legal line: "© 2026 PulseOne · pulseone.com" in 11px `#6B7280`

---

## Step 3: Rewrite `_build_html` Logic

**File:** `backend/services/email_service.py`

The current `_build_html` function treats all topics identically. Refactor it to split topics into tiers:

```python
def _build_html(subscriber, topics, db=None, promoted_content=None):
    # ... existing role resolution code stays the same ...

    # Split topics into tiers
    sorted_topics = sorted(topics, key=lambda t: t.urgency_score, reverse=True)
    top_stories = sorted_topics[:3]       # Quick-hit summaries only
    deep_dives = sorted_topics[3:7]       # Full sections with articles + persona
    quick_hits = sorted_topics[7:]        # Single-line mentions

    # Build top stories HTML (no articles, just topic.summary)
    top_stories_html = ...

    # Build deep dives HTML (with articles, persona impacts, posture badges)
    deep_dives_html = ...

    # Build quick hits HTML
    quick_hits_html = ...

    # Assemble full template
    ...
```

For the **deep dives**, the article rendering logic should:
1. Fetch up to 3 articles per topic (existing logic is fine)
2. Use `_article_why_for_subscriber()` to get the persona-specific impact
3. Render the persona impact as a callout box (not a "Why it matters" sub-label)
4. Render article titles as "→ Title" links (not as nested cards)

For the **top stories**, render only `topic.name` + first 2-3 sentences of `topic.summary`. No articles, no persona impacts.

For the **quick hits**, render as "**Topic Name:** {first sentence}" one-liners.

---

## Step 4: Update `_build_html` Template Placeholders

The new `_EMAIL_TEMPLATE` string needs these placeholders:

| Placeholder | Source |
|-------------|--------|
| `{date}` | `datetime.now(UTC).strftime("%B %-d, %Y")` |
| `{first_name}` | `subscriber.first_name` |
| `{industry_line}` | `f" for the {subscriber.industry} sector"` or `""` |
| `{top_stories_html}` | Rendered top 3 topics as quick-hit summaries |
| `{deep_dives_html}` | Rendered topics 4-7 as full sections |
| `{promo_html}` | Rendered promoted content with image support |
| `{quick_hits_html}` | Rendered remaining topics as one-liners (or empty) |
| `{survey_html}` | Survey block with subscriber email and date injected |
| `{domains_label}` | `", ".join(subscriber.domains or []) or "All"` |
| `{industry_label}` | `subscriber.industry or "Not specified"` |
| `{subscriber_email}` | `subscriber.email` (for survey links) |
| `{newsletter_date}` | `datetime.now(UTC).strftime("%Y-%m-%d")` |
| `{base_url}` | `settings.api_base_url` or a sensible default |

---

## Step 5: Update Newsletter Preview Panel

**File:** `frontend/src/components/admin/NewsletterSandboxPanel.tsx`

No structural changes needed — the panel already renders the HTML from the backend preview endpoint into an iframe. However, the iframe `minHeight` should be increased from the current value to at least `1200px` since the new newsletter will be significantly longer.

---

## Step 6: Admin Survey Dashboard (Optional but Recommended)

**File:** `frontend/src/app/admin/newsletter/page.tsx`

Below the existing "Newsletter Preview" section, add a simple "Feedback Summary" card that shows:
- Total responses this week
- Breakdown: X% Highly Relevant, Y% Somewhat, Z% Not Relevant
- Fetch from a new `GET /api/admin/newsletter/survey-stats` endpoint

**File:** `backend/routers/admin.py`

Add the endpoint:
```python
@router.get("/newsletter/survey-stats")
def get_survey_stats(db: Session = Depends(get_db)):
    from ..models.survey_response import SurveyResponse
    from sqlalchemy import func
    from datetime import timedelta
    cutoff = datetime.now(UTC) - timedelta(days=7)
    rows = db.query(SurveyResponse.score, func.count()).filter(
        SurveyResponse.created_at >= cutoff
    ).group_by(SurveyResponse.score).all()
    total = sum(r[1] for r in rows)
    breakdown = {r[0]: r[1] for r in rows}
    return {
        "total": total,
        "highly_relevant": breakdown.get(3, 0),
        "somewhat_relevant": breakdown.get(2, 0),
        "not_relevant": breakdown.get(1, 0),
    }
```

---

## Validation Checklist

- [ ] `_DOMAIN_COLORS` uses brand-aligned colors from `DESIGN.md`
- [ ] Newsletter preview in admin panel renders the full new layout
- [ ] Top Stories section shows 3 topics as quick-hit summaries (no article sub-blocks)
- [ ] Deep Dives show category label, posture badge, persona callout, and article links
- [ ] Persona callout box appears when subscriber has a role with matching `persona_impacts` or `persona_by_role`
- [ ] Promo section renders `image_url` when present on ContentItem
- [ ] Survey links point to `/api/survey` with correct email, score, and date params
- [ ] Survey endpoint returns a styled thank-you HTML page
- [ ] Footer uses `#F4F8FA` background with PulseOne branding
- [ ] No Georgia or serif fonts remain — all sans-serif
- [ ] No `#111827` dark top bar — utility header is white/light
- [ ] All link colors use `#019E7C` (teal) or `#E91D24` (red for CTAs)
- [ ] Quick-hit news section renders when there are more than 7 topics
- [ ] PulseOne Tip of the Week placeholder block renders

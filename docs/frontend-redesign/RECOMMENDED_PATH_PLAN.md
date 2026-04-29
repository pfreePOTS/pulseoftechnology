# PulseOne Recommended Path — Architecture & Assembly Plan

## 1. Overview
The `/recommended-path` page is the destination for users who complete the 4-step Executive Intake Form on the homepage. Instead of a static "thank you" page, it must dynamically assemble a personalized briefing that combines:
1. **AI-generated executive synthesis** (contextualizing their role, industry, and chosen challenge).
2. **Relevant Pulse of Technology Topics** (pulled from the live Radar backend).
3. **Curated Content Items** (blog posts, whitepapers, service descriptions pulled from the backend `ContentItem` model).

## 2. Page Structure

The page will be built in `frontend/src/app/recommended-path/page.tsx` as a Server Component that reads URL search parameters and fetches data from a new backend endpoint.

### Section 1: The AI Synthesis (Hero)
- **Inputs:** `?industry=X&role=Y&issue=Z&stage=W`
- **Output:** A personalized headline and 2-3 paragraph synthesis generated on the fly (or retrieved from cache) by the backend AI service.
- *Example:* "As a CIO in Healthcare, preparing for Cybersecurity shifts requires moving beyond compliance checklists..."

### Section 2: The Pulse Radar Snapshot
- **Data Source:** `Topic` model (filtered by `domain` matching the selected `issue`, and `industry_positions` matching the selected `industry`).
- **Display:** A mini-radar or a list of the top 3 most urgent topics relevant to their selections, including the AI-generated `persona_impacts` for their specific role.

### Section 3: Recommended Resources
- **Data Source:** `ContentItem` model (filtered by `tags` matching the selected `industry` and `issue`).
- **Display:** A grid of 3-4 cards showing relevant blog posts, service pages, or case studies.

### Section 4: The Next Step (CTA)
- **Display:** A split CTA block offering two paths:
  1. "Explore the full Pulse of Technology Radar" (Links to `/radar`)
  2. "Schedule a Strategic Briefing" (Links to contact form)

## 3. Backend Requirements (FastAPI)

To support this dynamic assembly, we need a new endpoint in `backend/routers/public.py`:

```http
GET /api/recommended-path?industry=X&role=Y&issue=Z&stage=W
```

**Response Payload:**
```json
{
  "synthesis": {
    "headline": "...",
    "body": "..."
  },
  "relevant_topics": [
    {
      "id": 1,
      "name": "Zero Trust Architecture",
      "urgency_score": 8.5,
      "role_impact": "Requires shifting identity management strategy..."
    }
  ],
  "recommended_content": [
    {
      "id": "uuid",
      "title": "Healthcare CISO Guide to 2026",
      "url": "/services/healthcare-security",
      "type": "landing_page",
      "image_url": "..."
    }
  ]
}
```

## 4. Implementation Plan (Cursor Prompts)

To build this, we will need two additional Cursor prompts following the homepage build:

### Prompt 38: Backend Recommended Path API
- Create `generate_path_synthesis` in `backend/services/ai_service.py` using Claude to write the personalized hero text.
- Create the `GET /api/recommended-path` endpoint in `backend/routers/public.py`.
- Query the `Topic` table for matches based on the `issue` (domain) and `industry`.
- Query the `ContentItem` table for matches based on tags.

### Prompt 39: Frontend Recommended Path UI
- Build `frontend/src/app/recommended-path/page.tsx`.
- Fetch data from the new API using the URL search parameters.
- Render the Hero synthesis, the Topic snapshot cards, and the Content grid.
- Implement loading skeletons since the AI synthesis may take 2-4 seconds to generate.

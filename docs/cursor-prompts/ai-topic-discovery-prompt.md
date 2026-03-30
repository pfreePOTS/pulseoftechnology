# Pulse of Technology — AI Topic Discovery & Industry Impact Prompts

This set of prompts builds the dynamic AI topic clustering pipeline, the Topic Intelligence Dashboard for curators, and the granular per-industry sliders for the radar.

---

## Feature 1: AI Topic Discovery Pipeline & Intelligence Dashboard

**Problem:** The current ingestion pipeline just dumps articles into broad Domain buckets (e.g., "AI", "Security"). It needs to dynamically identify specific trending topics (e.g., "DeepSeek Market Impact") and group articles into them, then present these to the curator in a new dashboard.
**Task:** Build dynamic clustering and the Topic Intelligence Dashboard.

**Instructions:**
1. **Backend - AI Clustering (`backend/services/ai_service.py`):**
   - Update `process_raw_articles`. Instead of grouping by `domain`, the AI must group by specific `trending_topic_name`.
   - Pass a list of recent active topic names to Claude in the `_EVALUATE_SYSTEM` prompt. Ask Claude to either assign the article to an existing specific topic OR suggest a new specific topic name.
   - Example schema addition: `"suggested_topic_name": "<specific 3-5 word trend>"`
   - When processing, if the topic doesn't exist, create it with `status="pending"`.
2. **Backend - API Endpoints (`backend/routers/admin.py`):**
   - Ensure `GET /topics?status=pending` returns these newly discovered trending topics, ordered by `urgency_score` descending.
   - Ensure the response includes the `article_count` for each topic so curators can see how much news is driving the trend.
3. **Frontend - Topic Intelligence Dashboard (`frontend/src/app/admin/page.tsx`):**
   - Rename the "Pending" tab to "Trending Topics (AI Discovered)".
   - Update the table to show: `Topic Name`, `Domain Badge`, `Article Count` (new), `Max Urgency`, and an "Inspect & Promote" button.
   - The table should clearly look like a feed of raw intelligence that the AI has gathered.

---

## Feature 2: Granular Per-Industry Impact Controls

**Problem:** Curators need a precise way to set both the Urgency Score (distance from center) and Adoption State (radar angle) for each of the 6 industries independently, and the AI needs to suggest both.
**Task:** Upgrade the Topic Editor UI to use sliders and dropdowns for per-industry positioning, powered by AI.

**Instructions:**
1. **Backend - AI Prompt Update (`backend/services/ai_service.py`):**
   - Update `_INDUSTRY_POSITIONING_SYSTEM` and `suggest_industry_positions` to ask Claude for both a `score` (1.0-10.0) AND an `adoption_state` (must be one of the 5 exact states: "Learn About", "Get Ahead Of", "Get Prepared For", "Get Your Hands Around", "Make the Most Of").
   - Schema update: `{"score": float, "adoption_state": str, "rationale": str}`.
2. **Frontend - Topic Editor UI (`frontend/src/app/admin/topics/[id]/TopicEditor.tsx`):**
   - In the "Industry Positions" section, change the display of existing industry overrides.
   - For each industry, display:
     - The Industry Name.
     - A `<input type="range" min="1" max="10" step="0.1">` slider for the Urgency Score. Display the exact number next to it.
     - A `<select>` dropdown for the Adoption State.
     - The AI's `rationale` text in small italics directly below the slider (if available from the AI generation).
     - A "Remove" button to clear the override.
   - When the user clicks "✨ Generate AI Industry Suggestions", map the returned `score` to the slider and the `adoption_state` to the dropdown automatically, and display the rationale.

**Validation Checklist:**
- [ ] Ingestion creates specific topics (e.g., "EU AI Act") rather than just broad domains ("AI").
- [ ] The Admin Dashboard shows "Trending Topics" with article counts.
- [ ] The Topic Editor shows range sliders for industry urgency scores.
- [ ] The Topic Editor shows dropdowns for industry adoption states.
- [ ] The AI Suggestion button populates both the sliders and the dropdowns with rationales.

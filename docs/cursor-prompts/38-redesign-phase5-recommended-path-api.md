# Prompt 38: PulseOne Redesign Phase 5 — Recommended Path API

## Context
We need a new FastAPI endpoint to dynamically assemble the content for the `/recommended-path` page. The page relies on an AI-generated synthesis of the user's role/industry/challenge, along with matching topics from the live Radar and recommended articles from the Content Library.

## Source Material
- The `Topic` model (`backend/models/topic.py`)
- The `ContentItem` model (`backend/models/content.py`)
- The AI Service (`backend/services/ai_service.py`)
- The new 5-step intake survey parameters (`region`, `industry`, `role`, `issue`, `stage`)

## Instructions

### Step 1: AI Synthesis Generator
1. Open `backend/services/ai_service.py`.
2. Add a new prompt constant `_RECOMMENDED_PATH_SYSTEM` that instructs Claude to write a personalized executive synthesis based on a user's region, industry, role, challenge, and stage. It should return JSON: `{"headline": "...", "synthesis_html": "..."}`.
3. Create a new function `generate_path_synthesis(db, region, industry, role, issue, stage)` that calls `_call()` and `_parse()` using this prompt.
4. Implement a simple caching mechanism (or a new DB table `PathSynthesisCache` if you prefer) so identical queries don't call Claude repeatedly.

### Step 2: The API Endpoint
1. Open `backend/routers/public.py`.
2. Create a new endpoint: `GET /api/recommended-path`.
3. Accept the 5 query parameters: `region`, `industry`, `role`, `issue`, `stage`.
4. **Fetch Synthesis:** Call the new `generate_path_synthesis` function.
5. **Fetch Topics:** Query the `Topic` model where `status == 'selected'` and `domain == issue`. Order by `urgency_score` descending, limit 3. For each topic, extract the `persona_impacts` matching the `role`.
6. **Fetch Content:** Query the `ContentItem` model where `is_active == True` and the `tags` array contains the `industry` OR the `issue`. Order by `created_at` descending, limit 4.
7. Return a JSON payload containing all three datasets.

### Step 3: Validation
- Start the FastAPI backend server.
- Open `http://localhost:8000/docs`.
- Test the `/api/recommended-path` endpoint via Swagger using:
  - `region`: West
  - `industry`: Healthcare
  - `role`: CIO
  - `issue`: Cybersecurity
  - `stage`: Get Ahead Of
- Verify the JSON response contains the AI synthesis, 3 topics, and a list of content items.

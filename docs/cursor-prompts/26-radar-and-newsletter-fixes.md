# Prompt 26: Radar Sizing, Newsletter Filtering, and Publish Pipeline

## Context
During system testing, three distinct issues were identified that prevent the public radar and newsletter simulation from working as intended:
1. **Radar Star Sizing:** The radar stars are too small. We previously requested them to be larger, but the `RadarChart.tsx` component is still rendering them with a very small radius.
2. **Newsletter Article Filtering:** The newsletter sandbox is returning empty articles when filtering by role/industry. The `_build_html` function in `email_service.py` is too strict: if a role has tags, it requires an exact intersection with the article's tags. If there's no intersection, it skips the topic entirely, leading to empty newsletters.
3. **Public Radar Not Populating:** The public radar page (`frontend/src/app/page.tsx`) fetches from `/api/topics/published`. However, the `public.py` router requires the `Topic` model, but `public.py` does not have access to the DB properly, or the frontend is failing to fetch it because the CORS or route setup is slightly off. Furthermore, the `is_published` toggle in the admin UI works, but the public radar remains empty.

## Instructions for Cursor

### 1. Fix Radar Star Sizing
*   **File:** `frontend/src/components/RadarChart.tsx`
*   **Fix:**
    *   In the `starPath` function, increase the default `outerR` and `innerR`. Change `outerR = 8` to `outerR = 14` and `innerR = 3.4` to `innerR = 6`.
    *   In the `computePositions` function, where it calculates `r = Math.max(18, (pt.urgency / 10) * MAX_R)`, increase the base radius to push stars further out: `r = Math.max(30, (pt.urgency / 10) * MAX_R)`.
    *   In the `RadarChart` component render, increase the hover target circle radius: `<circle cx={pt.x} cy={pt.y} r={24} fill={pt.color} opacity="0.1" />`.

### 2. Fix Newsletter Article Filtering (Fallback Logic)
*   **File:** `backend/services/email_service.py`
*   **Fix:** In `_build_html`, the role tag filtering is too aggressive.
    *   Currently, if `role_tags` is present, it does: `matched = [a for a in candidates if {t.lower() for t in (a.tags or [])} & role_tags]`. If `matched` is empty, it does `continue` (skipping the topic entirely).
    *   **Change this logic:** If `matched` is empty, do NOT skip the topic. Instead, fall back to the top 3 most recent articles for that topic, just like the non-role-filtered path.
    *   This ensures that if a topic is deemed highly urgent for a subscriber's domain, they still get the topic and its top articles, even if none of the specific articles perfectly matched their specific role tags.

### 3. Fix Public Radar Fetch Pipeline
*   **File 1:** `frontend/src/app/page.tsx`
    *   **Fix:** The public page fetches from `${API_BASE}/api/topics/published`. Ensure `API_BASE` is correctly defaulting to the backend URL (it currently defaults to `http://localhost:8000`, which is correct for local dev, but ensure it handles SSR correctly by using `next/cache` or `revalidate: 0` to prevent stale empty states).
    *   Change the fetch call to: `const res = await fetch(`${API_BASE}/api/topics/published`, { cache: 'no-store' });`
*   **File 2:** `backend/routers/public.py`
    *   **Fix:** Ensure the `/topics/published` endpoint correctly joins or loads the `articles` relationship if the frontend expects it, or at least ensure it returns valid JSON. The current endpoint `get_published_topics` is correct (`Topic.is_published == True`), but verify that the `TopicPublic` Pydantic model doesn't strip out required fields that `RadarChart` needs.
    *   The `RadarTopic` interface in `RadarChart.tsx` expects `id, name, domain, urgency_score, adoption_state, industry_positions, summary`. `TopicPublic` provides these. This is likely just a caching issue on the Next.js side where the initial empty state was cached.

## End-to-End Testing
1. **Radar Sizing:** Open the Curation Dashboard -> Radar Preview. The stars should be visibly larger and easier to click/hover.
2. **Newsletter:** Open the Newsletter Simulation Sandbox. Select a Role (e.g., CFO). The newsletter should populate with articles, even if the specific articles don't have CFO-specific tags, ensuring the newsletter is never artificially empty.
3. **Public Radar:** Go to the Curation Dashboard, approve a topic, and click "Publish to Radar". Open the public homepage (`localhost:3000`). The topic should immediately appear on the radar (thanks to `cache: 'no-store'`).

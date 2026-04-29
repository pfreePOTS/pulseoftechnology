# Prompt 39: PulseOne Redesign Phase 6 — Recommended Path UI

## Context
With the `/api/recommended-path` endpoint ready, we now build the frontend destination page. This page dynamically assembles the AI synthesis, the Radar snapshot, and the curated Content Library resources.

We are using an Option A architecture: Server-Side Rendering (SSR) on every request, which fetches the personalized data from the backend API.

## Source Material
- The v3.0 rebranding prototype `docs/frontend-redesign/source/recommended-path_v3.0.html`
- The `GlobalHeader` and `GlobalFooter` components

## Instructions

### Step 1: `frontend/src/app/recommended-path/page.tsx`
1. Open `frontend/src/app/recommended-path/page.tsx` (the placeholder created in Phase 4).
2. Make it a React Server Component (no `"use client"` at the top level).
3. Use the `searchParams` prop to read the 5 query parameters (`region`, `industry`, `role`, `issue`, `stage`).
4. Fetch data from the new API: `fetch(SSR_API_BASE + '/api/recommended-path?...')` using `cache: 'no-store'` to ensure fresh SSR.

### Step 2: Build the Sections
Using `recommended-path_v3.0.html` as your strict visual and structural guide, implement the sections:

1. **Hero:** Dark background. Render the AI-generated `headline` from the API response.
2. **Context:** White background. Render the AI-generated `synthesis_html` from the API response (use `dangerouslySetInnerHTML`).
3. **Radar Snapshot:** Dark background. Create a new component `<TopicSnapshotGrid topics={data.topics} />`. Display the 3 most urgent topics, highlighting the `persona_impacts` matching the user's role.
4. **Recommended Resources:** Light gray background. Create a new component `<ContentGrid items={data.content_items} />`. Display the 4 content items returned by the API.
5. **What Engaging PulseOne Looks Like:** White background. Extract the static HTML for this process section directly from `recommended-path_v3.0.html`.
6. **CTA + Booking Calendar:** Dark background. Extract the static HTML for the calendar widget.

### Step 3: Loading States
1. Since the AI synthesis might take 2-4 seconds on the first run (before it hits the cache), create `frontend/src/app/recommended-path/loading.tsx`.
2. Implement a skeleton UI that matches the structure of the Hero and Context sections so the page doesn't hang while Claude generates the synthesis. Use pulsing gray rectangles for the headline and paragraphs.

### Step 4: Validation
- Navigate to `http://localhost:3100/`.
- Complete the 5-step intake survey on the homepage.
- Submit the form and verify the redirect to `/recommended-path?region=...`.
- Verify the loading skeleton appears while the API responds.
- Verify the final page renders with the personalized AI headline, synthesis, the 3 Radar topics, and the 4 Content Library resources.
- Verify the "Explore the full Radar" CTA links to `/radar`.

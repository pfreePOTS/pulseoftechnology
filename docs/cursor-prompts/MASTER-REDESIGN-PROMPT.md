# Master Prompt: PulseOne Frontend Redesign (v3.0)

**Goal:** Transform the Next.js frontend into the new PulseOne corporate website, moving the existing "Pulse of Technology" app to a dedicated `/radar` route, and building a dynamic `/recommended-path` experience.

**Source Material:** All reference HTML, CSS, and images are in `docs/frontend-redesign/source/`.

Please execute this redesign in the following 5 phases. Do not skip phases. Verify each phase works before moving to the next.

---

## Phase 1: Assets & App Migration
1. **Assets:** Copy all `.png` and `.jpg` images from `docs/frontend-redesign/source/` and `docs/frontend-redesign/source/images/` to `frontend/public/`.
2. **Tokens:** Update `frontend/src/app/globals.css` with the new brand colors: `--color-dark-bg: #1e1e1e`, `--color-light-bg: #f4f8fa`.
3. **Migration:** Create `frontend/src/app/radar/`. Move the existing `frontend/src/app/page.tsx` into it (it becomes `/radar/page.tsx`). Do not change its logic.

---

## Phase 2: Core Corporate Components
Create the following reusable React components in `frontend/src/components/`, using Tailwind CSS to match the styles in `docs/frontend-redesign/source/index_v3.0.html`:
1. `<GlobalHeader />` (Sticky nav matching `index_v3.0.html`: Pulse of Technology, Our Approach, Assessments, Client Login, Let's Talk CTA)
2. `<GlobalFooter />` (Four-column layout)
3. `<HeroSection />` (Rotating text via `useEffect`, uses `FrontPage_SecurityImage.png` background)
4. `<PhilosophySection />` (Three-column: We Listen / We Understand / We Deliver)
5. `<IndustriesSection />` (The industry grid from `index_v3.0.html`)

*Once built, wrap `/radar/page.tsx` in `<GlobalHeader>` and `<GlobalFooter>`.*

---

## Phase 3: The 5-Step Executive Intake Form
1. Create `frontend/src/components/ExecutiveIntakeForm.tsx` (must be `"use client"`).
2. Reference `docs/frontend-redesign/source/survey_section.html` and `survey_js.txt`.
3. Build the 5-step state machine: Region, Industry, Role, Challenge, Stage.
4. **Step 1 (USA Map):** Convert `usa_map.html` into a React component (`<USAMap />`). Make the `<g class="map-region">` elements clickable to set the `region` state.
5. On Step 5 completion, redirect to `/recommended-path` passing all 5 selections as URL search parameters (e.g., `?region=West&industry=Healthcare...`).

---

## Phase 4: Build the New Homepage (`/`)
1. Create a new `frontend/src/app/page.tsx`.
2. Assemble the page exactly in this order:
   - `<GlobalHeader />`
   - `<HeroSection />`
   - `<PhilosophySection />`
   - `<IndustriesSection />`
   - `<ExecutiveIntakeForm />`
   - `<GlobalFooter />`

---

## Phase 5: The Recommended Path Backend & UI
1. **Backend API:** In `backend/services/ai_service.py`, create `generate_path_synthesis(db, region, industry, role, issue, stage)` to call Claude for a personalized 2-paragraph executive synthesis.
2. In `backend/routers/public.py`, create `GET /api/recommended-path`. It must return:
   - The AI synthesis.
   - The top 3 Topics matching the `issue` and `industry`.
   - The top 4 ContentItems matching the `industry` or `issue` tags.
3. **Frontend UI:** Create `frontend/src/app/recommended-path/page.tsx` as a Server Component.
4. Fetch data from the new API using the URL search parameters.
5. Using `docs/frontend-redesign/source/recommended-path_v3.0.html` as the visual spec, render the Hero (AI headline), Context (AI synthesis), Radar Snapshot (3 topics), and Recommended Resources (4 content items).
6. Create a `loading.tsx` skeleton for this route since the AI call will take a few seconds.

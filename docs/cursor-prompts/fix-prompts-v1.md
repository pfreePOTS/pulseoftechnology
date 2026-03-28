# Pulse of Technology — Codebase Fix Prompts

The following 5 prompts are designed to be pasted directly into Cursor to fix the architectural and UI gaps identified during the codebase audit. They should be executed in order.

---

## Fix Prompt 1: Register Brand Colors in Tailwind Config

**Task:** The PulseOne brand colors are defined as CSS variables in `globals.css` but are not registered in `tailwind.config.ts`, preventing the use of utility classes like `bg-pulse-red`.

**Instructions:**
1. Open `frontend/tailwind.config.ts`.
2. Inside the `theme.extend.colors` object, add the following mappings to the CSS variables:
   ```typescript
   colors: {
     'pulse-red': 'var(--color-pulse-red)',
     'pulse-teal': 'var(--color-pulse-teal)',
     'radar-bg': 'var(--color-radar-bg)',
     'radar-mid': 'var(--color-radar-mid)',
     'radar-inner': 'var(--color-radar-inner)',
     'radar-center': 'var(--color-radar-center)',
     'ind-finance': 'var(--color-ind-finance)',
     'ind-health': 'var(--color-ind-health)',
     'ind-all': 'var(--color-ind-all)',
     'ind-mfg': 'var(--color-ind-mfg)',
     'ind-tech': 'var(--color-ind-tech)',
     'ind-smb': 'var(--color-ind-smb)',
   }
   ```
3. Update `frontend/src/components/SubscribeWizard.tsx` to use `bg-pulse-red` instead of `bg-indigo-600` for the primary CTA buttons.
4. Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx` to use `bg-pulse-red` instead of `bg-indigo-600` for the "Approve & Publish" button.

---

## Fix Prompt 2: Add Explicit Adoption State to Topic Model

**Task:** The radar graphic requires topics to be explicitly assigned to an adoption state axis, rather than inferring it mathematically from the urgency score.

**Instructions:**
1. Open `backend/models/topic.py`.
2. Add a new `Enum` called `AdoptionState` with values: `"Learn About"`, `"Get Ahead Of"`, `"Get Prepared For"`, `"Get Your Hands Around"`, `"Make the Most Of"`.
3. Add an `adoption_state` column to the `Topic` model, defaulting to `"Learn About"`.
4. Generate a new Alembic migration: `cd backend && alembic revision --autogenerate -m "add adoption_state to topic"` and run `alembic upgrade head`.
5. Update `backend/routers/admin.py` and `backend/routers/public.py` to include `adoption_state` in the Pydantic schemas (`TopicPublic`, `TopicUpdate`).
6. Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx` to include a `<select>` dropdown for `adoption_state` so the curator can explicitly set it before approving.

---

## Fix Prompt 3: Add Per-Industry Positioning to Topic Model

**Task:** The radar mockups show that a single topic affects different industries differently (e.g., AI Governance might be "Make the Most Of" for Tech, but "Learn About" for Manufacturing). We need to store and render per-industry data points for a topic.

**Instructions:**
1. Open `backend/models/topic.py`.
2. Add a new JSON column `industry_positions` to the `Topic` model to store a dictionary mapping industry names to their specific urgency scores and adoption states. Example structure:
   ```json
   {
     "Healthcare": { "urgency_score": 8.5, "adoption_state": "Get Ahead Of" },
     "Manufacturing": { "urgency_score": 4.0, "adoption_state": "Learn About" }
   }
   ```
3. Generate a new Alembic migration: `cd backend && alembic revision --autogenerate -m "add industry_positions to topic"` and run `alembic upgrade head`.
4. Update `backend/routers/admin.py` and `backend/routers/public.py` schemas to expose this JSON field.
5. Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx` to allow the curator to add/edit industry-specific scores for the topic.
6. Update `frontend/src/components/RadarChart.tsx` to plot multiple stars per topic (one for each industry defined in `industry_positions`), coloring the star based on the industry color rather than the domain color.

---

## Fix Prompt 4: Wire Up the Radar "Choose Topic" Dropdown

**Task:** The public page has a "Choose Topic" dropdown in the mockup, which should filter the radar to show only the stars associated with that specific topic.

**Instructions:**
1. Open `frontend/src/components/RadarSection.tsx` (or `frontend/src/app/page.tsx` if the state lives there).
2. Add a `<select>` dropdown in the control bar area (light gray background, `#E5E5E5`) populated with the names of all approved topics fetched from the API.
3. Add React state (`selectedTopicId`) to track the dropdown value.
4. Pass only the selected topic (or its associated `industry_positions`) to the `RadarChart` component.
5. If no topic is selected, the radar should either be blank or prompt the user to select a topic.
6. Ensure the layout matches the mockup: Header (Dark Teal) -> Control Bar (Light Gray) -> Radar Area (White) -> Legend (Light Gray).

---

## Fix Prompt 5: Create RSS Seed Script

**Task:** The database has no sources. We need a seed script to populate the `sources` table with 10 real-world technology RSS feeds so the ingestion engine has data to process.

**Instructions:**
1. Create a new file `backend/seed_sources.py`.
2. Write a Python script using SQLAlchemy to insert the following RSS feeds into the `Source` table (if they don't already exist):
   - Wired Tech: `https://www.wired.com/feed/category/tech/latest/rss`
   - TechCrunch: `https://techcrunch.com/feed/`
   - Krebs on Security: `https://krebsonsecurity.com/feed/`
   - Dark Reading: `https://krebsonsecurity.com/feed/` (or similar security feed)
   - AI News: `https://www.artificialintelligence-news.com/feed/`
   - CIO.com: `https://www.cio.com/feed/`
   - VentureBeat: `https://techcrunch.com/feed/`
   - The Hacker News: `https://www.thehackernews.com/feeds/posts/default`
   - Bleeping Computer: `https://www.bleepingcomputer.com/feed/`
   - ZDNet: `https://www.zdnet.com/news/rss.xml`
3. Ensure the script uses the existing `get_db` session logic.
4. Add instructions to `backend/README.md` on how to run `python seed_sources.py` to initialize the database.

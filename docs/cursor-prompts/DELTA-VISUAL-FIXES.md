# Delta Prompt: Visual Fixes from Designer Screenshots

> **Context:** We have built the core components, but they are missing specific visual polish required by the designer. Please apply the following targeted CSS and structural fixes to the existing components. Do not rewrite the logic or change the overall architecture.
>
> **Reference Files:** The exact visual specs are now available in `docs/frontend-redesign/source/designer-screenshots/`.

## Fix 1: GlobalHeader
**Target:** `frontend/src/components/GlobalHeader.tsx`
**Reference:** `docs/frontend-redesign/source/designer-screenshots/nav-top-menu.webp`
**Required Changes:**
- "Pulse of Technology" link must be teal (`#019e7c`).
- "Our Approach" and "Assessments" links must be light gray.
- "Client Login" must be teal (`#019e7c`).
- "Let's Talk" must be a solid red (`#d5171e`) rounded button with white text, not just a text link.

## Fix 2: PhilosophySection
**Target:** `frontend/src/components/PhilosophySection.tsx`
**Reference:** `docs/frontend-redesign/source/designer-screenshots/philosophy-section-v2.webp`
**Required Changes:**
- The three cards (We Listen / We Understand / We Deliver) must have the image fill the top half of the card *completely* (full bleed, no padding around the image).
- The text content and icons must sit below the image.
- Ensure the column headings are exactly "We Listen", "We Understand", and "We Deliver".

## Fix 3: ExecutiveIntakeForm (Step 1 - Map)
**Target:** `frontend/src/components/ExecutiveIntakeForm.tsx`
**Reference:** `docs/frontend-redesign/source/designer-screenshots/usa-map-survey-step1.webp`
**Required Changes:**
- The entire survey section background must be dark (`#1e1e1e`).
- The SVG map lines must be teal (`#019e7c`).
- Add a text input field below the map: `placeholder="e.g. New Jersey"`.
- Ensure the progress bar at the bottom is a gradient from red to teal.

## Fix 4: ExecutiveIntakeForm (Step 2 - Industry)
**Target:** `frontend/src/components/ExecutiveIntakeForm.tsx`
**Reference:** `docs/frontend-redesign/source/designer-screenshots/survey-step2-industry.webp`
**Required Changes:**
- The option buttons must be outlined with rounded corners, white text, and a dark background.
- The active/selected state must have a teal outline (`#019e7c`).
- Ensure the "Skip — just show me everything" link is present below the progress bar.

**Verify:** Check the homepage in the browser to confirm the header, philosophy cards, and survey steps match the designer screenshots exactly.

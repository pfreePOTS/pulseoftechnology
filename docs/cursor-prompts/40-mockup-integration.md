# Prompt 40: Integrate New Mockup Pages

## Context
We have three new pages to integrate into the PulseOne frontend:
1. `/approach` (Our Approach)
2. `/assessments` (Assessments directory with filtering)
3. `/custom-solutions` (A variation of the recommended-path page)

These pages are provided as static HTML mockups. We need to convert them into Next.js React components using Tailwind CSS, matching the visual design exactly.

## Source Material
- Visual specs and HTML structure are in `docs/frontend-redesign/source/`:
  - `our-approach.html`
  - `assessments.html`
  - `custom-solutions-page.html`
- Images are in `docs/frontend-redesign/source/images/`

## Instructions

### Step 1: Update Assets
1. Copy any new images from `docs/frontend-redesign/source/images/` into `frontend/public/images/`.
2. Ensure the new logos (e.g., `logo_microsoft.png`, `logo_barracuda.jpg`) and team photos are available in `public/images/`.

### Step 2: Our Approach Page (`/approach`)
1. Create `frontend/src/app/approach/page.tsx`.
2. Implement the page structure using `our-approach.html` as the guide:
   - `<GlobalHeader />`
   - **Hero:** "Our Approach" with background image.
   - **About Section:** "Our Team is Your Team" text block.
   - **Timeline Section:** "Two Decades of Doing It Right" with the 4 timeline items.
   - **Partners Section:** "Our Services + Our Partners = Business Solutions" with the partner logos grid.
   - **Insights Section:** "What Leaders Are Reading" (you can use placeholder data or fetch from API if available).
   - **Goals Section:** "It starts with where you are." (This is the Intake Form component you built earlier).
   - **Stats Bar:** The 4 stat columns (20+ Years, All U.S. Regions, etc.).
   - **Engage Section:** "How to Engage PulseOne" 4-step process.
   - `<GlobalFooter />`

### Step 3: Assessments Directory (`/assessments`)
1. Create `frontend/src/app/assessments/page.tsx` as a Client Component (`"use client"`).
2. Implement the page structure using `assessments.html` as the guide:
   - `<GlobalHeader />`
   - **Hero:** "Find Your Starting Point"
   - **How it Works:** 3-step process.
   - **Assessments Section:** This requires state management.
     - Implement the 3 filter groups (Concern, Industry, Role).
     - State should track the selected filter for each group (default to 'all').
     - Create an array of assessment objects based on the cards in the HTML (e.g., Cyber Insurance Readiness, Copilot AI Readiness).
     - Filter the cards based on the selected state.
     - Render the filtered cards. Show "No assessments match your filters." if empty.
   - **CTA Section:** "Ready to see where you stand?"
   - `<GlobalFooter />`

### Step 4: Custom Solutions Page (`/custom-solutions`)
*Note: This page is structurally similar to the `/recommended-path` page but has a slightly different layout for services.*
1. Create `frontend/src/app/custom-solutions/page.tsx`.
2. Implement the page structure using `custom-solutions-page.html` as the guide:
   - `<GlobalHeader />`
   - **Hero:** "Here's what PulseOne looks like for a Healthcare CEO in the West"
   - **Context Section:** "Using AI in Healthcare is a leadership decision."
   - **Articles Section:** "What Healthcare CEOs Are Reading" (3 article cards).
   - **Services Section:** "Services Aligned to Your Situation" (Grid of service cards with emojis).
   - **Expect Section:** "What Engaging PulseOne Looks Like" (4-step process).
   - **CTA Section:** "Let's talk about what this looks like for your organization."
   - `<GlobalFooter />`

### Step 5: Navigation Links
1. Update `frontend/src/components/GlobalHeader.tsx` to ensure the links point to the correct routes:
   - "Our Approach" -> `/approach`
   - "Assessments" -> `/assessments`

### Step 6: Validation
- Run `pnpm dev`.
- Navigate to `http://localhost:3100/approach` and verify it matches the mockup.
- Navigate to `http://localhost:3100/assessments`, test the filters, and verify it matches the mockup.
- Navigate to `http://localhost:3100/custom-solutions` and verify it matches the mockup.

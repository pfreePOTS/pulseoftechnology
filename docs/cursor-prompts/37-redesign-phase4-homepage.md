# Prompt 37: PulseOne Redesign Phase 4 — Homepage & 5-Step Intake Routing

## Context
With the Radar app safely moved to `/radar`, we now have the root `/` path free. This phase focuses on building the new corporate homepage and the interactive 5-step intake survey that routes users based on their selections.

## Source Material
- The v3.0 rebranding prototype `docs/frontend-redesign/source/index-v3.html`
- The survey components: `survey_section.html`, `survey_js.txt`, `usa_map.html`
- The new components created in Phase 2: `GlobalHeader`, `HeroSection`, `PhilosophySection`, `GlobalFooter`

## Instructions

### Step 1: `<ExecutiveIntakeForm />` Component
1. Create `frontend/src/components/ExecutiveIntakeForm.tsx`.
2. Convert the 5-step HTML structure from `survey_section.html` into a React client component (`"use client"`).
3. Implement state management (`useState`) for:
   - `currentStep` (1-5)
   - `selectedRegion` (Step 1)
   - `selectedIndustry` (Step 2)
   - `selectedRole` (Step 3)
   - `selectedIssue` (Step 4)
   - `selectedStage` (Step 5)
4. **The USA Map (Step 1):** Integrate the SVG map from `usa_map.html`. Convert it to a React component (`<USAMap />`) that accepts an `onRegionSelect` callback. When a user clicks a `<g class="map-region">`, capture the `data-region` attribute.
5. Handle the "Next" transitions, ensuring validation (an option must be selected before proceeding).
6. On Step 5 completion, redirect to `/recommended-path` using `useRouter` from `next/navigation`, passing all five selected states via URL parameters (e.g., `?region=West&industry=Healthcare&role=CIO...`).

### Step 2: Build the New `/` Homepage
1. Open `frontend/src/app/page.tsx`.
2. Assemble the page in the exact order defined in `index-v3.html`:
   - `<GlobalHeader />`
   - `<HeroSection />`
   - `<PhilosophySection />`
   - `<IndustriesSection />` (Extract from `index-v3.html` if not built in Phase 2)
   - `<ExecutiveIntakeForm />`
   - `<GlobalFooter />`

### Step 3: Temporary `/recommended-path` Route
1. Create a basic placeholder at `frontend/src/app/recommended-path/page.tsx`.
2. For now, just render a simple success message that displays the 5 URL search parameters (Region, Industry, Role, Issue, Stage).
3. (We will build the full dynamic Recommended Path page in Prompts 38 and 39).

### Step 4: Validation
- Navigate to `http://localhost:3100/`.
- Verify the new corporate homepage loads with the hero, philosophy, industries, and intake form.
- Complete the 5-step survey, ensuring the SVG map click interaction works correctly.
- Verify the redirect to `/recommended-path` works correctly.
- Verify all 5 URL parameters are present in the address bar.

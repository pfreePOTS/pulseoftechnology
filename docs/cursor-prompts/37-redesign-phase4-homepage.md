# Prompt 37: PulseOne Redesign Phase 4 — Homepage & Intake Routing

## Context
With the Radar app safely moved to `/radar`, we now have the root `/` path free. This phase focuses on building the new corporate homepage and the interactive intake survey that routes users based on their selections.

## Source Material
- The rebranding prototype `docs/frontend-redesign/source/index.html` (specifically the `<section class="goals-section" id="how-can-we-help">`)
- The new components created in Phase 2: `GlobalHeader`, `HeroSection`, `PhilosophySection`, `GlobalFooter`

## Instructions

### Step 1: `<ExecutiveIntakeForm />` Component
1. Create `frontend/src/components/ExecutiveIntakeForm.tsx`.
2. Convert the 4-step HTML structure from `index.html` into a React client component (`"use client"`).
3. Implement state management (`useState`) for:
   - `currentStep` (1-4)
   - `selectedIndustry`
   - `selectedRole`
   - `selectedIssue`
   - `selectedStage`
4. Handle the "Next" transitions, ensuring validation (an option must be selected before proceeding).
5. On Step 4 completion, redirect to `/recommended-path` using `useRouter` from `next/navigation`, passing the selected state via URL parameters (e.g., `?industry=Healthcare&role=CIO...`).

### Step 2: Build the New `/` Homepage
1. Create a new `frontend/src/app/page.tsx`.
2. Import the required components:
   ```typescript
   import GlobalHeader from "@/components/GlobalHeader";
   import HeroSection from "@/components/HeroSection";
   import PhilosophySection from "@/components/PhilosophySection";
   import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";
   import GlobalFooter from "@/components/GlobalFooter";
   ```
3. Assemble the page in the following order:
   - `<GlobalHeader />`
   - `<HeroSection />`
   - `<PhilosophySection />`
   - `<ExecutiveIntakeForm />`
   - `<GlobalFooter />`

### Step 3: `/recommended-path` Route
1. Create `frontend/src/app/recommended-path/page.tsx`.
2. Import `GlobalHeader` and `GlobalFooter`.
3. Implement logic to read the URL search parameters (`useSearchParams`).
4. Display tailored content based on the selections (e.g., "Here is the recommended path for a CIO in Healthcare facing Compliance issues").
5. Include two strong CTAs:
   - "Explore the Pulse of Technology" (linking to `/radar`)
   - "Schedule a Consultation" (linking to a contact form or mailto)

### Step 4: Validation
- Navigate to `http://localhost:3100/`.
- Verify the new corporate homepage loads with the hero, philosophy, and intake form.
- Complete the 4-step survey on the homepage.
- Verify the redirect to `/recommended-path` works correctly.
- Verify the URL parameters are present and the Recommended Path page reflects the selections.

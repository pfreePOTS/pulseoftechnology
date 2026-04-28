# Prompt 37: PulseOne Redesign Phase 4 — Interactive Intake & Routing

## Context
This final phase focuses on converting the vanilla JavaScript "How Can We Help" survey from the rebranding prototype into a robust React component, and creating the `/recommended-path` route to handle its results.

## Source Material
- The rebranding prototype `docs/frontend-redesign/source/index.html` (specifically the `<section class="goals-section" id="how-can-we-help">`)
- The original vanilla JS implementation in `index.html` (specifically the `<script>` block managing the 4-step intake).

## Instructions

### Step 1: `<ExecutiveIntakeForm />` Component
1. Create `frontend/src/components/ExecutiveIntakeForm.tsx`.
2. Convert the 4-step HTML structure into a React client component (`"use client"`).
3. Implement state management (`useState`) for:
   - `currentStep` (1-4)
   - `selectedIndustry`
   - `selectedRole`
   - `selectedIssue`
   - `selectedStage`
4. Handle the "Next" transitions, ensuring validation (an option must be selected before proceeding).
5. On Step 4 completion, redirect to `/recommended-path` using `useRouter` from `next/navigation`, passing the selected state via URL parameters (e.g., `?industry=Healthcare&role=CIO...`).

### Step 2: `/recommended-path` Route
1. Create `frontend/src/app/recommended-path/page.tsx`.
2. Extract the layout and styling from the prototype's `recommended-path.html` (if available, otherwise use the strategy doc's definition).
3. Implement logic to read the URL search parameters (`useSearchParams`).
4. Display tailored content based on the selections (e.g., "Here is the recommended path for a CIO in Healthcare facing Compliance issues").
5. Include a strong CTA linking to the Contact form or scheduling a consultation.

### Step 3: Final Assembly
1. Import `<ExecutiveIntakeForm />` into `frontend/src/app/page.tsx`.
2. Replace the `[Placeholder for ExecutiveIntakeForm]` with the actual component.
3. Ensure it sits below `<PhilosophySection />` and above the `<RadarSection />`.

### Step 4: Validation
- Complete the 4-step survey on the homepage.
- Verify the redirect to `/recommended-path` works correctly.
- Verify the URL parameters are present and the Recommended Path page reflects the selections.

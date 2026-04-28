# Prompt 36: PulseOne Redesign Phase 3 — Homepage Assembly

## Context
With the core components built, this phase focuses on rewriting the main `page.tsx` of the `pulseoftechnology` frontend to assemble the new corporate homepage. The existing interactive components (Radar and Subscribe Wizard) will be integrated into the new layout.

## Source Material
- The existing `frontend/src/app/page.tsx`
- The new components created in Phase 2: `GlobalHeader`, `HeroSection`, `PhilosophySection`, `GlobalFooter`
- The rebranding strategy document: `docs/frontend-redesign/source/PulseOne Preliminary Design Strategy: Homepage & Site Architecture.md`

## Instructions

### Step 1: Rewrite `page.tsx`
1. Open `frontend/src/app/page.tsx`.
2. Remove the old hero and layout structure.
3. Import the new components:
   ```typescript
   import GlobalHeader from "@/components/GlobalHeader";
   import HeroSection from "@/components/HeroSection";
   import PhilosophySection from "@/components/PhilosophySection";
   import GlobalFooter from "@/components/GlobalFooter";
   ```
4. Assemble the page in the following order:
   - `<GlobalHeader />`
   - `<HeroSection />`
   - `<PhilosophySection />`
   - `[Placeholder for ExecutiveIntakeForm]` (to be built in Phase 4)
   - `[Placeholder for IndustriesMarquee]` (if applicable)
   - `<section className="radar-section">` containing the existing `<RadarSection topics={topics} />`
   - `<section className="newsletter-section">` containing the existing `<SubscribeWizard apiBase={API_BASE} />`
   - `[Placeholder for TestimonialsSection]`
   - `<GlobalFooter />`

### Step 2: Styling Adjustments
1. Wrap the existing `<RadarSection>` in a container that matches the styling from the prototype (e.g., `background: var(--light-bg); padding: 80px 24px; border-top: 4px solid var(--teal);`).
2. Wrap the existing `<SubscribeWizard>` in a container that matches the prototype's newsletter section (dark background, red border, radial gradients).

### Step 3: Validation
- Ensure the page renders without errors.
- Verify that the Radar still fetches topics correctly.
- Verify that the Subscribe Wizard still functions and connects to the backend.

# Prompt 36: PulseOne Redesign Phase 3 — App Migration to `/radar`

## Context
In this phase, we are taking the existing homepage (which currently houses the Radar, Tracked Stories, and Subscribe Wizard) and moving it to a dedicated `/radar` route. This frees up the root `/` path for the new corporate homepage in Phase 4.

## Source Material
- The existing `frontend/src/app/page.tsx`
- The new `GlobalHeader` and `GlobalFooter` components from Phase 2.

## Instructions

### Step 1: Move `page.tsx` to `/radar`
1. Create a new directory: `frontend/src/app/radar/`.
2. Move the existing `frontend/src/app/page.tsx` to `frontend/src/app/radar/page.tsx`.
3. Do not modify the imports or the logic for fetching topics and tracked articles yet.

### Step 2: Wrap `/radar` in Corporate Layout
1. Open the new `frontend/src/app/radar/page.tsx`.
2. Import the `GlobalHeader` and `GlobalFooter` components.
3. Wrap the entire return statement in a container that includes the header at the top and the footer at the bottom.
4. Add a subtle top margin or padding to the radar section to ensure it sits nicely below the sticky header.

### Step 3: Update Navigation
1. Open `frontend/src/components/GlobalHeader.tsx`.
2. Ensure the "Pulse of Technology" navigation link points to `/radar`.
3. Ensure the logo points to `/`.

### Step 4: Validation
- Run the Next.js development server.
- Navigate to `http://localhost:3100/radar`.
- Verify the Radar chart loads, topics are fetched, and the Subscribe Wizard is visible.
- Verify the global header and footer are present.

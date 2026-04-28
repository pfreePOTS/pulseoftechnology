# Prompt 34: PulseOne Redesign Phase 1 — Assets & Styles

## Context
We are integrating a new corporate rebranding prototype into the `pulseoftechnology` Next.js frontend. The goal of this phase is to establish the foundational design tokens, typography, and assets required for the new UI components, without breaking the existing interactive elements (Radar, Subscribe Wizard).

## Source Material
The source prototype files are located in `docs/frontend-redesign/source/`.
- `index.html` contains the target CSS variables and structure.
- Images need to be moved to `frontend/public/`.

## Instructions

### Step 1: Asset Migration
1. Copy all images (`*.png`, `*.jpg`, `*.svg`) from `docs/frontend-redesign/source/` to `frontend/public/`.
2. Ensure the main logo `pulseone_logo_official.png` and `hero_bg.png` are present.

### Step 2: Global CSS & Tailwind Config Updates
1. Open `frontend/src/app/globals.css`.
2. Update the `:root` and `@theme inline` blocks to include the new brand colors from the prototype:
   - `--color-pulse-red: #d5171e;` (Update from the existing `#e91d24` if different)
   - `--color-pulse-teal: #019e7c;` (Keep existing if same)
   - `--color-dark-bg: #1e1e1e;` (New)
   - `--color-light-bg: #f4f8fa;` (New/Update)
3. Ensure the font configuration in `frontend/src/app/layout.tsx` supports the required weights for IBM Plex Sans (400, 500, 600, 700).

### Step 3: Validation
- Run the Next.js development server.
- Verify that the existing public page (`/`) still renders correctly and that no build errors occur due to missing Tailwind classes or CSS variables.

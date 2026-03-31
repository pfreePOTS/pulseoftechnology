# 31. Brand Identity Alignment (PulseOne)

## Context
The current Pulse of Technology site uses Next.js default fonts (Geist) and an off-brand slate blue color (`#425B76`). We need to align the site with the official PulseOne brand identity from `pulseone.com`.

A complete design system has been written to `DESIGN.md`.

## Implementation Steps

### 1. Typography Update (IBM Plex Sans)
- **File:** `frontend/src/app/layout.tsx`
- **Action:** 
  - Remove `Geist` and `Geist_Mono`.
  - Import `IBM_Plex_Sans` from `next/font/google`. Configure it for weights `[400, 500, 600, 700]` and variable `--font-ibm-plex-sans`.
  - Update the body `className` to use the new font variable.
- **File:** `frontend/src/app/globals.css`
- **Action:** 
  - Update `--font-sans` to map to `var(--font-ibm-plex-sans)`.
  - Change the `body` font-family fallback to `var(--font-sans), sans-serif`.

### 2. Color Palette Update
- **File:** `frontend/src/app/globals.css`
- **Action:** 
  - Replace the old `--color-pulse-teal: #425B76;` with the true brand teal: `--color-pulse-teal: #019E7C;`.
  - Keep `--color-pulse-red: #E91D24;` (this is correct).
  - Add the brand light surface color: `--color-pulse-surface: #F4F8FA;`.
  - Update the radar gradient stops: change `--color-radar-bg: #0d9488;` to `--color-radar-bg: #019E7C;`.

### 3. Header Redesign (White Background + True Logo)
- **File:** `frontend/src/app/page.tsx`
- **Action:** 
  - Change the `<header>` background from the dark teal style (`style={{ backgroundColor: "#425B76" }}`) to white (`bg-white border-b border-gray-200`).
  - Change the navigation link text color from `text-white/70` to `text-gray-600 hover:text-gray-900`.
  - Replace the text-based logo (`<span className="text-lg font-bold...">PulseOne</span>`) with the actual image logo.
  - Add `<img src="/pulseone_logo_main.webp" alt="PulseOne" className="h-8 w-auto" />` (Note: move the image from `docs/pulseone_logo_main.webp` to `frontend/public/pulseone_logo_main.webp` first).
  - Remove the red dot `<span>` next to the old text logo, as the image logo already includes the brand styling.
  - Change the "Industry Radar" text color from `text-white/60` to `text-gray-500`.

### 4. Global Color Replacements
- **File:** `frontend/src/app/page.tsx`
- **Action:** 
  - Find all instances of `style={{ color: "#425B76" }}` and replace them with `className="text-[var(--color-pulse-teal)]"` (or just let them inherit the new teal from globals.css if you prefer using CSS variables).
  - Find all instances of `style={{ backgroundColor: "#425B76" }}` and replace with `style={{ backgroundColor: "var(--color-pulse-teal)" }}`.
  - Update the "How to Read the Radar" section background from `bg-white` to `bg-[var(--color-pulse-surface)]` to give it subtle definition.

### 5. Subscribe Wizard Brand Alignment
- **File:** `frontend/src/components/SubscribeWizard.tsx`
- **Action:** 
  - Ensure all primary action buttons (like "Next", "Subscribe") use the brand red (`#E91D24`) instead of teal or gray. The red should be the primary conversion color.
  - Change any hardcoded `#425B76` to `var(--color-pulse-teal)`.

## Validation
- [ ] The font across the entire site is now IBM Plex Sans.
- [ ] The header is white with dark text, matching pulseone.com.
- [ ] The actual PulseOne logo image is used in the header.
- [ ] The dark slate blue (`#425B76`) is completely gone from the site, replaced by the bright teal (`#019E7C`).
- [ ] The primary CTAs use the brand red (`#E91D24`).

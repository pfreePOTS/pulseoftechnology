# Prompt 35: PulseOne Redesign Phase 2 — Core Components

## Context
Following the establishment of assets and styles, this phase focuses on translating the static HTML sections from the rebranding prototype (`docs/frontend-redesign/source/index.html`) into reusable React components in the `pulseoftechnology` Next.js app.

## Instructions

### Step 1: `<GlobalHeader />` Component
1. Create `frontend/src/components/GlobalHeader.tsx`.
2. Extract the `<nav class="nav">` structure from the prototype.
3. Ensure it is sticky and uses the `pulseone_logo_official.png`.
4. The "Let's Talk" button should link to `#how-can-we-help`.

### Step 2: `<HeroSection />` Component
1. Create `frontend/src/components/HeroSection.tsx`.
2. Extract the `<section class="hero">` structure.
3. Implement the rotating text effect for "Cybersecurity", "Cloud Architecture", "Data Privacy", etc. Use React state and `useEffect` or CSS animations.
4. Ensure the background image (`hero_bg.png`) is correctly applied using Next.js `Image` or CSS `background-image`.

### Step 3: `<PhilosophySection />` Component
1. Create `frontend/src/components/PhilosophySection.tsx`.
2. Extract the `<section class="philosophy">` structure.
3. Implement the three-column layout ("We Listen", "We Understand", "We Deliver").

### Step 4: `<GlobalFooter />` Component
1. Create `frontend/src/components/GlobalFooter.tsx`.
2. Extract the `<footer class="footer">` structure.
3. Implement the four-column layout (Logo/Brand, Services, Contact/Locations, Copyright).

### Step 5: Validation
- Ensure all new components export properly.
- Verify they use Tailwind utility classes instead of raw CSS where possible, mapping to the custom CSS variables defined in Phase 1.

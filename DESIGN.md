# Design System — Pulse of Technology

## Product Context
- **What this is:** The Pulse of Technology radar and newsletter platform. It helps SMB leaders stay aware of the technology domains that matter most, determine the right posture toward each one, and act before disruption turns into cost, risk, or missed opportunity.
- **Who it's for:** C-suite leaders, executives, and decision-makers at SMBs.
- **Space/industry:** Technology intelligence, managed IT services, strategic advisory.
- **Project type:** Web application (public radar + admin curation dashboard).

## Brand Alignment (PulseOne)
This design system aligns the Pulse of Technology platform with the parent brand, PulseOne. The previous iteration used off-brand colors (slate blue) and fonts (Geist). This system enforces the official PulseOne visual identity.

## Aesthetic Direction
- **Direction:** Clean, authoritative, professional.
- **Decoration level:** Minimal. The data (radar, topics, insights) is the hero.
- **Mood:** Trustworthy, forward-looking, "creating order from chaos."
- **Reference sites:** https://pulseone.com

## Typography
- **Primary Font:** `IBM Plex Sans` (Google Fonts) — The official PulseOne brand font. Used for all headings and body text. Replaces Geist.
- **Weights:** Regular (400), Medium (500), SemiBold (600), Bold (700).
- **Secondary Font:** `IBM Plex Sans Condensed` — Used sparingly for UI labels, dense data tables, or secondary metadata where horizontal space is constrained.
- **Scale:**
  - Hero: `text-4xl` to `text-5xl` (bold)
  - Section Headings: `text-2xl` to `text-3xl` (bold)
  - Card Titles: `text-lg` (semibold)
  - Body: `text-base` (regular)
  - UI Labels/Metadata: `text-sm` or `text-xs` (medium)

## Color
- **Approach:** High-contrast white background, dark text, with highly intentional use of brand colors for accents and CTAs.
- **Primary Red:** `#D5171E` (PulseOne Red, rebranding prototype) — Used strictly for primary calls to action (e.g., "Subscribe", "Explore the Radar") and the logo accent.
- **Primary Teal:** `#019E7C` (PulseOne Teal) — Used for secondary accents, active states, links, and the radar chart's core theme color. Replaces the off-brand `#425B76`.
- **Neutrals:**
  - Background: `#FFFFFF` (White)
  - Surface (Cards/Sections): `#F4F8FA` or `#F6F6F6` (Very light cool grays from the main site)
  - Text Primary: `#000000` or `#111827` (Near black)
  - Text Secondary: `#4A5F6D` (Muted blue-gray from the main site) or `#605F5F`
- **Radar Domain Colors (Semantic):**
  - AI: `#7C3AED` (Purple)
  - Security: `#E91D24` (Brand Red)
  - Cloud/Infrastructure: `#0284C7` (Blue)
  - Finance/Business: `#019E7C` (Brand Teal)
  - Leadership/Other: `#D97706` (Amber)

## Spacing & Layout
- **Base unit:** 4px (Tailwind default)
- **Density:** Comfortable. Generous whitespace to convey executive-level clarity, not overwhelming density.
- **Containers:** `max-w-[1200px]` for all page-level content sections (matches `GlobalHeader` / `GlobalFooter`, so column edges align down the page). Centered full-bleed hero wrappers use `max-w-[1320px]`. Narrower widths inside a section (e.g. `max-w-[720px]` text measures, `max-w-2xl` forms) are reading-width constraints, not containers — they are fine, but the section container itself must be 1200.
- **Border radius:** Rounded-lg (8px) or rounded-xl (12px) for cards. Not overly pill-shaped.

## Header & Logo
- **Header:** White background (`bg-white`), dark text for navigation.
- **Logo:** Use the official PulseOne typographic logo (`pulseone_logo_main.webp`) or a highly accurate CSS recreation (Black `IBM Plex Sans` uppercase, with the red accent if applicable). The previous "slate blue header with white text" is deprecated.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| March 2026 | Brand Alignment Reset | Replaced generic Next.js defaults (Geist, slate blue) with official PulseOne brand assets (IBM Plex Sans, #E91D24 Red, #019E7C Teal) based on pulseone.com audit. |

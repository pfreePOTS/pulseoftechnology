# PulseOne Frontend Redesign Brief

## Overview

This document describes the plan to transform the `pulseoftechnology` Next.js frontend from a standalone Radar landing page into the full PulseOne corporate website. The rebranding prototype (`source/index.html`) serves as the visual and structural reference. The existing interactive React components (Radar, Subscribe Wizard) are preserved and embedded within the new corporate layout.

## Source Material

All source files are in `docs/frontend-redesign/source/`:

| File | Purpose |
|---|---|
| `index.html` | Complete rebranding prototype — the visual reference for all new components |
| `PulseOne Website Rebranding Strategy.md` | Brand positioning, audience, buyer-state framework |
| `PulseOne Preliminary Design Strategy.md` | Navigation structure, homepage section order, newsletter placement |
| `FrontPage_SecurityImage.png` | Hero background image |

## Target Page Structure (Homepage)

The final `frontend/src/app/page.tsx` must assemble sections in this order:

| Order | Component | Status | Source |
|---|---|---|---|
| 1 | `<GlobalHeader />` | To Build | `index.html` nav |
| 2 | `<HeroSection />` | To Build | `index.html` hero |
| 3 | `<PhilosophySection />` | To Build | `index.html` philosophy |
| 4 | `<ExecutiveIntakeForm />` | To Build | `index.html` goals-section |
| 5 | `<RadarSection />` | Exists | `src/components/RadarSection.tsx` |
| 6 | `<SubscribeWizard />` | Exists | `src/components/SubscribeWizard.tsx` |
| 7 | `<GlobalFooter />` | To Build | `index.html` footer |

## New Routes Required

| Route | Purpose | Status |
|---|---|---|
| `/` | Corporate homepage | Rebuild |
| `/recommended-path` | Intake survey results page | New |

## Design Tokens

All brand tokens are already defined in `frontend/src/app/globals.css`. The key values are:

| Token | Value | Usage |
|---|---|---|
| `--color-pulse-red` | `#d5171e` | Primary CTAs, borders, accents |
| `--color-pulse-teal` | `#019e7c` | Secondary CTAs, labels, links |
| `--color-dark-bg` | `#1e1e1e` | Dark sections (engage, footer) |
| `--color-light-bg` | `#f4f8fa` | Light sections (radar, testimonials) |

## Cursor Prompt Execution Order

Apply the prompts in this exact sequence:

1. **Prompt 34** (`34-redesign-phase1-assets-styles.md`) — Assets & Styles
2. **Prompt 35** (`35-redesign-phase2-components.md`) — Core Components
3. **Prompt 36** (`36-redesign-phase3-assembly.md`) — Homepage Assembly
4. **Prompt 37** (`37-redesign-phase4-interactive.md`) — Interactive Intake & Routing

Each prompt must be fully applied and tested before proceeding to the next.

## Architectural Invariants (Do Not Violate)

1. Do not modify any files under `frontend/src/app/admin/`.
2. Do not modify `backend/` files in this redesign effort.
3. Do not remove or replace `<RadarSection />` or `<SubscribeWizard />` — only re-style their containers.
4. All new components must be TypeScript (`.tsx`) and use Tailwind CSS utility classes.
5. The `<ExecutiveIntakeForm />` must be a `"use client"` component.

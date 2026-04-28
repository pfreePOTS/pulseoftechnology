# PulseOne Frontend Redesign Brief (Revised IA)

## Overview

This document describes the plan to transform the `pulseoftechnology` Next.js frontend into the full PulseOne corporate website. The rebranding prototype (`source/index.html`) serves as the visual and structural reference for the new homepage. 

Crucially, **the existing Radar, Tracked Stories, and Subscribe Wizard will not be on the homepage.** Instead, they will be moved to a dedicated `/radar` route (the "Pulse of Technology" app). The homepage will focus purely on brand positioning, philosophy, and the interactive intake survey, which will route users to the appropriate service or the Radar app.

## Target Information Architecture

| Route | Purpose | Status |
|---|---|---|
| `/` | The new corporate homepage (Hero, Philosophy, Intake Form, Footer) | Rebuild |
| `/radar` | The existing app (Radar, Tracked Stories, Subscribe Wizard) | Move existing `page.tsx` here |
| `/recommended-path` | Intake survey results page | New |

## Source Material

All source files are in `docs/frontend-redesign/source/`:

| File | Purpose |
|---|---|
| `index.html` | Complete rebranding prototype — the visual reference for all new components |
| `PulseOne Website Rebranding Strategy.md` | Brand positioning, audience, buyer-state framework |
| `PulseOne Preliminary Design Strategy.md` | Navigation structure, homepage section order |
| `FrontPage_SecurityImage.png` | Hero background image |

## Design Tokens

All brand tokens are already defined in `frontend/src/app/globals.css`. The key values are:

| Token | Value | Usage |
|---|---|---|
| `--color-pulse-red` | `#d5171e` | Primary CTAs, borders, accents |
| `--color-pulse-teal` | `#019e7c` | Secondary CTAs, labels, links |
| `--color-dark-bg` | `#1e1e1e` | Dark sections (engage, footer) |
| `--color-light-bg` | `#f4f8fa` | Light sections (testimonials, survey) |

## Cursor Prompt Execution Order

Apply the prompts in this exact sequence:

1. **Prompt 34** (`34-redesign-phase1-assets-styles.md`) — Assets & Styles
2. **Prompt 35** (`35-redesign-phase2-components.md`) — Core Components
3. **Prompt 36** (`36-redesign-phase3-app-migration.md`) — Move existing app to `/radar`
4. **Prompt 37** (`37-redesign-phase4-homepage.md`) — Build new `/` homepage & `/recommended-path`

Each prompt must be fully applied and tested before proceeding to the next.

## Architectural Invariants (Do Not Violate)

1. Do not modify any files under `frontend/src/app/admin/`.
2. Do not modify `backend/` files in this redesign effort.
3. All new components must be TypeScript (`.tsx`) and use Tailwind CSS utility classes.
4. The `<ExecutiveIntakeForm />` must be a `"use client"` component.

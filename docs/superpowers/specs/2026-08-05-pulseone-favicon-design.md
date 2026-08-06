# PulseOne red PO favicon

**Date:** 2026-08-05  
**Status:** Approved direction (Option 1) — pending user review of this written spec  
**Scope:** Browser tab favicon only. Site header wordmark unchanged.

## Goal

Replace the current Next.js/Vercel triangle favicon so browser tabs show a red square with white **PO**, matching the PulseOne Blog tab mark the stakeholder referenced.

## Non-goals

- No changes to `GlobalHeader` / `PulseOneOfficialLogo`
- No new marketing chrome or PO mark in the page nav
- No title/metadata string changes beyond what the icon file implies

## Design

| Property | Value |
|----------|--------|
| Shape | Square fill |
| Background | PulseOne brand red `#D5171E` (matches `--color-pulse-red` in `globals.css`) |
| Glyph | Uppercase **PO**, bold, white `#FFFFFF`, centered |
| Corner radius | Slight (~10–12% of size) so it reads like the Blog favicon, not a harsh hard square at 16px |
| Font | Sans bold; prefer IBM Plex Sans if available in the ImageResponse context, else system UI sans |

## Implementation approach

Use **Next.js App Router file-based metadata icons**:

1. Add `frontend/src/app/icon.tsx` that exports `size` / `contentType` and a default function returning `ImageResponse` (red square + centered PO).
2. Optionally add `frontend/src/app/apple-icon.tsx` with the same mark at 180×180 for iOS home-screen consistency.
3. **Remove** `frontend/src/app/favicon.ico` (current triangle asset) so it cannot override or compete with the generated icon.

No `layout.tsx` `metadata.icons` wiring required when using the App Router convention files.

## Verification

- Hard-refresh a page on `http://localhost:3100` and confirm the tab favicon is red **PO**, not the black/white triangle.
- Confirm header logo and page layout are unchanged.
- Spot-check dark/light OS chrome (favicon should remain the red square either way).

## Out of scope follow-ups

- Fetching an official binary from pulseone.com (blocked / unnecessary if we generate the mark)
- Syncing blog and radar titles in the tab string

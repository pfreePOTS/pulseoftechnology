# PulseOne Favicon Implementation Plan

> **For agentic workers:** Inline execution (user approved implement immediately).

**Goal:** Browser tabs show a red square with white **PO** instead of the Next/Vercel triangle.

**Architecture:** Next.js App Router generated icons via `ImageResponse`; delete `favicon.ico`.

**Tech Stack:** Next.js App Router, `next/og` ImageResponse, brand red `#D5171E` (`--color-pulse-red`).

## Global Constraints

- Favicon only — do not change `GlobalHeader` / wordmark
- Red: `#D5171E` (matches `globals.css` `--color-pulse-red`)
- Slight corner radius (~12% of size)

### Task 1: Shared mark + icon routes

**Files:**
- Create: `frontend/src/lib/pulseoneFavicon.tsx`
- Create: `frontend/src/app/icon.tsx`
- Create: `frontend/src/app/apple-icon.tsx`
- Delete: `frontend/src/app/favicon.ico`

- [x] Implement and verify `/icon` returns PNG

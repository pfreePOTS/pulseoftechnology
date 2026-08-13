# Newsletter header + welcome rollup redesign

**Date:** 2026-08-12  
**Status:** Implemented  
**Primary file:** `backend/services/email_service.py`

## Goal

Make the daily briefing header read more like Forward Future while staying on PulseOne’s light brand surface: **Pulse of Technology** is the hero name; PulseOne is secondary; the welcome blurb summarizes the issue’s top stories; the hot-story headline is not repeated in the banner.

## Decisions

| Choice | Decision |
|--------|----------|
| Banner surface | Light `#F4F8FA` (option B) |
| Hierarchy | Stacked: large title → smaller PulseOne logo → `PEOPLE \| TECHNOLOGY \| PROGRESS` |
| Title treatment | Split accent: “Pulse of” near-black + “Technology” in `#E91D24` |
| Hot headline in banner | Removed (hot lead block below is enough) |
| Welcome copy | Deterministic template from hot lead + top story names (no new LLM) |
| Preview | Admin newsletter sandbox uses the same `_build_html` path |

## Layout

1. Utility bar — date / Read online (unchanged)
2. Brand banner — hero **Pulse of Technology**; ~180px PulseOne logo; tagline; no article title
3. Welcome — `Good morning, {name}.` + two short paragraphs (date/industry open + leading/also-on-radar list) + share links
4. Existing body — hot lead → top stories → deep dives → …

## Out of scope

- AI-written rollup copy
- Reordering hot lead / promo sections
- Subject-line wording (`Pulse of Technology Daily` remains for email subjects)

## Follow-up (implemented 2026-08-12)

Deep dives are **article-first**: linked lead article title → `DOMAIN · topic name` → posture/trend → briefing blocks. Extra sources stay under Top reads (lead not duplicated).

Hot lead stays **global** (shared top story). Personalized Top Stories stay profile-sorted after peel.

Newsletter industry matching reuses `canonical_industry_label` / `_INDUSTRY_NAME_ALIASES` (e.g. Finance & Banking → Financial Services). Admin preview shows `Assembly tier:` banner + sandbox `tier=` chip.

## Verification

- `pytest` in `backend/tests/test_email_service.py` (header + rollup cases)
- Visual check: Admin → Newsletter preview at http://localhost:3100/admin

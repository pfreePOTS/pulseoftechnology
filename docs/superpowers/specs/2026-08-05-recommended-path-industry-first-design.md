# Recommended Path: industry/role-first themes & stories

**Date:** 2026-08-05  
**Status:** Approved for implementation  
**Scope:** `/recommended-path` themes + “Stories on the Pulse” only. Newsletter rewrite deferred to a follow-up audit.

## Problem

Intake focus values such as **Strategy** hard-mapped to the **AI** radar domain (`ISSUE_DOMAINS` / free-text heuristics). Theme ranking then ran inside that narrow pool, so industry/role profiles (e.g. Insurance + IT Manager) still surfaced wall-to-wall AI themes and story cards.

## Approach

1. **Stop hard-filtering** published topics to issue→domain lists. Prefer **industry (+ role)** matches from the live DB, then soft-boost explicit technology domains, then generic urgency/rank fill.
2. **Stop treating Strategy / Leadership / culture as AI domains.** Explicit focuses (AI, Cybersecurity, Cloud, …) remain soft boosts only.
3. **Story cards** use the same priority ladder over eligible tracked articles, reusing `newsletter_selection` helpers (`article_industry_bonus`, `article_has_persona_for_roles`).
4. **Follow-up:** audit newsletter and other dynamic surfaces for hardcoded AI/domain bias (separate pass).

## Success criteria

- Strategy + Insurance-style intake does not force all themes/stories into AI when better industry/role matches exist.
- Explicit `issue=AI` (or Cybersecurity, etc.) still soft-prefers that domain after industry/role hits.
- Existing watch-story shape / dedupe / processed-on-live-topic tests still pass.

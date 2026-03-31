# Final Cross-Reference: 10 Items vs Latest Dev (e274b19)

## Item-by-Item Verification

| # | Original Issue | Status | Evidence |
|---|---------------|--------|----------|
| 1 | C1: Empty radar empty-state + env fallback | **PARTIAL** | RadarSection shows "No topics match the selected filters" only when filters are active. RadarDefaultPanel shows "Published topics will appear as stars on the radar" when topics=0. **BUT** page.tsx still has `API_BASE = "http://localhost:8000"` (wrong port; lib/api.ts uses 8100). No import from `@/lib/api`. |
| 2 | C2: TopicEditor redirect-after-approve | **NEEDS VERIFICATION** | The Trend Discovery page now has an inline drawer for topic detail. Need to check if TopicEditor still redirects. However, the new Publishing page has radar toggles, so the two-trip workflow may be less critical. |
| 3 | C3: Radar Preview fetches `status=approved` not `is_published=true` | **STILL OPEN** | radar-preview/page.tsx line 14: still `?status=selected`. Has a warning note but still shows different data than public site. |
| 4 | H1: Subscribe Wizard dark theme on light page | **STILL OPEN** | Wizard still uses `bg-gray-900`, `border-gray-800`, `bg-gray-800` inputs, `bg-indigo-600` step indicators. Completely dark theme on a white page. |
| 5 | H2: No hero/value proposition above the fold | **PARTIAL** | RadarSection now has "C-Level Technology Intelligence Radar" as h1 with a subtitle. This is better than before but is more of a title than a value proposition. No compelling statement about what PulseOne does for the visitor. |
| 6 | H3: Published Briefings section redundant | **STILL OPEN** | page.tsx lines 149-204: same topic cards with domain, urgency, summary. No click-through, no conversion CTA, no differentiation from radar. |
| 7 | H4: No pre-submit review step | **STILL OPEN** | Step 4 is still domains, then submit. No summary of name/email/role/industry before final click. |
| 8 | H5: 409 duplicate email no recovery path | **STILL OPEN** | handleSubmit catches error and shows raw `detail` message. No special handling for 409. |
| 9 | M1: Operational runbook out of date | **STILL OPEN** | Still references `localhost:3000`, `cd backend`, `Approve & Publish` button, `Choose Topic` dropdown. |
| 10 | M2: API_BASE inconsistency | **STILL OPEN** | page.tsx line 5: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`. lib/api.ts: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100"`. page.tsx does not import from lib/api. |

## Items NOW DONE (from Prompt 29)

- 29-A: Analysis page → now uses CSS Grid spreadsheet layout ✓
- 29-B: Trend Discovery detail drawer → implemented with slide-in aside ✓
- 29-C: Publishing page → radar toggles + newsletter preview unified ✓ (but newsletter filter bar is still sidebar, not horizontal)
- 29-D: Radar click-to-lock → lockedKey state + default panel + subscribe CTA all implemented ✓
- 29-E: All Domains toggle → implemented with visual card ✓
- 29-F: Dead Workbench files → all 9 deleted ✓; signals page now shows info message ✓
- 29-G: Explicit transaction → NOT done. approve_topic still uses bare db.commit() without try/except/rollback.

## REMAINING for Prompt 30

1. **C1 (partial):** Fix API_BASE port mismatch in page.tsx (use lib/api.ts import or fix default to 8100)
2. **C3:** Radar Preview still fetches `status=selected` — should fetch `is_published=true` or use the public endpoint
3. **H1:** Subscribe Wizard dark theme — needs full restyle to match site palette
4. **H2 (partial):** Add a real value proposition / hero statement above the radar
5. **H3:** Transform Published Briefings into a conversion-driving section or remove
6. **H4:** Add pre-submit review/summary before final subscribe click
7. **H5:** Handle 409 duplicate email with friendly message and recovery path
8. **M1:** Update operational runbook to reflect current architecture
9. **M2:** Consolidate API_BASE to use shared lib/api.ts
10. **29-G:** Explicit transaction on topic approval (still not implemented)

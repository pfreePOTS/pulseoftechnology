# Comprehensive Remaining Gaps: Post-Review Implementation Prompts

## Status Summary

This document cross-references every recommendation from the CEO Review, Design Review (deep-dive), and Eng Review against the current `dev` branch as of this commit. Items marked DONE are already implemented. Status table re-validated **2026-08-05** — former REMAINING admin/radar UX rows are done or superseded (see [`docs/testing/active-bugs.md`](../testing/active-bugs.md) stale-doc notes). The sequenced prompts below are historical implementation guides, not an open backlog.

### From Prompt 27 (Personalization & Workbench)

| # | Item | Status |
|---|------|--------|
| 27-1 | `persona_impacts` column on Article model | **DONE** — `article.py` line 38 |
| 27-2 | `GET /api/roles` public endpoint | **DONE** — `public.py` line 82 |
| 27-3 | `PUT /api/admin/subscribers/{id}/role` endpoint | **DONE** — `admin.py` line 799 |
| 27-4 | Subscribe Wizard captures `role_id` | **DONE** — `SubscribeWizard.tsx` posts `role_id` |
| 27-5 | HubSpot sync includes `pulse_role` | **DONE** — `hubspot_sync.py` line 64 |
| 27-6 | Admin Subscribers page shows/edits Role | **DONE** — `subscribers/page.tsx` has role dropdown |
| 27-7 | AI generates `persona_impacts` per role | **DONE** — `ai_service.py` `_SUMMARIZE_NODE_SYSTEM_PERSONA` |
| 27-8 | Newsletter uses `persona_impacts` for role | **DONE** — `email_service.py` `_article_why_for_subscriber` |
| 27-9 | Unified Marketer's Workbench (4-tab wizard) | **SUPERSEDED** by Prompt 28's 4-page pipeline |

### From Prompt 28 (Pipeline Restructure)

| # | Item | Status |
|---|------|--------|
| 28-1 | Raw Research page at `/admin/research` | **DONE** — dense table, pagination, status filter |
| 28-2 | Trend Discovery merges signals inline | **DONE** — velocity, acceleration, rationale, AI analyze, approve all on `/admin` |
| 28-3 | Industry Analysis page at `/admin/analysis` | **DONE** (re-checked 2026-08-05) — spreadsheet grid |
| 28-4 | Sidebar nav updated to 1-2-3-4 pipeline | **DONE** — `layout.tsx` lines 11-14 |
| 28-5 | Transaction safety on approve | **DONE enough** (2026-08-05) — try/`commit`/`rollback` on `approve_topic`; explicit `begin()` not required |
| 28-6 | Signal dedup uses latest by `max(id)` | **DONE** — `admin.py` line 251 (uses `max(id)` subquery) |
| 28-7 | Pagination on raw articles | **DONE** — `limit`/`offset` with 200 default |
| 28-8 | Null-safe velocity display | **DONE** — `fmtOneDecimal` returns "—" for null |
| 28-9 | Industry Analysis as spreadsheet grid | **DONE** (2026-08-05) — CSS grid spreadsheet on `/admin/analysis` |
| 28-10 | Signal rationale truncation | **DONE** (2026-08-05) — `line-clamp-2` on Trend Discovery |

### From Design Review (Deep-Dive)

| # | Item | Status |
|---|------|--------|
| DR-1 | Collection as dense table | **DONE** |
| DR-2 | Trend Discovery as master-detail split pane | **DONE** (2026-08-05) — detail drawer on `/admin` |
| DR-3 | Industry Analysis as spreadsheet grid | **DONE** (2026-08-05) — same as 28-9 |
| DR-4 | Newsletter preview: horizontal control bar + auto-refresh | **DONE** (2026-08-05) — `NewsletterSandboxPanel` |
| DR-5 | Publishing page includes radar publish controls | **DONE** (2026-08-05) — `/admin/publishing` + `RadarPublishingSection` |
| DR-6 | Radar click-to-lock stars | **DONE** (2026-08-05) — `lockedKey` in `RadarChart.tsx` |
| DR-7 | Radar default panel content | **DONE** (2026-08-05) — `RadarDefaultPanel` intro + Top 3 |
| DR-8 | Radar subscribe CTA in tooltip | **DONE** (2026-08-05) — “Get briefings on {topic} →” |
| DR-9 | Subscribe Wizard "None selected = All" visual fix | **SUPERSEDED** (2026-08-05) — requires ≥1 domain; empty≠all |

### From Eng Review

| # | Item | Status |
|---|------|--------|
| ER-1 | Explicit transaction block on approve | **DONE enough** (2026-08-05) — see 28-5 |
| ER-2 | Signal dedup defensive query | **DONE** |
| ER-3 | Pagination on articles | **DONE** |
| ER-4 | Null-safe velocity | **DONE** |

### Cleanup

| # | Item | Status |
|---|------|--------|
| CL-1 | Remove 9 unused `Workbench*.tsx` files | **DONE** (2026-08-05) — no `Workbench*.tsx` in tree |
| CL-2 | Remove or redirect `/admin/signals` | **DONE** (2026-08-05) — merge notice + link to `/admin` |
| CL-3 | Consolidate standalone Radar Preview into Publishing | **WONTFIX / intentional** (2026-08-05) — Publishing = toggles; Radar Preview = chart modes |

---

## Prompt 29-A: Industry Analysis Spreadsheet Grid

### Context
The current `/admin/analysis` page (`frontend/src/app/admin/analysis/page.tsx`) renders approved topics as expandable accordion cards. Inside each accordion, industries are listed with range sliders for Impact and Risk. This is too slow for 10+ topics across 20 industries.

### Objective
Replace the accordion + slider layout with a dense, spreadsheet-style CSS Grid where rows are Topics and columns are Industries.

### Files to Modify
- `frontend/src/app/admin/analysis/page.tsx` (rewrite)

### Changes

1. **Remove the accordion pattern entirely.** Do not use `expanded` state or collapsible cards.

2. **Build a master grid layout.** The page should render a single scrollable grid:
   - **Row headers (left column, sticky):** Topic name + domain pill + urgency badge.
   - **Column headers (top row, sticky):** Industry names from the `INDUSTRY_OPTIONS` constant.
   - **Each cell:** A compact inline editor showing:
     - Adoption state as a small `<select>` dropdown (not a full-width one).
     - Impact score as a number input (type="number", min=1, max=10, step=0.1) — NOT a slider.
     - Risk level as a number input (same constraints).
     - A small colored dot or background tint based on adoption state (heat-map style).
   - **Cell background color:** Use a subtle heat-map gradient. Higher impact = warmer color (e.g., `bg-red-500/10` for 9-10, `bg-amber-500/10` for 6-8, `bg-emerald-500/10` for 1-5).

3. **Keyboard navigation:** The number inputs should be tabbable so an admin can quickly tab through cells and type values.

4. **Sticky headers:** Use `position: sticky` on both the top row and the left column so the grid remains navigable when scrolling.

5. **Bulk actions row:** Below the grid, keep the existing "AI Suggest" and "Save" buttons, but make them operate on the currently visible topics (batch save all dirty cells).

6. **Empty industry cells:** If a topic has no position for a given industry, show a faded "+" button that adds a default row on click.

7. **Remove industry from topic:** Show a small "×" icon in the cell corner that removes that industry position.

8. **Persona impacts sub-tab:** Add a tab toggle at the top of the page: "Industry Positions" (default) | "Persona Impacts". The Persona Impacts tab shows a read-only grid of topics × roles, displaying the `persona_impacts` text from each topic's articles. This is informational only — the AI generates these, the admin reviews them here.

### CSS Approach
Use CSS Grid with `grid-template-columns: 240px repeat(N, minmax(160px, 1fr))` where N is the number of industries. Use `overflow-x: auto` on the container. Apply `sticky` positioning to the first column and header row.

### Validation
- [ ] The page loads all approved topics in a single grid view (no accordions).
- [ ] An admin can tab through Impact/Risk number inputs across industries.
- [ ] Heat-map coloring updates live as values change.
- [ ] "AI Suggest" populates cells for a topic without reloading the page.
- [ ] Save persists all dirty cells via `PUT /api/admin/topics/{id}`.
- [ ] The grid handles 20 topics × 10 industries without horizontal scroll issues.

---

## Prompt 29-B: Trend Discovery Detail Drawer

### Context
The current Trend Discovery page (`frontend/src/app/admin/page.tsx`) renders topics in a flat table. The design review recommended a master-detail split pane where clicking a topic opens a right-side drawer showing the AI rationale and supporting articles.

### Objective
Add a slide-out detail drawer to the Trend Discovery page.

### Files to Modify
- `frontend/src/app/admin/page.tsx`

### Changes

1. **Add a detail drawer state.** When the admin clicks a topic row (not the action buttons), set `selectedTopicId` state.

2. **Fetch topic detail.** When `selectedTopicId` changes, fetch `GET /api/admin/topics/{id}` (which returns `TopicDetail` including `articles[]`).

3. **Render a right-side drawer panel.** The drawer should:
   - Slide in from the right (use `translate-x` transition).
   - Be 400px wide on desktop, full-width on mobile.
   - Show: Topic name, domain, full `signal_rationale` text (untruncated), velocity sparkline or metric, and a scrollable list of supporting articles (title, source, published date, link).
   - Include a "Close" button and an "Approve" button (same action as the table button).

4. **Truncate rationale in the table.** In the main table, truncate `signal_rationale` to 2 lines using `line-clamp-2` CSS. The full text is visible in the drawer.

5. **Visual feedback.** The selected row in the table should have a highlighted left border (e.g., `border-l-2 border-indigo-500`).

6. **Clicking outside the drawer or pressing Escape should close it.**

### Validation
- [ ] Clicking a topic row opens the detail drawer with full rationale and articles.
- [ ] Rationale in the main table is truncated to 2 lines.
- [ ] The drawer closes on Escape or clicking outside.
- [ ] Approve from the drawer works and refreshes the table.

---

## Prompt 29-C: Publishing Page — Radar Controls + Newsletter Redesign

### Context
The current Step 4 "Publishing" page (`/admin/newsletter`) only renders `NewsletterSandboxPanel` — a newsletter preview with a left sidebar for filters. It is missing:
1. Radar publish controls (toggle topics on/off the public radar).
2. The newsletter preview uses a narrow left rail for controls and requires manual refresh.

### Objective
Make the Publishing page a complete launch control center with both radar publishing and newsletter preview.

### Files to Modify
- `frontend/src/app/admin/newsletter/page.tsx` (rewrite)
- `frontend/src/components/admin/NewsletterSandboxPanel.tsx` (refactor)

### Changes

#### Part 1: Add Radar Publish Controls

1. **Split the page into two sections.** Top section: "Radar Publishing". Bottom section: "Newsletter Preview".

2. **Radar Publishing section:**
   - Fetch approved topics from `GET /api/admin/topics?status=selected`.
   - Render a compact table with columns: Domain, Topic Name, Adoption State, and a toggle switch for `is_published`.
   - Toggling calls `POST /api/admin/topics/{id}/publish` or `POST /api/admin/topics/{id}/unpublish`.
   - Add a "Publish All" button that publishes all approved topics at once.
   - Add a "Send Newsletter" button that triggers `POST /api/admin/jobs/newsletter`.

3. **Visual divider** between the two sections (a horizontal rule or section header).

#### Part 2: Redesign Newsletter Preview Controls

4. **Move controls from left rail to horizontal top bar.** Replace the current `<aside className="w-56">` layout in `NewsletterSandboxPanel` with a horizontal control bar above the iframe:
   - Row 1: Role dropdown | Industry dropdown | Domain checkboxes (inline, horizontal) | (auto-refreshes)
   - Row 2: Preview iframe (full width, no sidebar competing for space).

5. **Auto-refresh on filter change.** Remove the manual "Refresh preview" button. Instead, add a `useEffect` that calls `loadPreview` whenever `industry`, `selectedDomains`, or `selectedRoleId` changes. Debounce with 300ms to avoid rapid-fire requests.

6. **Increase iframe height** to at least 600px.

### Validation
- [ ] The Publishing page shows both radar toggles and newsletter preview.
- [ ] Toggling a topic's publish state updates immediately.
- [ ] Changing any filter (role, industry, domain) auto-refreshes the newsletter preview.
- [ ] The preview iframe takes full page width (no left sidebar).
- [ ] "Send Newsletter" triggers the job and shows a success confirmation.

---

## Prompt 29-D: Public Radar — Click-to-Lock, Default Panel, Subscribe CTA

### Context
The public radar (`frontend/src/components/RadarChart.tsx`) currently uses hover-only interaction. On mobile, hover doesn't exist. The side panel shows "Hover a star" when nothing is selected.

### Objective
Add click-to-lock interaction, meaningful default panel content, and a subscribe CTA.

### Files to Modify
- `frontend/src/components/RadarChart.tsx`
- `frontend/src/components/RadarSection.tsx`

### Changes

1. **Click-to-lock state.** Add a `lockedKey` state alongside the existing `hoveredKey`:
   - Clicking a star sets `lockedKey` to that star's key.
   - When `lockedKey` is set, the tooltip panel stays open regardless of hover.
   - Clicking the same star again (or clicking empty space) clears `lockedKey`.
   - Hovering a different star while locked shows a temporary preview but returns to the locked star on mouse leave.
   - The resolved tooltip is: `lockedKey ?? hoveredKey`.

2. **Default panel content.** When no star is selected or hovered, instead of "Hover a star", show:
   - A brief intro: "The PulseOne Technology Radar tracks the signals that matter most to your business."
   - If topics are loaded, show a "Top 3 Highest Impact" mini-list (top 3 by urgency_score) with name, domain pill, and urgency badge.
   - A "Subscribe for personalized briefings" button that scrolls to the subscribe section (use `document.getElementById('subscribe')?.scrollIntoView()`).

3. **Subscribe CTA in tooltip.** At the bottom of `RadarTooltipPanel`, add a link:
   - Text: "Get briefings on {topic.name} →"
   - On click: scroll to the subscribe section and (if possible) pre-select the topic's domain in the wizard.

4. **Mobile support.** On touch devices, the first tap should act as both hover and lock (since there's no hover event). Use `onPointerDown` instead of separate `onMouseEnter`/`onClick` handlers, or detect touch via `'ontouchstart' in window`.

### Validation
- [ ] Clicking a star locks the panel open; clicking again unlocks.
- [ ] Default panel shows intro text and top-3 list when nothing is selected.
- [ ] "Subscribe" CTA in tooltip scrolls to the subscribe section.
- [ ] On mobile (or touch simulation), tapping a star shows the panel.

---

## Prompt 29-E: Subscribe Wizard — "All Domains" Visual Fix

### Context
The Subscribe Wizard's final step (Domains) allows selecting zero domains. The UI says "choose any number" but visually, having nothing selected looks like an error or incomplete form.

### Objective
Make the "none selected = all domains" behavior visually clear.

### Files to Modify
- `frontend/src/components/SubscribeWizard.tsx`

### Changes

1. **Add an "All Domains" toggle card** at the top of the domain grid. It should be visually distinct (e.g., outlined, with a checkmark icon).

2. **Default state:** "All Domains" is selected on load. The individual domain cards are dimmed/unselected.

3. **Selecting any individual domain** automatically deselects "All Domains" and highlights only the chosen domains.

4. **Deselecting all individual domains** automatically re-selects "All Domains".

5. **Submit behavior:** When "All Domains" is active, send `domains: null` (current behavior for empty array). When specific domains are selected, send the array.

6. **Visual clarity:** The "All Domains" card should say "All Domains — get the full briefing" and use a slightly different color (e.g., indigo outline instead of gray).

### Validation
- [ ] On load, "All Domains" card is selected and individual cards are dimmed.
- [ ] Selecting a specific domain deselects "All Domains".
- [ ] Deselecting all specific domains re-selects "All Domains".
- [ ] Submitting with "All Domains" sends `domains: null`.

---

## Prompt 29-F: Cleanup — Remove Dead Code and Stale Routes

### Context
The codebase contains 9 unused `Workbench*.tsx` components and a stale `/admin/signals` redirect page. These are leftovers from the old 7-step workbench architecture that has been replaced by the 4-step pipeline.

### Objective
Remove dead code and consolidate stale routes.

### Files to Delete
- `frontend/src/components/admin/WorkbenchImpactTab.tsx`
- `frontend/src/components/admin/WorkbenchNewsletterPreviewTab.tsx`
- `frontend/src/components/admin/WorkbenchPositioningTab.tsx`
- `frontend/src/components/admin/WorkbenchPreviewPublishTab.tsx`
- `frontend/src/components/admin/WorkbenchPromotionTab.tsx`
- `frontend/src/components/admin/WorkbenchRadarPublishTab.tsx`
- `frontend/src/components/admin/WorkbenchResearchTab.tsx`
- `frontend/src/components/admin/WorkbenchSelectionTab.tsx`
- `frontend/src/components/admin/WorkbenchSignalsTab.tsx`

### Files to Modify
- `frontend/src/app/admin/signals/page.tsx` — Replace the redirect with a simple page that says "Signals have been merged into Trend Discovery" with a link to `/admin`. Or delete the file entirely if the route is not linked anywhere.

### Changes

1. **Verify no imports exist** for any of the Workbench files before deleting. Run: `grep -rn "Workbench" frontend/src/ --include="*.tsx" --include="*.ts" | grep import`. If any imports are found, remove the import and the usage.

2. **Delete the 9 files listed above.**

3. **Update or delete `/admin/signals/page.tsx`:** Change the redirect from `/admin?step=signals` to `/admin` (the new Trend Discovery page), or delete the file.

4. **Verify the standalone Radar Preview page** (`/admin/radar-preview/page.tsx`) is still useful. If radar publish controls are now in the Publishing page (Prompt 29-C), consider adding a note at the top of the Radar Preview page: "This is a read-only preview. To publish topics to the radar, go to Step 4: Publishing."

### Validation
- [ ] No TypeScript compilation errors after deletion.
- [ ] No broken imports or references.
- [ ] `/admin/signals` either redirects to `/admin` or is removed.
- [ ] The app builds successfully: `pnpm build` passes.

---

## Prompt 29-G: Backend — Explicit Transaction on Topic Approval

### Context
The `POST /api/admin/topics/{id}/approve` endpoint in `backend/routers/admin.py` (line 441) updates both the `Topic.status` and the `SignalRecommendation.status` in a single `db.commit()`. While SQLAlchemy's session-level commit is technically atomic, the eng review recommends an explicit transaction block for clarity and safety.

### Objective
Wrap the approve operation in an explicit `db.begin()` block.

### Files to Modify
- `backend/routers/admin.py`

### Changes

1. **Wrap the approve logic in a `with db.begin_nested():` block** (or use `db.begin()` if the session autocommit mode supports it). This makes the transaction boundary explicit:

```python
def approve_topic(topic_id: int, db: Session = Depends(get_db), ...):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status == TopicStatus.selected:
        raise HTTPException(status_code=409, detail="Topic is already approved")

    try:
        latest_signal = (
            db.query(SignalRecommendation)
            .filter(
                SignalRecommendation.topic_id == topic_id,
                SignalRecommendation.status == "pending",
            )
            .order_by(SignalRecommendation.created_at.desc())
            .first()
        )
        if latest_signal:
            topic.adoption_state = latest_signal.suggested_state
            latest_signal.status = "approved"

        topic.status = TopicStatus.selected
        db.query(Article).filter(Article.topic_id == topic_id).update(
            {"status": "published"}, synchronize_session=False
        )
        db.commit()
        db.refresh(topic)
    except Exception:
        db.rollback()
        raise

    return topic
```

2. **Also update the signal ordering** to use `created_at DESC` (currently uses `created_at.desc()` which is correct) — verify this is consistent.

### Validation
- [ ] Approving a topic with a pending signal updates both tables.
- [ ] If the article update fails, neither the topic nor the signal is committed.
- [ ] The endpoint returns the updated topic with the new adoption state.

---

## Recommended Execution Order

Run these prompts in this sequence to avoid conflicts:

| Order | Prompt | Scope | Dependencies |
|:---:|--------|-------|-------------|
| 1 | **29-G** | Backend only | None — safe to run first |
| 2 | **29-F** | Frontend cleanup | None — removes dead code |
| 3 | **29-A** | Analysis page rewrite | None |
| 4 | **29-B** | Trend Discovery drawer | None |
| 5 | **29-C** | Publishing page rewrite | None |
| 6 | **29-D** | Public radar interactions | None |
| 7 | **29-E** | Subscribe Wizard fix | None |

Prompts 29-A through 29-E are independent of each other and can be run in parallel if using multiple Cursor agents. Prompt 29-F (cleanup) should run early to reduce noise. Prompt 29-G (backend) should run first since it's the smallest and most critical for data integrity.

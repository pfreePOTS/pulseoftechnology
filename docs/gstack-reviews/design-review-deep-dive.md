# GStack Design Review: Pipeline Restructure & Public Radar

## 1. Context
We are evaluating the visual layout, cognitive load, and spatial hierarchy of the proposed 4-step admin pipeline (Collection → Trend Discovery → Industry Analysis → Publishing) against the current 7-step codebase. We are also evaluating the public-facing Radar chart and Subscribe flow.

## 2. Review Pass

### Step 1: Collection (Raw Article Firehose)
**Current State:** Missing. Raw articles are only visible if they trigger a "Signal" or are attached to an approved "Topic".
**Target State:** A firehose view of `articles` table.
**Design Score: 0/10 (Missing)**
**What a 10 looks like:** A dense, high-throughput data table (like a Bloomberg terminal or TweetDeck). It should show Source, Title, Domain, and Ingest Time. No heavy cards. It needs a toggle for "Processed by AI" vs "Raw".
**Recommendation:** Build as a compact list view. Do not use the heavy rounded cards from the Signals tab.

### Step 2: Trend Discovery (Merging Signals & Research)
**Current State:** Split across `WorkbenchSignalsTab` (cards with velocity) and `WorkbenchResearchTab` (table with merge modal).
**Target State:** One unified screen where operators see AI-clustered topics, their velocity, and can "Watch" them.
**Design Score: 4/10**
**What a 10 looks like:** A master-detail layout. The left pane is a sortable list of Topics with inline sparklines for velocity. Clicking a topic opens a right-side drawer showing the AI rationale (from Signals) and the supporting articles. This prevents the "accordion within accordion" feel of the current design.
**Recommendation:** Abandon the accordion cards. Move to a two-pane split view (List on left, Details/Rationale on right).

### Step 3: Industry Analysis (Impact & Positioning)
**Current State:** Deeply nested accordions in `WorkbenchImpactTab` and separate trend panels in `WorkbenchPositioningTab`.
**Target State:** A unified view to set risk/impact per industry and review persona translation.
**Design Score: 3/10**
**What a 10 looks like:** A matrix or grid layout. Rows are Topics, Columns are Industries. Instead of sliders hidden inside accordions, use a dense heat-map style grid where the operator can quickly tab through and type numbers (1-10) for Impact/Risk, similar to a spreadsheet. Persona impacts should be a separate sub-tab within this step, not crammed onto the same screen.
**Recommendation:** Rebuild as a data grid (CSS Grid or `ag-grid` style) for rapid data entry. The current slider UI is too slow for 10 industries × 20 topics.

### Step 4: Publishing (Newsletter & Radar)
**Current State:** `WorkbenchPreviewPublishTab` combines a heavy newsletter sandbox with radar publish toggles.
**Target State:** Clear separation of the final go-live actions.
**Design Score: 5/10**
**What a 10 looks like:** The screen is split horizontally. Top half: "Publish to Radar" (simple list with Live toggles). Bottom half: "Newsletter Preview". The newsletter sandbox currently has a 56px left rail which is too narrow for the 10 industry buttons. The controls need to move to a top horizontal bar so the iframe can take full width.
**Recommendation:** Redesign `NewsletterSandboxPanel`. Move the Role/Industry/Domain filters from the left rail to a top horizontal control bar. Auto-refresh the iframe when a filter changes instead of requiring a manual "Refresh" button click.

### Public Radar (`RadarChart.tsx` & `RadarSection.tsx`)
**Current State:** 1020px SVG canvas. Stars are hover-only. Side panel is empty by default.
**Design Score: 6/10**
**What a 10 looks like:**
1. **Interaction:** Stars must be clickable, not just hoverable. On mobile, hover doesn't exist. Clicking a star should "lock" the side panel open.
2. **Empty State:** The side panel shouldn't say "Hover a star" — it should show a summary of the currently filtered view (e.g., "Top 3 highest urgency signals in Technology").
3. **Conversion:** The side panel needs a CTA: "Subscribe to alerts for [Topic Name]".
4. **Subscribe Wizard:** The domains step allows "None selected" which the UI says means "All domains", but visually looks like an error. It should default to "All" selected.
**Recommendation:** Add `onClick` state to `RadarChart`. Add default summary content to the side panel. Add a subscribe deep-link to the tooltip.

## 3. Final Verdict
The current UI relies too heavily on rounded cards, accordions, and vertical stacking. For a data-heavy curation pipeline, the layout needs to shift toward high-density tables, split-panes, and horizontal control bars.

The Cursor prompt (`28-editorial-pipeline-restructure.md`) must be updated to explicitly dictate these layout patterns, CSS, and interaction patterns, otherwise the AI coder will just rearrange the existing accordion components.

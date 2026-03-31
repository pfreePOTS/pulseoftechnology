# Design Review: 4-Step Editorial Pipeline Refactor

## 1. Information Architecture (IA)
- **Score:** 9/10
- **Analysis:** The shift from a disjointed 9-item sidebar to a strict 1-2-3-4 numbered pipeline is a massive IA upgrade. It directly maps to the user's mental model.
- **Fix:** Ensure the sidebar in `layout.tsx` visually groups these 4 steps together under a "Pipeline" header, separating them from configuration pages like Sources, Roles, or Jobs.

## 2. Layout & Grid
- **Score:** 7/10
- **Analysis:** The new Industry Analysis page (Step 3) requires a master grid of all approved topics across 6 industries. A standard HTML table will become horizontally cramped and unreadable.
- **Fix:** Use a CSS Grid layout with sticky headers for the industry names, or a card-based layout per topic with inline dropdowns for the adoption states.

## 3. Typography & Hierarchy
- **Score:** 8/10
- **Analysis:** Merging the Signal rationale into the Trend Discovery table (Step 2) risks making the table rows too tall if the AI rationale is a long paragraph.
- **Fix:** The `signal_rationale` should be truncated with a "Read more" expander, or placed in a collapsible sub-row beneath the main topic row.

## 4. Interaction & States
- **Score:** 8/10
- **Analysis:** The plan calls for inline editing of adoption states on the Industry Analysis page.
- **Fix:** Inline edits must have immediate visual feedback (e.g., a spinner or color flash) to indicate successful saving, since there is no global "Save" button for the grid.

## 5. Visual Polish
- **Score:** 9/10
- **Analysis:** The existing dark mode palette (indigo, gray, slate) is solid.
- **Fix:** For the new velocity/acceleration metrics in the Trend Discovery table, use a heat-map color scale (e.g., red for high acceleration, yellow for medium) to make the trending nature immediately obvious.

## Overall Verdict
**CLEARED.** Initial Score: 7/10 → Overall Score: 8.5/10. 
*Proceeding to Eng Review.*

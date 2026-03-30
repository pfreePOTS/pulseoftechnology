# Prompt 18: Radar Scale-Up and Newsletter Summary Formatting

This prompt increases the visual size of the radar and its stars, removes unnecessary toggles, and ensures the "What is it" and "Why it matters" format is strictly applied in the newsletter.

## 1. Scale Up the Radar and Stars

**Context:** The radar is currently too small on desktop screens, and the stars are difficult to click. We need to scale up the SVG canvas, the coordinate system, and the star paths.

**Instructions for Cursor:**
1.  **Update `frontend/src/components/RadarChart.tsx`**:
    *   Change `SIZE` from `680` to `1000`.
    *   Change `CX` and `CY` to `500`.
    *   Change `MAX_R` from `175` to `340`.
    *   In the `starPath` function definition, change the defaults: `outerR = 14, innerR = 6`.
    *   In the `<path>` element for the star, update the arguments to match the new size: `d={starPath(pt.x, pt.y, 14, 6)}`.
    *   In the `<circle>` element for the `starGlow` filter, increase the radius `r` from `14` to `24`.
    *   Increase the font size of the adoption axes labels (the pill labels) from `10.5` to `13`, and adjust `approxW` accordingly (e.g., `fontSize = 13`).

## 2. Remove Label Toggle

**Context:** The "Show topic names" toggle (sometimes referred to as "sort by title") is no longer needed on the radar view.

**Instructions for Cursor:**
1.  **Update `frontend/src/components/RadarSection.tsx`**:
    *   Remove the "Show topic names" checkbox/toggle from the control bar.
    *   Remove the `showLabels` state if it exists.
2.  **Update `frontend/src/components/RadarChart.tsx`**:
    *   Remove the code that renders the text labels next to the stars. The tooltip is sufficient for identifying stars.

## 3. Explicit "What is it" and "Why it matters" in Newsletter

**Context:** The newsletter needs to explicitly label "What is it" and "Why it matters" for both the Topics and the Articles.

**Instructions for Cursor:**
1.  **Update `backend/models/topic.py`**:
    *   Add `what_is_it: Mapped[str | None] = mapped_column(Text, nullable=True)`
    *   Add `why_it_matters: Mapped[str | None] = mapped_column(Text, nullable=True)`
2.  **Update `backend/services/ai_service.py`**:
    *   In `_SUMMARIZE_SYSTEM`, ensure the AI is instructed to return `what_is_it` and `why_it_matters` for the topic summary, and save those to the Topic model when creating/updating topics.
3.  **Update `backend/services/email_service.py`**:
    *   Update `_TOPIC_BLOCK` to explicitly render:
        ```html
        <p><strong>What is it:</strong> {what_is_it}</p>
        <p><strong>Why it matters:</strong> {why_it_matters}</p>
        ```
        instead of just `{summary}`.
    *   Ensure `_ARTICLE_BLOCK` also explicitly renders these labels for each article.
4.  **Update `backend/seed_topics.py`**:
    *   Update the seed data to include `what_is_it` and `why_it_matters` strings for the 8 core topics, so the public radar and sandbox have immediate data to display.

## End-to-End Testing
1. Run database migrations to add the new columns to the `topics` table.
2. Run `python -m backend.seed_topics` to populate the new fields.
3. Open the public radar (`/`) and verify the radar is significantly larger and stars are easier to see/hover.
4. Open the Newsletter Simulation Sandbox, run a simulation, and verify the newsletter explicitly prints "What is it:" and "Why it matters:" for both the section headers (Topics) and the links (Articles).

# CEO Review: 4-Step Editorial Pipeline Refactor

**Mode:** HOLD SCOPE (The user wants to clarify the existing intended pipeline, not build new features or cut existing ones).

## 1. Scope & Strategy Alignment
**Premise:** The admin UI currently blurs raw article ingestion, topic curation, and signal intelligence. The goal is to restructure the admin interface into a strict 4-step pipeline: (1) Raw Research, (2) Trend Discovery (Topics + Signals), (3) Industry Analysis, and (4) Publishing.

**Strategic Assessment:**
- **Is this the right problem?** Yes. The current UI is disjointed, forcing the user to approve a topic on one page, check its velocity on another, and adjust its industry positioning deep inside an editor. This refactor aligns the software with the mental model of the human operator.
- **Is the scope right?** Yes. We are not changing the underlying AI models, vector database, or ingestion chron jobs. We are purely refactoring the frontend views and API endpoints to surface the right data at the right time.

## 2. The Platonic Ideal
If we were building this pipeline from scratch, it would be a single linear wizard, not separate pages. However, since we are refactoring an existing Next.js App Router setup, moving to 4 distinct pages (`/admin/research`, `/admin`, `/admin/analysis`, `/admin/newsletter`) is the most pragmatic path that achieves the goal without rewriting the entire routing layer.

## 3. Complexity & Taste Calibration
- **The "Is it too complex?" check:** The plan is actually *reducing* cognitive complexity for the user by merging Signals into Trend Discovery. The only added complexity is creating a new "Raw Research" view for `Article` models, which is a simple CRUD table.
- **Taste Decision 1:** Should we keep the `SignalRecommendation` model at all, or just calculate velocity on the fly?
  - *Decision:* Keep the model. The AI rationale takes time to generate and costs money; caching it in the DB is necessary. The refactor correctly focuses on *displaying* it inline, not changing how it's stored.
- **Taste Decision 2:** Industry Analysis page vs. Topic Editor.
  - *Decision:* The plan calls for a master grid of all approved topics across all industries. This is vastly superior to the current state (clicking into each topic one by one).

## 4. Observability & Error Mapping
- **Error Map 1: Empty Raw Research.** If the ingestion job fails, the Raw Research page will be empty. We need to ensure the page clearly states "No articles ingested" rather than just a blank table.
- **Error Map 2: Missing Signals.** If the background signal scorer hasn't run, the Trend Discovery table will have blank velocity scores. The UI must handle `velocity_score: null` gracefully.

## 5. Verdict
**CLEARED.** The plan is solid, holds scope perfectly, and solves a real user pain point. No scope expansions are proposed.

*Proceeding to Design Review.*

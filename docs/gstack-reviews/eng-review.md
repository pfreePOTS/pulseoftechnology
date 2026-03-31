# Eng Review: 4-Step Editorial Pipeline Refactor

## 1. Architecture & State Management
- **Issue:** The `GET /api/admin/topics` endpoint currently returns a flat list of topics. The new design requires merging the latest `SignalRecommendation` (velocity, acceleration, rationale) into the topic list for Step 2.
- **Fix:** Update the SQLAlchemy query in `routers/admin.py` to use a `LEFT OUTER JOIN` on `SignalRecommendation` where `status == 'pending'`, or execute a secondary query and map the data in memory. The `TopicOut` Pydantic model must be updated to make these fields `Optional[float]` and `Optional[str]`.

## 2. Data Flow & Dependencies
- **Issue:** Approving a topic from the new Trend Discovery table (Step 2) must now do two things: (1) update the `Topic.status` to `approved`, and (2) update the associated `SignalRecommendation.status` to `approved` (and apply the suggested adoption state).
- **Fix:** The `POST /api/admin/topics/{id}/approve` endpoint must be wrapped in a single database transaction. If the signal update fails, the topic approval must roll back to prevent orphaned state.

## 3. Test Plan
- **Unit Test:** Mock the Pinecone response and verify that the `LEFT JOIN` correctly surfaces velocity metrics in the `GET /topics` response.
- **Integration Test:** Verify that approving a topic with a pending signal correctly updates both tables and commits the transaction.
- **E2E Test:** Verify the "Raw Research" page correctly paginates through `Article` models with `status=raw`.

## 4. Edge Cases & Failure Modes
- **Failure Mode 1:** A topic has multiple pending signals (e.g., the background job ran twice before a human reviewed it).
  - *Mitigation:* The `LEFT JOIN` must explicitly filter for the *latest* pending signal, or the `signal_scorer` must be idempotent and prevent duplicate pending signals per topic. (The existing `signal_service.py` already prevents duplicates, but the query should still order by `created_at DESC` and limit to 1).
- **Failure Mode 2:** High data volume on the Raw Research page.
  - *Mitigation:* The `GET /api/admin/articles` endpoint must implement pagination (`limit`/`offset`) from day one. Do not attempt to return all raw articles at once.

## 5. Verdict
**CLEARED.** The architecture is sound. The primary technical risk is ensuring the topic approval transaction correctly handles the signal state update.

*Autoplan Complete.*

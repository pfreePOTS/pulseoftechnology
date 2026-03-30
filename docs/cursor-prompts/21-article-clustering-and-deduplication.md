# Prompt 21: Article Clustering and Topic Deduplication

This prompt addresses the issue of "topic fragmentation" in the ingestion pipeline, where the AI creates many single-article topics with highly specific names (e.g., "Trivy GitHub Actions Breach" and "Trivy Supply Chain Attack") instead of grouping them into a broader trend.

It improves the clustering logic during ingestion and provides an admin tool to merge existing fragmented topics.

## 1. Improve AI Clustering Logic

**Context:** The current `_EVALUATE_SYSTEM` prompt asks the AI to suggest a "specific 3-5 word trend". When given a list of existing topics, it often decides the new article is slightly different and creates a new topic. We need to force it to be a "lumper" rather than a "splitter".

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Modify `_EVALUATE_SYSTEM`:
        *   Change the instruction for `suggested_topic_name` to explicitly prioritize clustering: "A broad trending topic name (2-4 words) that this article belongs to. You MUST prioritize assigning this article to one of the `Existing trending topics` provided, even if it's only a partial match. Only suggest a new topic name if the article represents a completely novel trend."
    *   Modify `process_raw_articles`:
        *   Currently, it only passes the first 40 existing topics to the AI. Update this to pass all `approved` topics and the top 50 most recent `pending` topics, sorted by article count descending. This ensures the AI sees the biggest clusters first.

## 2. Admin UI: Topic Merge Tool

**Context:** The admin needs a way to manually clean up the existing fragmented topics shown in the "Trending Topics" tab.

**Instructions for Cursor:**
1.  **Create `backend/routers/admin.py` Merge Endpoint**:
    *   Add `POST /api/admin/topics/merge`.
    *   Schema: `TopicMergeRequest` with `source_topic_ids: list[int]` and `target_topic_id: int`.
    *   Logic:
        *   Find all articles belonging to `source_topic_ids`.
        *   Update their `topic_id` to `target_topic_id`.
        *   Recalculate the `urgency_score` of the `target_topic_id` (e.g., max of all merged topics).
        *   Delete the `source_topic_ids` from the database.
2.  **Update `frontend/src/app/admin/page.tsx` (Curation Dashboard)**:
    *   Add a multi-select checkbox to the left of each topic row in the "Trending Topics" table.
    *   When multiple topics are selected, show a "Merge Selected" button at the top of the table.
    *   Clicking "Merge Selected" opens a modal:
        *   Lists the selected topics.
        *   Provides a dropdown to select which of the selected topics should be the "Target" (the name that is kept).
        *   Alternatively, allow the user to type a brand new topic name for the merged cluster.
        *   On confirm, call the `POST /api/admin/topics/merge` endpoint.
        *   Refresh the topic list.

## 3. Background Deduplication (Optional/Future-proofing)

**Context:** To prevent the database from filling up with orphaned topics, we need a cleanup mechanism.

**Instructions for Cursor:**
1.  **Update `backend/services/signal_service.py` (or create a new cleanup service)**:
    *   Create a function `cleanup_empty_topics(db: Session)`:
        *   Find all topics where `status == 'pending'` and `article_count == 0` (which can happen after merges or if articles are deleted).
        *   Delete them.
    *   Add this to the daily scheduler in `backend/scheduler.py`.

## End-to-End Testing
1. Run the updated ingestion pipeline on new articles. Verify that articles are more aggressively grouped into existing topics.
2. Go to the Admin Curation Dashboard -> Trending Topics.
3. Select 2 or 3 similar topics (e.g., the various "Trivy" security articles).
4. Click "Merge Selected", choose a primary name, and confirm.
5. Verify the selected topics are combined into one, the article count increases, and the old topics disappear.

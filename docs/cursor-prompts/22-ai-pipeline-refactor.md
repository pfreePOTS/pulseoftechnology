# Prompt 22: AI Pipeline Refactor (Agentic Graph)

## Context
The current AI article evaluation pipeline in `backend/services/ai_service.py` uses a single monolithic prompt (`_EVALUATE_SYSTEM`) to perform gating, classification, scoring, clustering, and summarization all at once. This causes "attention dilution," leading to hallucinated topic names, poor clustering (e.g., grouping by broad domain rather than specific trend), and fragmented single-article topics.

We need to refactor this monolithic process into a multi-step agentic graph where each node is specialized for a single task.

## Instructions for Cursor

1. **Refactor `backend/services/ai_service.py`**
   Break down the `evaluate_article` and `process_raw_articles` logic into a multi-step pipeline (graph) using separate prompts and models for each step:

   *   **Node 1: Gate (Claude Haiku)**
       *   **Input:** Article content.
       *   **Task:** Determine if the article is relevant to C-level executives (CEOs, CTOs, CISOs, CFOs).
       *   **Output:** JSON `{ "relevant": true | false }`.
       *   *If false, halt processing for this article.*

   *   **Node 2: Classify (Claude Haiku)**
       *   **Input:** Article content.
       *   **Task:** Determine the primary domain (AI, Security, Cloud, Finance, Leadership, or Other) and extract 2-4 short tags.
       *   **Output:** JSON `{ "domain": "...", "tags": ["...", "..."] }`.

   *   **Node 3: Score (Claude Haiku)**
       *   **Input:** Article content.
       *   **Task:** Assign an urgency score from 1 (low) to 10 (high) reflecting how time-sensitive the topic is, and provide a one-sentence reason.
       *   **Output:** JSON `{ "urgency_score": 8.5, "reason": "..." }`.

   *   **Node 4: Cluster (Claude Sonnet)**
       *   **Input:** Article content + List of existing topic names.
       *   **Task:** Assign the article to a specific trending topic name (2-4 words). You MUST prioritize assigning to an existing topic if it's a partial match. Only suggest a new topic name if it represents a completely novel trend.
       *   **Output:** JSON `{ "suggested_topic_name": "..." }`.

   *   **Node 5: Summarize (Claude Sonnet)**
       *   **Input:** Article content.
       *   **Task:** Write a plain-language "what is it" sentence and a "why it matters" sentence for business impact.
       *   **Output:** JSON `{ "what_is_it": "...", "why_it_matters": "..." }`.

2. **Update `process_raw_articles` Integration**
   *   Wire these nodes together sequentially.
   *   Ensure the clustering node (Node 4) receives the prioritized list of existing topic names (approved first, then top pending).
   *   Save all extracted fields (`domain`, `urgency_score`, `topic_name`, `what_is_it`, `why_it_matters`, `tags`) to the database as before.
   *   Ensure proper error handling at each node so that if one step fails, the article can be marked for retry or skipped gracefully.

## End-to-End Testing
1. Run the ingestion pipeline on new raw articles.
2. Verify in the logs that the multi-step graph executes sequentially.
3. Check the Curation Dashboard to confirm that articles are more accurately clustered into existing topics rather than fragmented.

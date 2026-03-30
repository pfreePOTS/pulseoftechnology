# Prompt 24: Signal Intelligence Vector Architecture

## Context
Prompt 20 and the design document (`docs/architecture/signal-intelligence-design.md`) specified a predictive signal detection system powered by a vector database (Pinecone) and semantic embeddings (OpenAI). 
However, the current implementation in `backend/services/signal_service.py` relies solely on basic SQL article counts (velocity/acceleration) and lacks any vector or embedding infrastructure.

We need to implement the missing vector pipeline to enable true semantic cluster analysis for trend detection.

## Instructions for Cursor

1. **Setup Vector Infrastructure**
   *   Install required packages: `pip install pinecone-client openai`.
   *   Update `backend/config.py` to include `pinecone_api_key`, `pinecone_environment`, `pinecone_index_name`, and `openai_api_key`.
   *   Create a new service `backend/services/vector_service.py` to handle interactions with OpenAI (for `text-embedding-3-small`) and Pinecone.

2. **Update Ingestion Pipeline (`backend/services/ingestion.py`)**
   *   During or immediately after `process_raw_articles`, generate embeddings for newly processed articles.
   *   Concatenate the article's `summary` (or `content` if no summary) and `what_is_it`.
   *   Upsert the vector into Pinecone. Include metadata: `article_id`, `published_at` (as a timestamp or ISO string), `topic_id`, and `domain`.

3. **Refactor Signal Scorer (`backend/services/signal_service.py`)**
   *   Update `run_signal_scorer()` to utilize the vector database.
   *   Instead of just counting articles per topic in PostgreSQL, use Pinecone to perform semantic cluster analysis.
   *   Query Pinecone for articles within the last 7 days to find dense semantic clusters.
   *   Calculate Velocity and Acceleration based on these semantic clusters rather than rigid topic assignments.
   *   If a cluster crosses the thresholds (`VELOCITY_THRESHOLD = 3`, `ACCELERATION_THRESHOLD = 1.5`), trigger the AI recommendation logic (Claude Sonnet) to evaluate if the adoption state should be upgraded.
   *   Store the recommendation in the `SignalRecommendation` table as before.

## End-to-End Testing
1. Ensure Pinecone and OpenAI API keys are configured in the `.env` file.
2. Run the ingestion job (`POST /api/admin/jobs/ingest`) and verify in the logs that embeddings are generated and upserted to Pinecone.
3. Run the signal scorer job (`POST /api/admin/jobs/signals`).
4. Verify that the scorer queries Pinecone, calculates metrics based on semantic clusters, and generates recommendations.
5. Check the Admin Signals UI to confirm the new recommendations appear correctly.

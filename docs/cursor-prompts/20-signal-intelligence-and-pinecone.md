# Prompt 20: Signal Intelligence & Pinecone Integration

This prompt implements a predictive trend detection system using Pinecone vector embeddings and velocity scoring, with a human-in-the-loop approval workflow for topic adoption state changes.

## Prerequisites
- Create a Pinecone account and get an API key.
- Create an OpenAI account and get an API key (for embeddings).
- Add to `.env`: `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` (e.g., "pulseone-signals"), `OPENAI_API_KEY`.
- Install dependencies: `pip install pinecone-client openai`.

## 1. Data Model: Signal Recommendations

**Context:** We need a table to store AI-generated recommendations for topic state changes.

**Instructions for Cursor:**
1.  **Create `backend/models/signal.py`**:
    *   Create `SignalRecommendation` model.
    *   Fields: `id` (UUID), `topic_id` (UUID, foreign key), `suggested_state` (String), `rationale` (Text), `velocity_score` (Float), `acceleration_score` (Float), `status` (String: 'pending', 'approved', 'rejected'), `created_at` (DateTime).
2.  **Update `backend/models/__init__.py`**:
    *   Import `SignalRecommendation`.
3.  **Update `backend/routers/admin.py`**:
    *   Add endpoints for `/api/admin/signals`: `GET` (list pending), `POST /{id}/approve`, `POST /{id}/reject`.

## 2. The Vector Pipeline

**Context:** Articles need to be embedded and stored in Pinecone during ingestion.

**Instructions for Cursor:**
1.  **Create `backend/services/vector_service.py`**:
    *   Initialize Pinecone client and OpenAI client.
    *   Create function `embed_text(text: str) -> list[float]` using `text-embedding-3-small`.
    *   Create function `upsert_article(article: Article)`:
        *   Text to embed: `f"{article.title}. {article.summary} {article.what_is_it}"`
        *   Metadata: `{"article_id": str(article.id), "topic_id": str(article.topic_id), "published_at": article.published_date.isoformat()}`
        *   Upsert to Pinecone index.
2.  **Update `backend/services/ingestion.py`**:
    *   In the article processing loop, after an article is successfully saved and evaluated by AI, call `upsert_article(article)`.

## 3. The Signal Scorer

**Context:** A scheduled job that calculates velocity and generates recommendations.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   Create function `evaluate_signal(topic: Topic, recent_articles: list[Article]) -> dict`:
        *   Prompt Claude 3.7 Sonnet with the topic details and the summaries of the recent articles.
        *   Ask: "Based on this surge in reporting, should this topic's adoption state be upgraded? Return JSON with 'recommend_change' (boolean), 'suggested_state' (string), and 'rationale' (string)."
2.  **Create `backend/services/signal_service.py`**:
    *   Create function `run_signal_scorer(db: Session)`:
        *   For each approved Topic:
            *   Calculate `velocity` (count of articles in last 7 days) and `acceleration` (velocity / count of articles in previous 7 days).
            *   If `velocity > 10` and `acceleration > 1.5` (example thresholds):
                *   Call `evaluate_signal()`.
                *   If AI recommends a change, create a `SignalRecommendation` record in the database.
3.  **Update `backend/scheduler.py`**:
    *   Add a daily job to run `run_signal_scorer`.

## 4. Admin UI: The Signals Dashboard

**Context:** A UI for the human-in-the-loop to review and approve signals.

**Instructions for Cursor:**
1.  **Create `frontend/src/app/admin/signals/page.tsx`**:
    *   Fetch pending signals from `/api/admin/signals`.
    *   Display each signal as a card: Topic Name, Suggested State, Velocity/Acceleration metrics, and the AI's Rationale.
    *   Include "Approve" and "Reject" buttons.
2.  **Update `frontend/src/app/admin/layout.tsx`**:
    *   Add "Signals" to the admin sidebar navigation.
3.  **Approve Logic (`backend/routers/admin.py`)**:
    *   When a signal is approved, update the corresponding `Topic`'s default adoption state (and optionally industry-specific states) to the `suggested_state`.
    *   Mark the signal as 'approved'.

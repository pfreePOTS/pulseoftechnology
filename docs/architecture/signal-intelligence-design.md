# Signal Intelligence Architecture: Predictive Trend Detection

This document outlines the architecture for transforming PulseOne from a static curation tool into a predictive signal intelligence platform. By leveraging vector embeddings (Pinecone) and velocity scoring, the system will detect critical mass in emerging technologies and recommend adoption state changes to human curators.

## 1. Core Concepts

### 1.1 Vector Embeddings
Every ingested article is converted into a dense vector embedding. This allows the system to understand the semantic meaning of the article, rather than just relying on keyword matching. We use these embeddings to find clusters of similar articles that indicate a growing trend, even if the authors use different terminology.

### 1.2 Velocity and Acceleration Scoring
Trend detection relies on two key metrics calculated over rolling time windows (e.g., 7 days vs previous 7 days):
*   **Velocity**: The absolute volume of highly relevant articles published about a topic within the current time window.
*   **Acceleration**: The rate of change in velocity. A sudden spike in articles (high acceleration) is a strong signal that a technology is moving from the fringes into mainstream awareness or adoption.

### 1.3 Human-in-the-Loop (HITL)
AI models are excellent at detecting patterns and suggesting state changes, but strategic business decisions require human judgment. The system will generate **Recommendations**, but a human curator must explicitly approve them before they affect the public radar.

## 2. System Components

### 2.1 The Ingestion Pipeline Upgrade
When `run_all_sources()` fetches new articles:
1.  **Embed**: The article's `summary` and `what_is_it` fields are concatenated and passed to an embedding model (e.g., OpenAI `text-embedding-3-small`).
2.  **Upsert**: The resulting vector is upserted into Pinecone. The vector metadata includes:
    *   `article_id`
    *   `published_date`
    *   `topic_id` (if assigned)
    *   `domain`

### 2.2 The Signal Scorer (Daily Cron Job)
A new scheduled task, `run_signal_scorer()`, executes daily:
1.  **Cluster Analysis**: For each approved topic, the scorer queries Pinecone for articles within the last 7 days.
2.  **Metric Calculation**: It calculates the Velocity and Acceleration for the topic.
3.  **Threshold Evaluation**: If the metrics cross predefined critical mass thresholds (e.g., > 15 articles/week AND > 50% acceleration), a signal is triggered.
4.  **AI Recommendation**: The system passes the recent article summaries to Claude, asking: *"Based on this surge in reporting, should this topic's adoption state be upgraded? If so, to what state, and why?"*
5.  **Store Recommendation**: The AI's response is stored in a new `SignalRecommendation` database table.

### 2.3 The Admin HITL Interface
A new section in the Admin Curation Dashboard called **"Signals"**:
*   Displays a queue of pending `SignalRecommendation` records.
*   Shows the Topic, the suggested new Adoption State, the AI's rationale, and the supporting metrics (Velocity/Acceleration).
*   Provides **Approve** and **Reject** buttons.
*   Approving a recommendation automatically updates the topic's `industry_positions` and logs the change.

## 3. Technology Stack
*   **Vector Database**: Pinecone (Serverless index, cosine similarity).
*   **Embedding Model**: OpenAI `text-embedding-3-small` (fast, cheap, highly effective for text clustering).
*   **LLM Evaluator**: Anthropic Claude 3.7 Sonnet (for reasoning about adoption state changes based on article clusters).
*   **Backend**: Python, SQLAlchemy, FastAPI.
*   **Frontend**: React, Tailwind, Next.js.

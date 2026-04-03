### 1. System Overview
- **Summary:** The Social Posting & Engagement module extends the Pulse of Technology backend to act as a social media growth engine. It leverages existing Pinecone vector data (curated tech articles) and OpenAI models to generate, score, and schedule algorithm-optimized content for X (Twitter) and LinkedIn.
- **Core components:** 
  - **Content Coach Engine:** AI prompt pipelines for generating hooks, threads, and replies based on user history and Pulse of Technology data.
  - **Algorithm Scorer:** A rule-based and LLM-assisted evaluation layer that predicts engagement metrics (dwell time, reply probability) before publishing.
  - **Integration Layer:** Connectors to X API v2 and LinkedIn API for posting and analytics ingestion.
  - **Social UI Dashboard:** Frontend components in the admin panel for drafting, reviewing, and scheduling posts.

### 2. Architecture
- **Frontend:** Next.js React components integrated into the existing admin dashboard. New routes for `/admin/social/drafts`, `/admin/social/analytics`, and `/admin/social/reply-guy`.
- **Backend:** FastAPI endpoints in `backend/routers/social.py`. 
- **Data layer:** PostgreSQL for storing social drafts, schedules, and historical analytics. Existing Pinecone index for factual grounding of generated content.
- **Integrations:** X API v2 (OAuth 2.0 user context) and LinkedIn API.
- **AI components:** `backend/services/social_ai_service.py` wrapping OpenAI calls for content generation and algorithm scoring.

### 3. Data Flow
1. **Ingestion:** Background jobs fetch user's past posts and engagement metrics via X/LinkedIn APIs, storing them in Postgres.
2. **Ideation:** User requests a post topic in the UI. Backend queries Pinecone for relevant Pulse of Technology articles.
3. **Generation:** `social_ai_service.py` constructs a prompt combining the user's voice profile, the retrieved articles, and platform-specific formatting rules (e.g., short hooks, no hashtags for X).
4. **Scoring:** The generated draft is passed to the Algorithm Scorer, which returns a "Banger Score" (0-100) based on predicted dwell time and reply depth.
5. **Scheduling:** User approves the draft. It is saved to Postgres with a scheduled timestamp.
6. **Publishing:** APScheduler job triggers at the scheduled time, pushing the payload to the respective social API.

### 4. Feature Breakdown

#### Feature 1: The Content Coach
- **Description:** Generates algorithm-optimized posts and threads.
- **Inputs:** Topic keywords, target persona, optional source article ID.
- **Outputs:** 3-5 post variations or a full thread structure.
- **Dependencies:** OpenAI API, Pinecone, Postgres (for user voice history).

#### Feature 2: Algorithm Scorer
- **Description:** Evaluates drafts against 2025/2026 ranking signals.
- **Inputs:** Draft text, target platform (X or LinkedIn).
- **Outputs:** Score (0-100), penalty warnings (e.g., "remove link to avoid penalty"), and improvement suggestions.
- **Dependencies:** OpenAI API (for semantic analysis of hook strength).

#### Feature 3: Reply Guy Engine
- **Description:** Surfaces high-leverage posts from industry leaders and drafts intelligent replies.
- **Inputs:** Target account handles, recent industry news.
- **Outputs:** Suggested replies optimized for "reply thread depth."
- **Dependencies:** X API v2 (for fetching target posts), OpenAI API.

### 5. Tech Stack
- **Frontend:** Next.js, Tailwind CSS, Shadcn UI (existing stack).
- **Backend:** FastAPI, SQLAlchemy, APScheduler (existing stack).
- **Infrastructure:** Docker, PostgreSQL, Pinecone (existing stack).
- **AI tools:** OpenAI API (`gpt-4.1-mini` for generation, `gpt-4.1-nano` for rapid scoring).

### 6. Agent Task Breakdown (CRITICAL)

#### Task 1: Database Schema Expansion
- **Objective:** Create models for Social Posts, Social Accounts, and Social Analytics.
- **Inputs:** This technical plan.
- **Outputs:** SQLAlchemy models in `backend/models/social.py` and Alembic migration script.
- **Files/modules:** `backend/models/social.py`, `backend/alembic/versions/`
- **Dependencies:** None.

#### Task 2: Social API Integration Layer
- **Objective:** Build clients for X API v2 and LinkedIn API to handle OAuth, posting, and analytics retrieval.
- **Inputs:** API credentials (from `.env`).
- **Outputs:** Service classes for X and LinkedIn.
- **Files/modules:** `backend/services/x_api_client.py`, `backend/services/linkedin_api_client.py`
- **Dependencies:** Task 1.

#### Task 3: AI Content Coach Service
- **Objective:** Implement the prompt engineering and OpenAI calls for post generation and algorithm scoring.
- **Inputs:** Draft text, topic context, Pulse of Technology article data.
- **Outputs:** `social_ai_service.py` with functions like `generate_banger_thread()` and `score_post_algorithm()`.
- **Files/modules:** `backend/services/social_ai_service.py`
- **Dependencies:** Existing `ai_service.py` patterns.

#### Task 4: FastAPI Routers
- **Objective:** Create REST endpoints for the frontend to interact with the social module.
- **Inputs:** Services from Tasks 2 & 3.
- **Outputs:** CRUD endpoints for drafts, generation triggers, and analytics fetching.
- **Files/modules:** `backend/routers/social.py`, `backend/main.py` (include router).
- **Dependencies:** Tasks 1, 2, 3.

#### Task 5: Frontend Dashboard UI
- **Objective:** Build the React interfaces for the Social module (Drafting, Reply Guy, Analytics).
- **Inputs:** Existing UI components.
- **Outputs:** New pages in the Next.js app.
- **Files/modules:** `frontend/app/admin/social/page.tsx`, `frontend/components/social/`
- **Dependencies:** Task 4.

### 7. Build Phases
- **MVP:** X (Twitter) integration only. Basic AI generation (Content Coach) and direct publishing.
- **Expansion:** Add LinkedIn support. Implement the Algorithm Scorer and Reply Guy Engine.
- **Scaling:** Add automated analytics ingestion, follower growth tracking, and "Brain Dump" audio transcription.

### 8. Risks
- **Technical:** X API v2 rate limits and potential pricing changes could break automated features.
- **Data:** If the AI generates "slop," the user's account will be penalized by the algorithms. The prompts must be rigorously tested for authenticity.
- **Scaling:** Polling APIs for analytics across multiple users could overwhelm background workers; requires careful batching.

### 9. Optional Enhancements
- **Chrome Extension:** Build a companion extension to allow users to capture ideas or reply directly on the X/LinkedIn web interfaces, powered by the backend AI.
- **Auto-Retweet/Engagement Loops:** Programmatic engagement with other Pulse of Technology users to boost initial "For You" placement signals.

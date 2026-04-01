# Meta-Harness Phase 1: Enhanced Logging & Core Models

## Context
We are implementing the first phase of the "Meta-Harness Self-Learning Architecture" (documented in `docs/core/11-meta-harness-self-learning.md`). The goal of this phase is to establish the foundational database models and enhance our existing `PromptLog` to capture the full execution trace of AI calls. This data is critical for the future self-learning agents to diagnose failures.

## Technology Stack
- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL

## Task 1: Create Core SQLAlchemy Models
Create a new file `backend/models/meta_harness.py` with the following SQLAlchemy models. Make sure to import them in `backend/models/__init__.py` so Alembic detects them.

1. **ExperienceDiagnosis**
   - `id`: Integer, primary key
   - `trigger_type`: String (validation_failure, human_correction, retry_fallback, pattern_detection)
   - `prompt_log_ids`: JSON (Array of IDs)
   - `agent_type`: String
   - `symptoms`: Text
   - `hypothesized_cause`: Text
   - `proposed_rule`: Text
   - `confidence`: Float
   - `status`: String (pending, promoted, rejected)
   - `promoted_skill_id`: Integer (nullable)
   - `created_at`: DateTime (default func.now())

2. **AgentSkill**
   - `id`: Integer, primary key
   - `domain`: String
   - `target_agent`: String
   - `rule_text`: Text
   - `source`: String (auto-diagnosed, developer-created, recommendation-closed)
   - `evidence_ids`: JSON (Array of PromptLog IDs)
   - `diagnosis_ids`: JSON (Array of ExperienceDiagnosis IDs)
   - `confidence`: Float (default 0.6)
   - `status`: String (active, flagged, archived) - default 'active'
   - `times_used`: Integer (default 0)
   - `times_succeeded`: Integer (default 0)
   - `success_rate`: Float (default 0.0)
   - `created_at`: DateTime (default func.now())
   - `updated_at`: DateTime (onupdate func.now())
   - `last_used_at`: DateTime (nullable)
   - `archived_at`: DateTime (nullable)
   - `archived_reason`: String (nullable)
   - `pinecone_id`: String (nullable)
   - `embedding_text`: Text (nullable)

3. **SystemRecommendation**
   - `id`: Integer, primary key
   - `category`: String
   - `title`: String
   - `description`: Text
   - `evidence_ids`: JSON
   - `suggested_change`: Text
   - `impact_assessment`: Text
   - `status`: String (default 'pending')
   - `cursor_prompt`: Text (nullable)
   - `created_at`: DateTime (default func.now())
   - `reviewed_at`: DateTime (nullable)

## Task 2: Generate Alembic Migration
Generate an Alembic migration for these new models and apply it to the development database.
`alembic revision --autogenerate -m "Add Meta-Harness models"`

## Task 3: Enhance PromptLog Model
Update the existing `PromptLog` model (likely in `backend/models/prompt_log.py` or similar) to include the following new columns:
- `full_context_trace`: JSON (nullable) - The complete AIContext object
- `active_skill_ids`: JSON (nullable) - Array of injected skill IDs
- `retry_count`: Integer (default 0)
- `feedback_signal`: String (nullable) - 'positive', 'negative', 'correction'
- `feedback_text`: Text (nullable)

Generate and apply the migration for these changes.

## Task 4: Update PromptLogService
Update the service that writes to `PromptLog` to accept and persist these new fields. Ensure that logging the `full_context_trace` is done efficiently (consider asynchronous/background tasks if it impacts the hot path of the game loop).

## Constraints & Rules
- Do NOT modify any core game logic or AI agent logic in this phase. This is strictly a data layer update.
- Ensure all JSON fields use the appropriate SQLAlchemy JSON type (or JSONB for PostgreSQL).
- Follow the existing project conventions for SQLAlchemy model definitions.

# Meta-Harness Phase 2: Skill Retrieval & Developer Learning UI

## Context
This is Phase 2 of the Meta-Harness Self-Learning Architecture (documented in `docs/core/11-meta-harness-self-learning.md`). In Phase 1, we created the foundational models and enhanced the PromptLog. In this phase, we are implementing the core retrieval and injection logic, and building the Developer Learning UI so the developer can manually create skills during development.

## Technology Stack
- Backend: Python, FastAPI, SQLAlchemy, Pinecone
- Frontend: Next.js (App Router), React, TailwindCSS

## Task 1: Create the ExperienceLedgerService
Create a new service `backend/services/experience_ledger_service.py` that handles the core skill lifecycle.
- **`create_skill`**: Accepts a domain, target_agent, rule_text, and confidence. Saves to PostgreSQL (`AgentSkill`) and upserts the embedding to Pinecone (`agent-skills` index).
- **`retrieve_skills`**: Accepts a query string, domain, and target_agent. Embeds the query, searches Pinecone, filters for active skills with confidence > 0.5, and returns the top 3 matches.

## Task 2: Implement Skill Injection in ContextAssembler
Update the `ContextAssembler` (or equivalent prompt building logic) to call `retrieve_skills` before building an agent's prompt.
- Construct the query string from the current task context.
- If skills are returned, format them under a `LESSONS FROM PRIOR EXPERIENCE:` header.
- Inject this block into the system prompt.
- **Crucial**: Ensure the injected skill IDs are passed along to the `PromptLogService` (implemented in Phase 1) so they are recorded in the `active_skill_ids` column.

## Task 3: Backend API for Developer Learning UI
Create new FastAPI endpoints in `backend/api/admin.py` (or similar admin router):
- `POST /api/admin/learn`: Accepts a natural language observation. Uses a Side Query LLM call to parse the observation and propose a structured `AgentSkill` (domain, rule, target_agent).
- `POST /api/admin/skills`: Endpoint to confirm and save a proposed skill.
- `GET /api/admin/skills`: Returns a paginated list of all skills for the admin dashboard.

## Task 4: Frontend "Learn From This" Component
Create a new reusable React component `frontend/src/components/admin/LearnFromThisButton.tsx`.
- Renders a button that opens a modal.
- The modal contains a textarea for the developer to enter a natural language observation.
- Submits to `POST /api/admin/learn`.
- Displays the proposed skill and asks for confirmation.
- On confirm, calls `POST /api/admin/skills` to save it.
- Integrate this button into at least one inner admin page (e.g., viewing an article or PromptLog entry).

## Task 5: Frontend Admin Skills Dashboard
Create a new page `frontend/src/app/admin/skills/page.tsx`.
- Displays a data table of all skills fetched from `GET /api/admin/skills`.
- Columns: Domain, Target Agent, Rule, Confidence, Success Rate, Status.
- Include a "Create New Skill" input at the top of the page that uses the same natural language parsing flow as the "Learn From This" button.

## Constraints & Rules
- Do NOT implement the autonomous ReflectorAgent or KAIROS in this phase. The only LLM call should be the Side Query in `POST /api/admin/learn` for parsing developer input.
- Ensure Pinecone operations fail gracefully (log error and continue) if the vector database is unreachable, so it doesn't crash the game loop.
- Use the existing Pinecone client patterns found in `backend/services/vector_service.py`.

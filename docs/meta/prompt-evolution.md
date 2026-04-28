# Prompt Evolution Log

*This file tracks lessons learned from previous AI coding failures.*

- **Lesson 1**: When updating the database schema, AI agents often forget to update the corresponding Pydantic models in `backend/routers/`. Future prompts must explicitly instruct the agent to update both SQLAlchemy models and Pydantic schemas.
- **Lesson 2**: When adding new fields to the frontend, AI agents often miss the TypeScript interfaces. Future prompts must explicitly require updating `frontend/src/lib/api.ts` interfaces.

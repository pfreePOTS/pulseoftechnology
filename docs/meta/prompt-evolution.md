# Prompt Evolution Changelog

This file tracks how prompts to AI tools have improved over time based on failure analysis.

## Changelog

### 2026-04-01 - Manus - Architecture Design & Implementation Prompts
*   **Failure:** Wrote implementation prompts referencing TypeScript/Prisma interfaces instead of the actual project stack.
*   **Diagnosis:** Relied on generic design documentation (which assumed a TypeScript stack) without verifying the actual codebase repository first.
*   **Fix:** Updated `interaction-rules.md` to mandate checking the actual codebase stack (Python/FastAPI/SQLAlchemy) before writing any implementation prompts. Updated the specific Cursor prompts to use SQLAlchemy models instead of TypeScript interfaces.

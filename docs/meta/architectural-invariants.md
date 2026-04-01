# Architectural Invariants

This file contains hard technical rules about the codebase that AI coding tools (like Cursor, Warp, or Manus) MUST NOT break.

## Invariants

*   **Invariant 1:** The `PromptLog` table/schema is immutable (append-only). No automated process, including self-learning agents, may ever delete or modify raw prompt logs.
*   **Invariant 2:** AI coding agents must operate under Strict Write Discipline: They may read any file, but autonomous code mutation (especially of core logic) is prohibited. Changes to code must be proposed as Cursor prompts for human review.
*   **Invariant 3:** The `docs/meta/` directory is the persistent memory for AI agents. Any architectural decisions or prompt improvements discovered must be recorded here.
*   **Invariant 4:** Intent classification should bypass the LLM and use the vector database (Pinecone) when confidence is high. The LLM should only be engaged for disambiguation when confidence is low.

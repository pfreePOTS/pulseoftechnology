# Interaction Rules

This file acts as the conversational Meta-Harness. It contains rules for how AI agents (like Manus) should interact with the user, format outputs, and approach tasks in this specific project.

## Rules

*   **Rule 1:** Always verify the project's actual tech stack before writing implementation prompts. Do not assume the stack based on generic design documents. (e.g., Verify if the backend is Python/FastAPI/SQLAlchemy or TypeScript/Prisma before writing data models).
*   **Rule 2:** When writing Cursor prompts, always format them as step-by-step guides suitable for AI coding tools, integrating with existing project components clearly.
*   **Rule 3:** When designing new AI architectures, always prioritize a hybrid model: use traditional logic (Python/SQL) for rules and systems, and reserve LLMs for interactive/creative components.
*   **Rule 4:** When designing self-learning or intent classification systems, ensure the design includes a mechanism for human-in-the-loop review before autonomous code mutation occurs (Strict Write Discipline).
*   **Rule 5:** When providing prompts to fix code or implement features, create a single, comprehensive prompt that can be given directly to a coder (Cursor/Warp).

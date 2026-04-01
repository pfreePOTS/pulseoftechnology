# AI DM Self-Learning Memory Architecture

**Author:** Manus AI
**Date:** April 1, 2026

## 1. Understanding Check

The user wants to evolve the AI Dungeon Master (AI DM) from a static system into a continuously self-improving one. The core missing piece is "Institutional Memory"—the ability for the AI to remember past experiments, failures, and successes (like struggling with specific image prompts), and use that knowledge to avoid repeating mistakes.

The user raised several critical architectural questions:
1.  **Triggers:** When does the system learn? When does it store memory?
2.  **Correction:** What happens if the memory is faulty?
3.  **Context Management:** How do we avoid overrunning the context window?
4.  **Implementation:** Does the agent make changes directly, or suggest them to the developer?

This document synthesizes research on state-of-the-art AI memory systems (Voyager, Reflexion, Recursive Knowledge Crystallization) to provide concrete design options for the AI DM project.

## 2. When to Learn: Triggers and Feedback Loops

Learning should not happen continuously on every single interaction, as that leads to "memory rot" and noise. Instead, learning should be event-driven.

### 2.1. The "Store" Triggers (Raw Experience)
Every significant AI interaction should be logged as *raw experience*. This is already partially handled by `PromptLogService`.
*   **Action:** Append to a structured database table (e.g., `AIExperienceLog`).
*   **Data:** Prompt, model, full context trace, response, latency, and tokens.

### 2.2. The "Learn" Triggers (Knowledge Distillation)
The system only extracts *lessons* when a specific feedback signal is received.
*   **Validation Failure:** The `ResponseValidator` catches a hallucination or rule break.
*   **Human Correction:** The developer or player gives a thumbs-down or explicit correction (e.g., "The image is too dark, add 'bright lighting'").
*   **Pattern Detection (Offline):** A scheduled background job notices that 30% of combat prompts require retries.

## 3. How to Store and Retrieve: The Memory Architecture

To avoid blowing up the context window, we must separate *raw logs* from *distilled knowledge*, and use a retrieval-augmented approach. We can draw inspiration from the **Voyager** skill library [1] and **MemoryOS** heat-based eviction [2].

### 3.1. The Three-Tier Memory System

| Tier | Purpose | Format | Storage |
| :--- | :--- | :--- | :--- |
| **1. Episodic (Raw)** | The exact history of what happened. | JSON/Relational | PostgreSQL (`PromptLog`) |
| **2. Reflective (Diagnosed)** | The analysis of *why* a specific event failed/succeeded. | Text (e.g., "Attempt 4 failed because...") | PostgreSQL |
| **3. Semantic (Distilled)** | The generalized rule to apply in the future. | Markdown / Text | Vector DB (Pinecone) |

### 3.2. Context Management via Vector Retrieval
We do not load the entire memory into the context window. Instead, we use Pinecone.
*   When the Image Agent is about to generate a prompt for a "dark fantasy forest," it queries Pinecone: `Search: "lessons learned generating dark fantasy forest images"`.
*   Pinecone returns the top 3 relevant semantic rules (e.g., "Rule: Always append 'unreal engine 5, octane render' to dark fantasy prompts to avoid muddy textures").
*   Only these specific rules are injected into the agent's system prompt.

## 4. Memory Correction: Handling Faulty Knowledge

If an AI learns a bad rule, it will persistently fail. We need mechanisms to unlearn.

### 4.1. The "Reflexion" Contradiction Check
When a new lesson is generated, the system queries Pinecone for similar existing rules. If the new lesson contradicts an old one (e.g., Old: "Use SDXL for portraits", New: "SDXL distorts faces"), the system flags it as a **Knowledge Conflict**.

### 4.2. Heat-Based Eviction and Confidence Decay
Inspired by MemoryOS [2], every semantic rule has a "confidence score" and a "last used" timestamp.
*   If a rule is retrieved and leads to a successful generation, its confidence increases.
*   If a rule is retrieved and the generation still fails, its confidence decreases.
*   Rules that drop below a confidence threshold are automatically archived.

### 4.3. The Developer Override
The ultimate fallback. The developer must have an admin UI to view the "Semantic Memory" and manually delete or edit rules.

## 5. Implementation: How Changes are Made

Based on the "Recursive Knowledge Crystallization" framework [3], but adapted for safety in a complex TypeScript environment.

### 5.1. The "SKILL.md" Pattern for Code/Config
For system-wide rules and architectural knowledge, the agent maintains a physical Markdown file in the repository (e.g., `docs/meta/ai-lessons.md`).
*   **The Workflow:** The agent *proposes* an update to this file via a Pull Request or a dedicated UI.
*   **The Developer:** Reviews the change. Once merged, it becomes part of the system's core operating manual.

### 5.2. The "Auto-Inject" Pattern for Prompts
For runtime agent behavior (like the Image Agent), the changes are applied automatically via the Vector DB.
*   **The Workflow:** The agent learns a new rule and saves it to Pinecone.
*   **Execution:** The next time the Image Agent runs, it retrieves the rule and adjusts its behavior. No human intervention is needed for these localized, prompt-level adjustments.

## 6. Summary of Recommendations

1.  **Do not let the AI rewrite TypeScript code.** It should rewrite Markdown documentation (`SKILL.md` pattern) and update Vector DB entries.
2.  **Separate raw logs from learned rules.** Store logs in Postgres, store rules in Pinecone.
3.  **Trigger learning on explicit feedback.** Use validation errors and developer corrections as the primary signals to trigger a "reflection" step.
4.  **Use RAG for memory injection.** Only give the agent the 2-3 memory rules most relevant to its current specific task.

## References

[1] Wang, G., et al. (2023). Voyager: An Open-Ended Embodied Agent with Large Language Models. *arXiv preprint arXiv:2305.16291*.
[2] Kang, J., et al. (2025). Memory OS of AI Agent. *Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing*.
[3] Tanaike. (2026). Recursive Knowledge Crystallization: A Framework for Persistent Autonomous Agent Self-Evolution. *DEV Community*.

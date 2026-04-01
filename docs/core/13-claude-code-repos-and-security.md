# Claude Code Repositories & Security Architecture Analysis

**Author:** Manus AI
**Date:** April 1, 2026
**Status:** Analysis / Proposed

---

## 1. Overview of Claude Code Implementations

Following the accidental leak of the Claude Code source map, several implementations and extractions have emerged. The user asked to compare `claw-code`, `open-multi-agent`, `claude-agent-sdk`, and the newly discovered `openclaude` repository, specifically focusing on LLM compatibility and overlap.

### 1.1. Repository Comparison

The four repositories serve fundamentally different purposes and have distinct form factors.

| Repository | Form Factor | LLM Support | Key Differentiator | Safety / License |
|---|---|---|---|---|
| **`claw-code`** | Full CLI Tool | Claude only | Direct mirror of the leaked 512K lines of TypeScript. | Raw leaked code; subject to Anthropic terms. |
| **`openclaude`** | Full CLI Tool | **Model-Agnostic** (200+ models) | Adds an OpenAI-compatible API shim (724 lines) to the leaked source, allowing it to run on any model. | Leaked code base + public domain shim. Active development with hardening checks. |
| **`open-multi-agent`**| Embeddable Library | **Model-Agnostic** | Focused extraction (~8K lines) of *only* the multi-agent orchestration layer. No tools or CLI. | Clean-room extraction; safe to embed. |
| **`claude-agent-sdk`**| Official SDK | Claude only | The official, Anthropic-supported way to build agents with Claude Code capabilities. | Fully supported, governed by Anthropic Terms of Service. |

### 1.2. Analysis of `openclaude`

The `Gitlawb/openclaude` repository is a fork of `claw-code` that specifically solves the vendor lock-in problem [1]. 

**What it does differently:**
It introduces an `openaiShim.ts` layer that sits between the core Claude Code logic and the external API. This shim transparently translates Anthropic message blocks into OpenAI messages, and Anthropic `tool_use` events into OpenAI function calls. Because the rest of the 512,000-line codebase remains untouched (only 6 files were modified), the tool system, memory, and agents all work seamlessly with models like GPT-4o, DeepSeek, Gemini, and local models via Ollama [1].

**Is it safe?**
It is built on the same leaked codebase as `claw-code`, meaning it carries the same legal ambiguity ("for educational and research purposes"). However, from a technical execution standpoint, the maintainers have added runtime hardening checks (`doctor:runtime`, `hardening:strict`) to ensure environment stability. It is as safe to run locally as the original leaked code, but with the added benefit of not sending telemetry to Anthropic if you point it at a local model [1].

---

## 2. KAIROS and autoDream: Code Availability

The user asked if we have access to the actual `autoDream` and KAIROS code, or if we are building our own version.

**The short answer: The code exists in the leak, but we must build our own adapted version.**

### 2.1. What is in the leak
The leaked source code contains the complete, compiled TypeScript implementation for both features [2]:
- **KAIROS:** The daemon logic, the 15-second blocking budget, the daily log file management, and the exclusive tools (push notifications, PR monitoring).
- **autoDream:** The three-gate trigger logic (24 hours + 5 sessions + lock), the four-phase consolidation pipeline, and the exact system prompts used to instruct the model to "perform a dream" [2].

### 2.2. Why we cannot just copy/paste it
Both features are gated behind compile-time feature flags (e.g., `tengu_amber_flint`) and are deeply coupled to Claude Code's specific CLI architecture, file-based memory system, and Anthropic's internal telemetry/GrowthBook infrastructure [2]. 

Attempting to extract and run the raw KAIROS code inside the AI Dungeon Master Node.js backend would be like trying to run a piece of the macOS kernel inside a Windows application. The environment assumptions are entirely different.

**Conclusion:** We have the *blueprint*—the exact prompts, the trigger thresholds, and the phase logic—but we must write the implementation ourselves to fit our PostgreSQL/Pinecone architecture. (This is exactly what we designed in Document 11).

---

## 3. Strict Write Discipline

The user asked how "Strict Write Discipline" comes into play for our project.

### 3.1. The Claude Code Pattern
According to the official Claude Code security documentation and the leaked source, the agent operates on a principle of least privilege [3]:
1. **Read-Only Default:** The agent can read files, but write operations require explicit permission.
2. **Scope Confinement:** Writes are strictly confined to the working directory and its subfolders. The agent cannot traverse up the directory tree to modify parent files.
3. **Risk Classification:** Every tool is classified by risk (Low, Medium, High).
4. **Command Injection Detection:** Even if a bash command is allowlisted, suspicious patterns trigger manual approval gates.

### 3.2. Application to AI Dungeon Master
This concept is highly relevant to our Meta-Harness proposer (the system that suggests improvements based on logs). If the proposer has the ability to modify the system, we must enforce Strict Write Discipline to prevent catastrophic failures.

**How we implement it:**
As defined in our two-lane strategy (Document 11):
- **The Read Scope:** The proposer (autoDream / KAIROS) has unrestricted *read* access to Tier 1 logs, Tier 2 diagnoses, and Tier 3 skills.
- **The Write Scope (Low Risk):** The proposer is allowed to autonomously write to the `AgentSkill` database table (updating prompt contexts). This is sandboxed; a bad prompt might cause a weird narrative response, but it won't crash the server.
- **The Write Scope (High Risk):** The proposer is **strictly forbidden** from autonomously writing to `.ts` code files or core configuration files. Instead, it must output a `ConsolidationReport` containing a pre-written Cursor prompt. A human developer must review and execute the code change.

By adopting this strict write discipline, we gain the benefits of a self-improving system without the risk of an AI agent rewriting the routing logic and breaking the game loop.

---

## References

[1] GitHub. (2026). "Gitlawb/openclaude." https://github.com/gitlawb/openclaude

[2] Paige, M. (2026). "Claude Code’s Entire Source Code Just Leaked. Here’s What They Were Hiding." Substack. https://mattpaige68.substack.com/p/claude-codes-entire-source-code-just

[3] Anthropic. (2026). "Security - Claude Code Docs." https://code.claude.com/docs/en/security

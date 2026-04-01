# Meta-Harness Self-Learning Architecture

**Author:** Manus AI
**Date:** April 1, 2026
**Status:** Design / Proposed
**Version:** 2.0 (KAIROS/autoDream integration)
**Changelog:** v2.0 adds Section 5A (KAIROS Background Daemon), Section 5B (autoDream Memory Consolidation), updates data flow diagram, updates implementation phases, and adds new references from the Claude Code architecture analysis.

---

## 1. Overview and Philosophy

The AI Dungeon Master system relies on multiple specialized AI agents (Storyteller, Narrator, Image, Audio, Combat, Intent, etc.) orchestrated by higher-level agents (Director, Orchestrator). It also relies on multiple QA and validation services (`ResponseValidator`, `AvQaService`, `BlueprintQaService`, `PromptTestingService`). Currently, these QA services act as isolated "sensors" that catch errors in real-time, but the system does not *learn* from these errors. A hallucination caught by `ResponseValidator` today will be caught again tomorrow by the same validator, because nothing feeds back to prevent the hallucination from occurring in the first place.

This document outlines the **Meta-Harness Self-Learning Architecture**, a system-wide feedback loop that gives every AI agent access to "Institutional Memory" — the accumulated knowledge of what has been tried, what worked, what failed, and why. The design is inspired by four key research frameworks:

1. **Meta-Harness** (Lee et al., 2025) [1]: Demonstrated that giving an optimization agent access to full execution traces (not just scores) enables dramatically better self-improvement. Their ablation study showed scores-only optimization achieved 34.6 median vs. 50.0 median with full traces — a 44% improvement from better observability alone.

2. **Voyager** (Wang et al., 2023) [2]: Introduced the "Skill Library" pattern — an ever-growing collection of learned capabilities indexed by semantic embedding, retrieved by similarity when facing new tasks. Skills are composable and transferable.

3. **Recursive Knowledge Crystallization** (Tanaike, 2026) [3]: Demonstrated that an agent can continuously rewrite its own operational manual (`SKILL.md`) based on failures, and that the saturated manual enables zero-shot transfer to new environments.

4. **Claude Code / KAIROS Architecture** (Anthropic, 2026, leaked) [5]: Revealed that Anthropic's production agent system uses a persistent background daemon (KAIROS) with periodic `<tick>` prompts for proactive observation, and a sub-agent (`autoDream`) that consolidates memory during idle periods — merging observations, removing contradictions, and converting tentative notes into confirmed facts. This independently validates our design and provides concrete implementation patterns.

### 1.1. Core Design Principles

The following principles were established through conversational vetting and are non-negotiable constraints:

**No Autonomous Code Mutation.** The self-learning system does not rewrite TypeScript logic. It modifies prompt context (via skill injection) and proposes configuration changes (via recommendations). This constraint exists because the AI DM is a complex, stateful system where a bad code change could corrupt game state, break player sessions, or produce subtly wrong narrative. Unlike the Meta-Harness paper's stateless classifiers, our "harnesses" interact with databases, manage sessions, and produce creative output that is hard to score automatically.

**Silent Injection, Full Logging.** Learned rules are injected into agent context silently at runtime — no approval step per generation. However, every injection is logged (which skills were active, what the outcome was), and the developer has full visibility via an Admin Dashboard. The developer does not need to approve each injection but can view, edit, and delete any rule at any time.

**Event-Driven Learning, Not Continuous.** The system learns from explicit triggers (validation failures, human feedback, retry events, statistical anomalies), not continuously from every interaction. Continuous learning causes "memory rot" — the system fills with noise and starts making worse decisions. This is a well-documented failure mode in long-running agent systems [4].

**Self-Correcting Memory.** The system must be able to detect when its own rules are faulty, conflicting, or outdated, and handle this autonomously (via confidence decay and contradiction detection) with human override as the ultimate fallback.

---

## 2. Architecture Components

### 2.1. New Services and Their Relationship to Existing Code

| New Component | Purpose | Replaces / Extends |
| :--- | :--- | :--- |
| `ExperienceLedgerService` | Central service for storing, retrieving, and managing learned skills. Provides the API for skill injection and feedback. | Extends `PromptOptimizationService`. Subsumes its quality spec and suggestion features. |
| `ReflectorAgent` | An AI agent that diagnoses failures by analyzing full execution traces and proposes new skills. | New. Currently, diagnosis is manual (developer reads PromptLog in admin UI). |
| `SkillRetriever` | A module within `ContextAssembler` that queries Pinecone for relevant skills before each agent call. | New. Analogous to how `IntentClassifier` already queries Pinecone for intent matching. |
| `PatternDetector` | A scheduled background job that scans `PromptLog` for statistical anomalies and clusters of failures. | New. The `EventMonitor` does something similar for gameplay patterns, but not for AI performance patterns. |
| `KairosDaemon` | A persistent background process that receives periodic `<tick>` prompts and decides whether to act proactively (trigger reflection, run consolidation, surface recommendations) or stay quiet. Inspired by Anthropic's KAIROS [5]. | New. Subsumes the scheduling role of `PatternDetector` and adds proactive observation. |
| `autoDreamConsolidator` | A sub-process spawned by `KairosDaemon` during idle periods that consolidates memory: merges similar skills, resolves contradictions, archives stale entries, and promotes high-evidence diagnoses. Inspired by Anthropic's `autoDream` [5]. | New. Replaces the manual contradiction resolution and staleness checks described in Section 5. |

### 2.2. The Three-Tier Memory System

The memory architecture separates raw data from analyzed knowledge from distilled rules. This prevents context window overload (only distilled rules are injected) while preserving full traceability (raw data is always available for diagnosis).

**Tier 1 — Raw Experience (PostgreSQL, `PromptLog` table, enhanced)**

This is the existing `PromptLogService`, enhanced to capture additional data. Every AI call is logged automatically. No intelligence is applied at this tier — it is append-only.

Current `PromptLog` fields: `agentType`, `gameMode`, `systemPrompt`, `userPrompt`, `response`, `tokensUsed`, `tokenBudget`, `latencyMs`, `wasValid`, `validationErrors`, `campaignId`, `characterId`.

New fields required:
- `fullContextTrace` (JSON): The complete `AIContext` object that was assembled, including RAG retrieval results, game state snapshot, and NPC data. This is the "full trace" that the Meta-Harness paper showed is critical for effective diagnosis.
- `activeSkillIds` (string[]): The IDs of any skills that were injected into this call's prompt. Essential for attributing success/failure to specific skills.
- `retryCount` (integer): How many times this call was retried before succeeding (0 = first attempt succeeded).
- `feedbackSignal` (enum: null, 'positive', 'negative', 'correction'): Explicit feedback from developer/player, if any.
- `feedbackText` (string, nullable): Free-text correction or note from the developer.

**Tier 2 — Diagnosed Reflection (PostgreSQL, new `ExperienceDiagnosis` table)**

When a learning trigger fires (see Section 3), the `ReflectorAgent` analyzes the raw traces and produces a structured diagnosis. This tier stores the *analysis*, not the raw data.

```typescript
interface ExperienceDiagnosis {
  id: string;
  triggerType: 'validation_failure' | 'human_correction' | 'retry_fallback' | 'pattern_detection';
  promptLogIds: string[];       // The raw log entries that were analyzed
  agentType: string;            // Which agent was involved
  symptoms: string;             // What went wrong (e.g., "Muddy textures in dark interior images")
  hypothesizedCause: string;    // Why it went wrong (e.g., "Missing lighting descriptors in prompt")
  proposedRule: string;         // The suggested skill text
  confidence: number;           // How confident the ReflectorAgent is in this diagnosis
  status: 'pending' | 'promoted' | 'rejected';  // Whether this became a skill
  promotedSkillId?: string;     // If promoted, which skill it became
  createdAt: Date;
}
```

**Tier 3 — Distilled Skills (PostgreSQL + Pinecone Vector DB)**

The generalized, reusable rules that get injected into agent prompts at runtime. Each skill has a record in PostgreSQL (for management, filtering, and the admin UI) and an embedding in Pinecone (for semantic retrieval).

```typescript
interface AgentSkill {
  // --- Identity ---
  id: string;
  domain: string;              // e.g., 'image-generation', 'combat-narrative', 'intent-classification', 'blueprint-generation'
  targetAgent: string;         // e.g., 'ImageAgent', 'NarratorAgent', 'CombatAgent', 'all'
  
  // --- The Rule ---
  ruleText: string;            // The actual instruction injected into the prompt
                               // e.g., "For dark interior scenes, always specify 'volumetric lighting' and a specific light source direction."
  
  // --- Provenance ---
  source: 'auto-diagnosed' | 'developer-created' | 'recommendation-closed';
  evidenceIds: string[];       // Links to PromptLog entries that support this rule
  diagnosisIds: string[];      // Links to ExperienceDiagnosis entries that led to this rule
  
  // --- Health Metrics ---
  confidence: number;          // 0.0 to 1.0. Starts at 0.6 (auto) or 0.9 (developer). Decays/grows with use.
  status: 'active' | 'flagged' | 'archived';
  timesUsed: number;           // How many times this skill was injected into a prompt
  timesSucceeded: number;      // How many of those injections led to successful generations
  successRate: number;         // timesSucceeded / timesUsed
  
  // --- Lifecycle ---
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  archivedAt?: Date;
  archivedReason?: string;     // e.g., 'confidence_decay', 'contradiction', 'manual_archive'
  
  // --- Vector DB ---
  pineconeId: string;          // The ID of this skill's embedding in Pinecone
  embeddingText: string;       // The text that was embedded (domain + targetAgent + ruleText)
}
```

### 2.3. Pinecone Index Design

A new Pinecone index (or namespace within the existing index) called `agent-skills`.

**Embedding text** is constructed from: `"{domain} | {targetAgent} | {ruleText}"`. This ensures that retrieval is scoped by both the type of task and the specific agent.

**Metadata stored in Pinecone** (for server-side filtering):
- `domain` (string)
- `targetAgent` (string)
- `status` (string) — only retrieve `active` skills
- `confidence` (float) — only retrieve skills above threshold (default 0.5)
- `skillId` (string) — to join back to PostgreSQL for full details

**Retrieval query** is constructed from the current task context: `"{agentType} | {sceneDescription or taskDescription}"`. Top-K = 3, with metadata filter `status = 'active' AND confidence >= 0.5`.

---

## 3. The Learning Lifecycle

### 3.1. Triggers for Learning (When to Reflect)

The `ReflectorAgent` is not always running. It is triggered by specific events, each of which produces a different type of learning signal.

| Trigger | Source | Signal Strength | Example |
| :--- | :--- | :--- | :--- |
| **Validation Failure** | `ResponseValidator` catches hallucination, rule break, or format error | Strong (definite problem) | "AI mentioned NPC 'Elara' not in the room" |
| **Asset QA Failure** | `AvQaService` rejects audio (silent) or image (corrupt/too small) | Strong (definite problem) | "Audio too quiet (max_volume -91.0 dB)" |
| **Human Correction** | Developer gives thumbs-down or text correction via Admin UI or in-game `/feedback` | Strong (definite problem, with human context) | "Developer: SDXL produces muddy textures for dark fantasy — use DALL-E 3 with explicit lighting" |
| **Retry/Fallback** | System had to retry an AI call (truncation, format error, timeout) | Moderate (something went wrong, but self-recovered) | "CombatAgent response truncated at 500 tokens, retried with 650" |
| **Pattern Detection** | `PatternDetector` scheduled job finds statistical anomaly | Moderate (pattern, not single event) | "30% of combat prompts require retries this week, up from 10% last week" |
| **Implicit Player Signal** | Player skips past content quickly, re-requests same scene, or disengages | Weak (ambiguous, only useful in aggregate) | "Players spend <1 second on dark interior images on average" |

**Processing rules:**
- Strong signals trigger the `ReflectorAgent` immediately (asynchronously, after the main request completes).
- Moderate signals are batched and processed by the `PatternDetector` on a schedule (e.g., nightly or on-demand).
- Weak signals are logged but not acted on unless they form a pattern detected by `PatternDetector`.

### 3.2. The Reflection Process

When triggered, the `ReflectorAgent` receives:
1. The `PromptLog` entries involved (including the full `AIContext` trace).
2. The trigger type and any human-provided context.
3. The list of skills that were active during the failed generation(s).

The `ReflectorAgent` is itself an LLM call with a system prompt like:

> You are a diagnostic agent for the AI Dungeon Master system. You analyze failed AI generations to determine root causes and propose reusable rules.
>
> You will receive:
> - The full execution trace (assembled prompt, context, model, response)
> - The validation error or human feedback
> - Any skills that were active during this generation
>
> Your job is to:
> 1. Identify the root cause (was it the prompt? the context? the model? a missing skill?)
> 2. Determine if an existing active skill contributed to the failure (if so, recommend archiving it)
> 3. Propose a new rule that would prevent this failure in the future
> 4. State the rule as a clear, actionable instruction that can be injected into an agent's system prompt
>
> Output format:
> - symptoms: [what went wrong]
> - hypothesized_cause: [why it went wrong]
> - proposed_rule: [the instruction to prevent it]
> - confidence: [0.0-1.0, how confident you are]
> - affected_agent: [which agent this rule applies to]
> - domain: [the category of this rule]

### 3.3. Skill Creation (Distillation)

A diagnosis becomes a skill through one of two paths:

**Path A — Automatic Promotion (3+ similar diagnoses):** When the `PatternDetector` finds 3 or more `ExperienceDiagnosis` records with similar `proposedRule` text (measured by embedding similarity > 0.85), it automatically creates an `AgentSkill` with `source: 'auto-diagnosed'` and `confidence: 0.6`.

**Path B — Developer Creation:** The developer manually creates a skill via the Admin UI with `source: 'developer-created'` and `confidence: 0.9`. This is for knowledge gained outside the system (e.g., from Cursor experimentation, reading documentation, or community best practices).

**Contradiction Check (Before Saving):** Before any new skill is saved, the system queries Pinecone for existing skills with embedding similarity > 0.8. If a potential contradiction is found (e.g., old rule says "use SDXL for portraits," new rule says "avoid SDXL for portraits"), both the old and new skills are set to `status: 'flagged'` and surfaced in the Admin Dashboard for human resolution.

### 3.4. Self-Managed Rule Lifecycle

The system manages its own rules without requiring constant human intervention:

**Confidence Growth:** When a skill is injected and the generation succeeds (no validation errors, no retries), the skill's confidence increases by +0.05 (capped at 1.0) and `timesSucceeded` increments.

**Confidence Decay:** When a skill is injected and the generation fails, the skill's confidence decreases by -0.1. The asymmetry (decay is 2x growth) is intentional — it's easier to lose trust than to build it.

**Auto-Archive:** When confidence drops below 0.3, the skill is automatically set to `status: 'archived'` with `archivedReason: 'confidence_decay'`. It is removed from Pinecone and will no longer be retrieved. The PostgreSQL record is preserved for audit trail.

**Staleness Check:** If a skill has not been used (`lastUsedAt`) in 30 days, it is flagged for review. It may be that the skill is still valid but the relevant scenario hasn't occurred, or it may be that the system has evolved past it.

**Contradiction Resolution:** The `ReflectorAgent` can also be triggered to resolve flagged contradictions. It receives both conflicting skills and their evidence, and proposes which one to keep, archive, or merge. The resolution is logged.

---

## 4. The Execution Lifecycle (Silent Injection)

This section describes the exact runtime flow when an agent is about to make an AI call.

### 4.1. Step-by-Step Flow

**Step 1 — Context Assembly Begins.** The `ContextAssembler` starts building the `AIContext` for the agent (e.g., ImageAgent generating a scene image). It gathers game state, room data, NPC data, player inventory, etc. — all existing behavior.

**Step 2 — Skill Retrieval.** Before finalizing the prompt, `ContextAssembler` calls `ExperienceLedgerService.getRelevantSkills(agentType, taskDescription)`.

The `taskDescription` is constructed from the current context. For the ImageAgent, it might be: `"dark elven throne room lit by green magical fire"`. For the NarratorAgent, it might be: `"combat encounter with 4 goblins in a narrow corridor"`.

The service queries Pinecone:
- Index: `agent-skills`
- Query embedding: embed(`"{agentType} | {taskDescription}"`)
- Filter: `status = 'active' AND confidence >= 0.5 AND (targetAgent = '{agentType}' OR targetAgent = 'all')`
- Top-K: 3

**Step 3 — Prompt Assembly.** The retrieved skills are formatted and injected into the system prompt as a dedicated section:

```
[Base System Prompt for {AgentType}]

[Scene/Task Context from Game State]

---
LESSONS FROM PRIOR EXPERIENCE (Apply these strictly):
1. For dark interior scenes, always specify 'volumetric lighting' and a specific light source direction. Without this, results are flat and muddy. [Skill #47, confidence: 0.92]
2. When generating magical effects, include 'particle effects, glowing embers' in the prompt. Omitting this produces static-looking magic. [Skill #112, confidence: 0.78]
---

[Output Format Instructions]
```

The skill IDs and confidence scores are included in the injected text so the agent can weigh them, and so the developer can trace exactly which skills influenced a generation when reviewing logs.

**Step 4 — Execution.** The agent runs with the skill-enhanced prompt.

**Step 5 — Logging.** The `PromptLogService` records the full generation, including:
- The `activeSkillIds` that were injected.
- The `fullContextTrace` (the complete `AIContext`).
- The `wasValid` result from `ResponseValidator` or `AvQaService`.
- The `retryCount`.

**Step 6 — Feedback Loop.** Based on the outcome:
- If `wasValid = true` and `retryCount = 0`: Each active skill gets a confidence bump.
- If `wasValid = false` or `retryCount > 0`: Each active skill gets a confidence penalty. If a learning trigger fires (Section 3.1), the `ReflectorAgent` is invoked asynchronously.

### 4.2. Context Window Budget

The skill injection section should consume no more than **200-400 tokens** (3 skills at ~60-120 tokens each, plus the header). This is negligible relative to the typical system prompt (1000-3000 tokens) and context (2000-8000 tokens). If the context window is already near capacity, the `SkillRetriever` should reduce Top-K from 3 to 1 or skip injection entirely, logging that skills were suppressed due to budget constraints.

---

## 5. Memory Correction and Housekeeping

### 5.1. Autonomous Correction Mechanisms

The system handles faulty memory through three automated mechanisms:

**Confidence Decay (Section 3.4):** Skills that consistently lead to failures lose confidence and are eventually auto-archived. This handles the case where a rule was once correct but is no longer valid (e.g., a model update changed behavior).

**Contradiction Detection (Section 3.3):** When a new skill contradicts an existing one, both are flagged. The `ReflectorAgent` can attempt autonomous resolution by examining the evidence for each skill. If it cannot resolve the contradiction with high confidence, it escalates to the Admin Dashboard.

**Staleness Eviction:** Skills unused for 30+ days are flagged for review. A scheduled job can optionally auto-archive skills unused for 90+ days.

### 5.2. Human Override (Admin Dashboard)

The developer always has the final word. The Admin Dashboard provides:

**Skill Browser:** A searchable, filterable table of all skills (active, flagged, archived). Columns: ID, domain, targetAgent, ruleText (truncated), confidence, successRate, timesUsed, status, createdAt, lastUsedAt.

**Skill Detail View:** Full ruleText, evidence links (clickable to PromptLog entries), diagnosis links, usage history chart (confidence over time).

**Actions:**
- **Edit:** Modify `ruleText`. This resets confidence to 0.9, regenerates the Pinecone embedding, and logs the edit.
- **Archive:** Manually archive a skill. Sets `archivedReason: 'manual_archive'`.
- **Restore:** Restore an archived skill to active status with confidence 0.7.
- **Create:** Manually create a new skill from scratch.
- **Delete:** Permanently remove a skill (soft delete — record preserved with `status: 'deleted'`).

**Conflict Resolution View:** Shows pairs of flagged skills with their evidence. The developer can choose to keep one, archive one, merge them, or edit both.

---

## 5A. KAIROS Background Daemon

The KAIROS pattern, discovered in Anthropic's leaked Claude Code architecture [5], provides the missing "nervous system" for the self-learning architecture. Rather than relying on purely event-driven triggers (Section 3) and scheduled cron jobs, KAIROS introduces a **persistent, low-overhead background process** that continuously observes the system and decides autonomously when to act.

### 5A.1. Why KAIROS Matters

The original design (v1.0) had two modes of learning: **reactive** (triggered by validation failures, human corrections, and retries) and **scheduled** (the `PatternDetector` running on a cron schedule). This leaves a gap: the system cannot notice slow-developing problems between scheduled runs, and it cannot correlate events across different trigger types in real time.

KAIROS fills this gap by acting as a **continuous observer** that receives periodic `<tick>` prompts and decides whether the current system state warrants action. It is not a replacement for the reactive triggers — those still fire immediately for strong signals. KAIROS is the layer that catches everything else: gradual degradation, cross-agent patterns, opportunities for consolidation, and proactive recommendations.

Anthropic's implementation enforces a **15-second blocking budget** per tick, ensuring the daemon never interferes with the main application's performance [5]. Our implementation should adopt a similar constraint.

### 5A.2. Architecture

The `KairosDaemon` runs as a background job within the existing `APScheduler` infrastructure (see `backend/scheduler.py`). It is registered as an interval job, ticking every **5 minutes** during active gameplay sessions and every **30 minutes** during idle periods.

```typescript
interface KairosTickContext {
  // --- System Health Snapshot ---
  activeSessionCount: number;           // How many game sessions are currently active
  recentPromptLogSummary: {             // Aggregated stats from the last tick interval
    totalCalls: number;
    failureCount: number;
    retryCount: number;
    avgLatencyMs: number;
    agentBreakdown: Record<string, { calls: number; failures: number }>;
  };
  
  // --- Memory Health Snapshot ---
  activeSkillCount: number;
  flaggedSkillCount: number;            // Skills in contradiction or review state
  pendingDiagnosisCount: number;        // Diagnoses not yet promoted to skills
  recentSkillPerformance: {             // Skills used since last tick
    skillId: string;
    timesUsed: number;
    successRate: number;
  }[];
  
  // --- Pending Work ---
  unresolvedContradictions: number;
  staleSkillCount: number;              // Skills unused for 30+ days
  pendingRecommendations: number;       // Lane 2 recommendations awaiting review
  
  // --- Timing ---
  lastConsolidationRun: Date;           // When autoDream last ran
  lastPatternDetectionRun: Date;        // When full pattern analysis last ran
  currentTime: Date;
  isIdlePeriod: boolean;                // True if no active sessions for 15+ minutes
}
```

On each tick, the `KairosDaemon` receives this lightweight context snapshot (not the full PromptLog — that would be too expensive) and makes one of the following decisions:

| Decision | When | Action |
| :--- | :--- | :--- |
| **No action** | System is healthy, no anomalies | Log tick, do nothing |
| **Trigger reflection** | Failure rate spike detected (>2x baseline in the tick interval) | Invoke `ReflectorAgent` on the worst-performing agent's recent failures |
| **Trigger consolidation** | Idle period detected AND last consolidation was >6 hours ago | Spawn `autoDreamConsolidator` (Section 5B) |
| **Surface recommendation** | Pattern detected that warrants a Lane 2 recommendation | Create a `SystemRecommendation` record |
| **Alert developer** | Critical anomaly (e.g., >50% failure rate, all skills degrading) | Log critical alert, optionally send notification |

The decision logic is itself an LLM call, but a **cheap one** — it uses a small, fast model (e.g., `gpt-4.1-nano` or `gemini-2.5-flash`) with a concise system prompt and the `KairosTickContext` as input. The total cost per tick should be under $0.001.

### 5A.3. KAIROS System Prompt

> You are KAIROS, the background health monitor for the AI Dungeon Master system. You receive periodic health snapshots and decide whether action is needed.
>
> Your priorities (in order):
> 1. **Do no harm.** If the system is healthy, say "no_action." Most ticks should result in no action.
> 2. **Catch degradation early.** If failure rates are rising, trigger reflection before the problem compounds.
> 3. **Consolidate during downtime.** If the system is idle and memory hasn't been consolidated recently, trigger consolidation.
> 4. **Surface insights.** If you notice a cross-agent pattern (e.g., multiple agents struggling with the same type of content), create a recommendation.
>
> You MUST NOT trigger consolidation during active gameplay sessions.
> You MUST NOT trigger more than one reflection per tick.
> You MUST explain your reasoning in one sentence.
>
> Respond with exactly one JSON object:
> ```json
> { "decision": "no_action" | "trigger_reflection" | "trigger_consolidation" | "surface_recommendation" | "alert_developer", "reason": "...", "target_agent": "..." (if reflection), "recommendation_text": "..." (if recommendation) }
> ```

### 5A.4. Implementation Pattern (APScheduler Integration)

The `KairosDaemon` follows the exact same pattern as the existing `signal_service.py` in the codebase. The `signal_service` already implements: scheduled analysis of evidence, threshold-based triggering, AI-powered evaluation (`evaluate_trend_pick`), persistence of pending recommendations (`SignalRecommendation`), and cleanup/housekeeping. The `KairosDaemon` is architecturally identical — it just operates on AI performance data instead of article velocity data.

In `scheduler.py`, it would be registered as:

```python
scheduler.add_job(
    _kairos_tick_job,
    trigger="interval",
    minutes=5,
    id="kairos_daemon",
    replace_existing=True,
)
```

The tick interval can be made adaptive: 5 minutes during active sessions, 30 minutes during idle periods, by checking `activeSessionCount` at the start of each tick and short-circuiting if appropriate.

---

## 5B. autoDream Memory Consolidation

The `autoDream` pattern, also from the Claude Code architecture [5], addresses the most dangerous long-term failure mode of any self-learning system: **memory rot**. Over time, the skill library will accumulate redundant rules, near-duplicates with slightly different wording, contradictions from different learning episodes, and stale entries that no longer apply. Without periodic consolidation, the system's memory becomes noisy and retrieval quality degrades.

### 5B.1. Two-Tier Architecture

The `autoDreamConsolidator` is a sub-process spawned by `KairosDaemon` exclusively during idle periods (no active game sessions for 15+ minutes). To manage the diverse cleanup needs of the entire system without muddying its core intelligence, autoDream is structured into two tiers:

**Tier A: Smart Consolidation (LLM-Powered)**
This tier handles the `AgentSkill` index. It requires semantic understanding and LLM reasoning to resolve contradictions and merge knowledge.

**Tier B: Hygiene Sweeps (Deterministic Plugins)**
This tier handles all other Pinecone indexes and PostgreSQL tables. It requires zero LLM calls, relying entirely on deterministic rules (date thresholds, similarity thresholds, foreign key checks). It is built as a modular plugin system so new sweeps can be added easily as the system scales.

### 5B.2. Tier A: Smart Consolidation Operations

Tier A performs four operations in sequence on the skill library:

**Operation 1 — Merge Near-Duplicates.** Query Pinecone for all active skills. For each skill, find other active skills with embedding similarity > 0.85. If found, invoke the `ReflectorAgent` with both skills and their evidence to produce a single merged skill that captures the best of both. Archive the originals with `archivedReason: 'merged_by_autodream'` and link them to the new merged skill.

**Operation 2 — Resolve Contradictions.** Find all skills with `status: 'flagged'`. For each flagged pair, invoke the `ReflectorAgent` with both skills, their evidence (linked `PromptLog` entries), and their performance metrics (`successRate`, `confidence`). The `ReflectorAgent` decides: keep one, archive one, or merge them. If it cannot decide with confidence > 0.7, the contradiction remains flagged for human review.

**Operation 3 — Promote Pending Diagnoses.** Scan the `ExperienceDiagnosis` table for clusters of `status: 'pending'` diagnoses with similar `proposedRule` text (embedding similarity > 0.85). If 3+ similar diagnoses exist, auto-promote to a new `AgentSkill`. This is the same logic as Section 3.3 (Path A), but running as a batch process rather than checking after each individual diagnosis.

**Operation 4 — Evict Stale Skills.** Find all active skills where `lastUsedAt` is more than 90 days ago. Auto-archive with `archivedReason: 'staleness_eviction'`. For skills between 30-90 days old, set `status: 'flagged'` with a note for developer review.

### 5B.3. Tier B: Hygiene Sweep Plugins

Tier B runs a registry of deterministic cleanup functions across the broader system. Each plugin takes a database session and Pinecone client, executes its logic, and returns a summary object.

Current sweep plugins include:

| Target | Sweep Logic | Why It's Needed |
| :--- | :--- | :--- |
| **Intent Classifications** (Pinecone) | Deduplicate near-identical intents (similarity > 0.95). Keep the one with more usage history, archive the other. | Prevents the intent classifier from becoming sluggish or indecisive due to redundant vectors. |
| **NPC Conversational Memory** (PostgreSQL/Pinecone) | Prune conversation turns older than N sessions. If history exceeds token budget, trigger a background summarization task. | Prevents NPC context windows from blowing up in long-running campaigns. |
| **Article Vectors** (`pulseone-articles`) | Remove vectors for deleted/archived articles (orphan check). | Keeps the vector index perfectly synced with the PostgreSQL source of truth. |
| **PromptLog** (PostgreSQL) | Archive logs older than 90 days to cold storage tables, retaining only aggregated statistics. | Prevents the primary PostgreSQL database from ballooning in size and slowing down active queries. |
| **Generated Assets** (S3/PostgreSQL) | Identify unused assets (images/audio) not linked to any active game session or blueprint. | Saves storage costs for discarded or failed generation attempts. |
| **ExperienceDiagnosis** (PostgreSQL) | Archive `rejected` diagnoses older than 30 days. | Keeps the active diagnosis pool clean for Tier A operations. |

### 5B.4. Consolidation Report

After each run, `autoDreamConsolidator` produces a `ConsolidationReport` that is stored in PostgreSQL and surfaced in the Admin Dashboard:

```typescript
interface ConsolidationReport {
  id: string;
  runAt: Date;
  duration: number;                     // How long the consolidation took (ms)
  triggeredBy: 'kairos_idle' | 'manual' | 'scheduled';
  
  // --- Actions Taken ---
  mergesPerformed: {
    originalSkillIds: string[];
    newSkillId: string;
    mergeReason: string;
  }[];
  contradictionsResolved: {
    skillIds: string[];
    resolution: 'kept_one' | 'archived_both' | 'merged' | 'escalated_to_human';
    reason: string;
  }[];
  diagnosesPromoted: {
    diagnosisIds: string[];
    newSkillId: string;
  }[];
  staleSkillsEvicted: string[];         // Skill IDs archived for staleness
  
  // --- Tier B Hygiene Results ---
  hygieneSweeps: {
    pluginName: string;
    itemsRemoved: number;
    itemsArchived: number;
    status: 'success' | 'failed';
    error?: string;
  }[];
  
  // --- Health Metrics ---
  totalActiveSkillsBefore: number;
  totalActiveSkillsAfter: number;
  contradictionsRemainingForHuman: number;
  
  // --- Cost ---
  llmCallsUsed: number;
  estimatedCost: number;                // USD
}
```

### 5B.5. Safety Constraints

The `autoDreamConsolidator` operates under strict safety constraints to prevent runaway memory modification:

**Never runs during active gameplay.** If a game session starts during consolidation, the process pauses immediately and resumes at the next idle window. This is enforced by checking `activeSessionCount` before each operation.

**Maximum operations per run.** Each consolidation run is capped at 10 merges, 5 contradiction resolutions, and 10 promotions. This prevents a single run from making too many changes at once, which would be hard to debug if something goes wrong.

**All changes are logged and reversible.** Every merge, resolution, and eviction is recorded in the `ConsolidationReport`. Archived skills are never deleted — they can be restored via the Admin Dashboard. Merged skills link back to their originals.

**Cost cap.** Each consolidation run has a budget of $0.50 in LLM calls. If the budget is exhausted before all operations complete, the run stops and logs what was completed. The remaining work is picked up on the next run.

**No skill creation from scratch.** The `autoDreamConsolidator` can merge, archive, and promote, but it cannot create entirely new skills that weren't already present as diagnoses. Only the `ReflectorAgent` (triggered by real failures) and the developer can create genuinely new knowledge.

### 5B.6. Relationship to Existing Memory Correction (Section 5)

The `autoDreamConsolidator` subsumes and automates the manual processes described in Section 5 of this document:

| Section 5 Mechanism | autoDream Replacement |
| :--- | :--- |
| Confidence Decay (per-use) | **Unchanged.** Confidence decay still happens in real-time on every generation. autoDream does not modify this. |
| Contradiction Detection (on skill creation) | **Enhanced.** Still happens on creation, but autoDream also performs periodic batch contradiction scans to catch contradictions that emerge over time as skills evolve. |
| Staleness Eviction (30-day flag, 90-day archive) | **Automated.** Previously described as a "scheduled job" without specifics. Now explicitly handled by autoDream Operation 4. |
| Human Override (Admin Dashboard) | **Unchanged.** The developer always has final authority. autoDream surfaces its work in the dashboard for review. |

---

## 6. Two-Lane Implementation Strategy

The Meta-Harness proposer operates in two distinct lanes based on risk level.

### 6.1. Lane 1: Auto-Apply (Low Risk)

**What:** Distilled rules (`ruleText`) that are injected into agent prompts via Pinecone retrieval.

**Why it's low risk:** These are *additive context* — they add instructions to the system prompt but do not change code, configuration, or logic. If a rule is bad, the worst case is a slightly worse prompt for a single generation. The confidence decay mechanism will catch it within a few uses.

**Scope of auto-apply:**
- Prompt style guidance (e.g., "Include volumetric lighting for dark scenes")
- Negative prompt additions (e.g., "Always add 'no text, no watermarks' to image negative prompts")
- Tone and voice guidance (e.g., "For combat narration, use short, punchy sentences")
- Context assembly hints (e.g., "When 4+ NPCs are in the room, summarize inactive NPCs rather than listing all details")

### 6.2. Lane 2: Recommend (High Risk)

**What:** Structural changes that require code or configuration modification.

**Why it's high risk:** These changes affect system behavior beyond a single prompt. A bad change could affect all future generations, corrupt data, or break functionality.

**Scope of recommendations:**
- Token budget changes (e.g., "Increase CombatAgent budget from 500 to 650 for rooms with 4+ NPCs")
- EventMonitor threshold changes (e.g., "Change combat streak trigger from 3 to 5 combats")
- Model selection changes (e.g., "Switch ImageAgent from SDXL to DALL-E 3 for portrait-style images")
- RAG retrieval parameter changes (e.g., "Increase similarity threshold for intent classification from 0.5 to 0.6")
- Architectural observations (e.g., "The NarratorAgent is frequently truncated — consider splitting long narrations into two calls")

**Recommendation format:**

```typescript
interface SystemRecommendation {
  id: string;
  category: 'token_budget' | 'threshold_change' | 'model_selection' | 'rag_config' | 'architectural';
  title: string;                    // e.g., "Increase CombatAgent token budget"
  description: string;              // Detailed explanation with evidence
  evidenceIds: string[];            // Links to PromptLog entries
  suggestedChange: string;          // e.g., "In TokenBudgetService.ts line 42, change 500 to 650"
  impactAssessment: string;         // e.g., "Affects ~15% of combat encounters. Estimated cost increase: $0.02/session"
  status: 'pending' | 'accepted' | 'rejected' | 'implemented';
  cursorPrompt?: string;            // A ready-to-use prompt for Cursor/Claude Code
  createdAt: Date;
  reviewedAt?: Date;
}
```

These recommendations appear in the Admin Dashboard. The developer reviews them and either implements them (via Cursor) or rejects them with a reason.

---

## 7. Integration with Existing QA Services

The new architecture does not replace existing QA; it sits on top of all of them. Each existing service continues to do its job. The Meta-Harness layer reads their outputs and learns from them.

### 7.1. Integration Map

| Existing Service | Current Role | New Integration |
| :--- | :--- | :--- |
| `ResponseValidator` | Catches hallucinations (wrong items, wrong NPCs), auto-updates quests from narrative | Its `errors[]` output becomes a learning trigger. When it catches a hallucination, the `ReflectorAgent` is invoked to diagnose why the prompt allowed the hallucination. |
| `AvQaService` | Validates audio (silence, duration, format) and images (size, format, dimensions). Has a hardcoded one-shot retry suffix. | Its failure events become learning triggers. The hardcoded retry suffix (`"Include clear, audible environmental sounds."`) should eventually be replaced by skill-based retry guidance. |
| `BlueprintQaService` | Validates campaign blueprint structure (required fields, scope, naming) | Its `errors[]` and `warnings[]` become learning triggers for the Storyteller/Blueprint generation agents. |
| `PromptTestingService` | A/B tests prompts across models, tracks cost and latency | Its experiment results feed into the `ExperienceLedgerService`. Winning prompts can be distilled into skills. |
| `PromptOptimizationService` | Analyzes rated responses, generates quality specs and improvement suggestions | **Subsumed** by `ExperienceLedgerService`. Its quality spec concept evolves into the skill system. Its suggestion workflow evolves into the recommendation lane. |
| `IntentLearningService` | Captures user corrections to intent classification, upserts to Pinecone | Continues to operate independently for intent-specific learning. The `ExperienceLedgerService` can also generate skills that improve intent classification prompts. |
| `EventMonitor` | Detects gameplay patterns (quest stagnation, combat streaks) via hardcoded thresholds | Its thresholds become candidates for Lane 2 recommendations. The Meta-Harness can observe whether the EventMonitor's interventions actually improve gameplay. |

### 7.2. Data Flow Diagram (Updated v2.0)

The data flow now includes two parallel loops: the **reactive loop** (triggered by individual failures) and the **proactive loop** (driven by KAIROS and autoDream).

```
=== REACTIVE LOOP (Real-Time) ===

[Player Action]
       |
       v
[AI Agent] <--- [SkillRetriever: injects relevant skills from Pinecone]
       |
       v
[Response]
       |
       +---> [ResponseValidator / AvQaService / BlueprintQaService]
       |            |
       |            v
       |     [Validation Result: pass/fail + errors]
       |            |
       +---> [PromptLogService: logs everything including activeSkillIds]
                    |
                    +---> [Confidence Update: bump or decay active skills]
                    |
                    v
              [Strong Learning Trigger?]
                    |
           yes -----+
                    |
                    v
              [ReflectorAgent: diagnoses failure using full trace]
                    |
                    v
              [ExperienceDiagnosis: stored in PostgreSQL]


=== PROACTIVE LOOP (Background — KAIROS) ===

[Every 5 min]  ---> [KairosDaemon: receives KairosTickContext snapshot]
                          |
                          v
                    [Decision: no_action | trigger_reflection | trigger_consolidation | surface_recommendation | alert]
                          |
          +---------------+---------------+-------------------+
          |               |               |                   |
          v               v               v                   v
    [No Action]    [ReflectorAgent]  [autoDream]        [Lane 2 Recommendation]
                    (on worst agent)      |                   |
                          |               v                   v
                          v         [Merge duplicates]  [SystemRecommendation]
                   [ExperienceDiagnosis]  [Resolve contradictions]  [Admin Dashboard]
                                    [Promote diagnoses]
                                    [Evict stale skills]
                                          |
                                          v
                                    [ConsolidationReport]
                                          |
                                          v
                                    [Admin Dashboard]


=== SKILL PROMOTION (Both Loops) ===

[ExperienceDiagnosis pool]
       |
       v
[3+ similar diagnoses?] --yes--> [Create AgentSkill in PostgreSQL + Pinecone]
       |                                    |
       no                                   v
       |                          [Contradiction check against existing skills]
       v                                    |
[Wait for more evidence]           [Clean? --> Active]  [Conflict? --> Flagged]
```

---

## 8. Relationship to PromptOptimizationService

The existing `PromptOptimizationService` already does some of what the Meta-Harness proposer would do. It analyzes rated responses, learns "quality specs" (preferred tone, key phrases, avoid phrases), and generates improvement suggestions. The decision is to **evolve** this service rather than build a parallel system.

**What `PromptOptimizationService` currently has:**
- Quality spec infrastructure (per-template learned preferences)
- Suggestion workflow (propose → review → accept/reject)
- Admin UI integration (QualitySpecViewer, suggestion list)

**What it's missing:**
- Access to full execution traces (it only sees prompt + response, not the full `AIContext`)
- The skill storage/retrieval layer in Pinecone
- The ability to read signals from `ResponseValidator` and `AvQaService`
- Confidence decay and contradiction detection
- Cross-agent learning (it's template-scoped, not system-wide)

**Migration path:** The `ExperienceLedgerService` starts as a new service that wraps and extends `PromptOptimizationService`. Over time, the quality spec concept is replaced by the more flexible skill system, and the suggestion workflow is replaced by the recommendation lane. The existing admin UI components are extended rather than replaced.

---

## 9. MVP Scope and Implementation Phases

Following the project's MVP-first philosophy, implementation should be incremental. The phases below are updated from v1.0 to include KAIROS and autoDream.

### Phase 1: Enhanced Logging (Foundation)
- Add `fullContextTrace`, `activeSkillIds`, `retryCount`, `feedbackSignal`, `feedbackText` to `PromptLog`.
- Add the `ExperienceDiagnosis`, `AgentSkill`, and `ConsolidationReport` Prisma models.
- Create the `agent-skills` Pinecone namespace.
- Build the `ExperienceLedgerService` with basic CRUD for skills.
- **Deliverable:** The system captures richer data. Skills can be manually created via API.

### Phase 2: Skill Retrieval and Injection
- Build the `SkillRetriever` module in `ContextAssembler`.
- Implement the Pinecone query logic with metadata filtering.
- Add the "LESSONS FROM PRIOR EXPERIENCE" section to prompt assembly.
- Log `activeSkillIds` on every call.
- **Deliverable:** Manually created skills are injected into agent prompts at runtime.

### Phase 3: Feedback Loop and Confidence
- Implement confidence growth/decay based on generation outcomes.
- Implement auto-archive when confidence drops below threshold.
- Build the Admin Dashboard for skill management (browse, edit, create, archive).
- **Deliverable:** The system self-manages skill health. Developer has full visibility.

### Phase 4: Automated Diagnosis (ReflectorAgent)
- Build the `ReflectorAgent` (LLM-based diagnosis from traces).
- Wire up learning triggers from `ResponseValidator`, `AvQaService`, and retry events.
- Implement contradiction detection on skill creation.
- Implement automatic skill promotion (3+ similar diagnoses).
- **Deliverable:** The system learns from its own failures without human intervention.

### Phase 5: KAIROS Background Daemon
- Build the `KairosDaemon` as an APScheduler interval job (following the `signal_service.py` pattern).
- Implement the `KairosTickContext` snapshot builder (aggregates from `PromptLog`, `AgentSkill`, `ExperienceDiagnosis` tables).
- Implement the KAIROS decision LLM call (using `gpt-4.1-nano` or `gemini-2.5-flash` for cost efficiency).
- Wire KAIROS decisions to existing actions: trigger `ReflectorAgent`, create `SystemRecommendation`, log alerts.
- Add KAIROS tick history to the Admin Dashboard.
- **Deliverable:** The system has a persistent background observer that catches gradual degradation and cross-agent patterns.

### Phase 6: autoDream Memory Consolidation
- Build the `autoDreamConsolidator` sub-process, triggered by KAIROS during idle periods.
- Implement Operation 1 (merge near-duplicates via Pinecone similarity scan).
- Implement Operation 2 (resolve flagged contradictions via `ReflectorAgent`).
- Implement Operation 3 (batch-promote pending diagnoses).
- Implement Operation 4 (evict stale skills).
- Implement the `ConsolidationReport` generation and Admin Dashboard view.
- Implement safety constraints (session-aware pause, operation caps, cost cap).
- **Deliverable:** The system autonomously maintains memory hygiene during idle periods.

### Phase 7: Lane 2 Recommendations and Full Integration
- Implement the Lane 2 recommendation system with `SystemRecommendation` records.
- Generate Cursor-ready prompts for recommended code/config changes.
- Wire KAIROS `surface_recommendation` decisions to the recommendation pipeline.
- Build the recommendation review UI in the Admin Dashboard.
- End-to-end integration testing across all phases.
- **Deliverable:** The complete self-learning loop is operational: observe → diagnose → learn → inject → evaluate → consolidate → recommend.

---

## 10. Key Design Decisions and Rationale

This section captures the reasoning behind major design choices, so future sessions can understand *why* the architecture is shaped this way.

**Why not let the AI rewrite code?** The Meta-Harness paper's proposer writes Python code directly. This works for their use case (stateless classifiers with automated benchmarks) but is too risky for the AI DM. A bad code change in `ContextAssembler.ts` could break all agent calls. A bad skill injection only affects one generation and self-corrects via confidence decay. The risk profile is fundamentally different.

**Why Pinecone for skills (not just PostgreSQL)?** Skills need to be retrieved by *semantic similarity*, not exact match. When the ImageAgent is generating "a dark elven throne room," it needs to find skills about "dark interior lighting" even if those exact words aren't in the query. This is exactly what vector similarity search does. PostgreSQL's `pg_vector` extension could work as an alternative, but the project already uses Pinecone for intent classification, so using the same infrastructure reduces complexity.

**Why 3+ diagnoses before auto-promotion?** A single diagnosis could be a fluke or a misdiagnosis by the `ReflectorAgent`. Requiring 3+ similar diagnoses provides statistical confidence that the pattern is real. This threshold is configurable and should be tuned based on experience.

**Why asymmetric confidence adjustment (+0.05 / -0.1)?** It should be harder to gain trust than to lose it. A skill that fails even occasionally should be scrutinized. The 2:1 ratio means a skill needs roughly 2 successes for every 1 failure to maintain its confidence. This is conservative by design.

**Why silent injection instead of approval-per-generation?** The developer explicitly stated that approval per generation would add too much friction. The system should "just do it, log it, and let me see what happened." The Admin Dashboard provides after-the-fact oversight, which is sufficient given that skill injection is low-risk (additive context only).

**Why extend PromptOptimizationService instead of building from scratch?** It already has quality spec infrastructure, suggestion workflows, and admin UI integration. Building a parallel system would create confusion about which service to use. Extending preserves existing work and provides a migration path.

**Why add KAIROS instead of just using cron-scheduled pattern detection?** (v2.0) The original design relied on a `PatternDetector` running on a fixed cron schedule (e.g., nightly). This has two problems: (1) slow-developing issues between scheduled runs go unnoticed, and (2) the decision of *what to do* was hardcoded in the job logic rather than being an intelligent decision. KAIROS replaces the fixed schedule with an adaptive tick that uses a cheap LLM call to decide whether action is needed. Most ticks result in "no action" — the system only acts when the evidence warrants it. This is the same pattern Anthropic uses in their production Claude Code agent [5].

**Why run autoDream only during idle periods?** Memory consolidation involves multiple Pinecone queries and LLM calls (for merge decisions and contradiction resolution). Running this during active gameplay would compete for resources and could increase latency for player-facing requests. The idle-period constraint ensures consolidation never degrades the player experience. The 15-minute idle threshold is conservative and can be tuned.

**Why cap autoDream operations per run?** (10 merges, 5 contradiction resolutions, 10 promotions, $0.50 cost cap) Without caps, a single consolidation run could make dozens of changes to the skill library, making it impossible to debug if something goes wrong. The caps ensure each run is small enough to review in the Admin Dashboard. Remaining work is picked up on the next idle window — there's no urgency to consolidate everything at once.

**Why use a cheap model for KAIROS ticks?** The KAIROS tick decision is a simple classification task: given a health snapshot, choose one of five actions. This does not require the reasoning power of GPT-4 or Claude Sonnet. Using `gpt-4.1-nano` or `gemini-2.5-flash` keeps the per-tick cost under $0.001, making it economically feasible to tick every 5 minutes indefinitely.

---

## 11. Open Questions for Future Discussion

1. **Skill Namespacing:** Should skills be namespaced per campaign/world, or are they always global? A skill learned in a "dark fantasy" campaign might not apply to a "sci-fi" campaign. The `domain` field partially addresses this, but explicit namespacing may be needed.

2. **Cross-Agent Learning:** Can a skill learned by the ImageAgent benefit the NarratorAgent? For example, "dark interior scenes need explicit lighting" might apply to both image generation and narrative description. The `targetAgent: 'all'` option exists but needs careful testing.

3. **Cost Monitoring:** The `ReflectorAgent` is itself an LLM call. If it fires on every validation failure, the cost could add up. Should there be a rate limit or budget cap on reflection calls?

4. **Player-Facing Transparency:** Should players ever see that the system is learning? For example, "The AI DM has improved its image generation based on your feedback." This could build trust but also set expectations.

5. **Regression Testing:** When a new skill is created, should the system re-run a set of "golden" test cases to ensure the skill doesn't degrade performance on known-good scenarios? This mirrors the staging/production pattern already designed for intent classification.

6. **KAIROS Tick Frequency Tuning:** The 5-minute active / 30-minute idle tick intervals are initial estimates. Should the system adaptively adjust tick frequency based on observed volatility? (e.g., tick more frequently during the first hour after a deployment, when new issues are most likely).

7. **autoDream Merge Quality:** When autoDream merges two similar skills, the merged skill's `ruleText` is generated by the `ReflectorAgent`. How do we validate that the merge didn't lose important nuance from either original? Should merged skills start at a lower confidence (e.g., 0.5) to force re-validation through use?

8. **Cross-Project Learning:** If the developer runs multiple AI DM campaigns with different settings, should skills learned in one campaign transfer to another? The `domain` field partially addresses this, but campaign-specific vs. universal skill classification may need explicit handling.

9. **KAIROS Observability:** Should KAIROS tick decisions be visible in the Admin Dashboard in real-time (like a heartbeat monitor), or only when it takes action? Real-time visibility adds development cost but provides confidence that the system is alive and watching.

---

## References

[1]: Lee, Y., et al. (2025). "Meta-Harness: LLMs Can Write Better Code When They Search Over Prior Attempts." https://yoonholee.com/meta-harness/

[2]: Wang, G., et al. (2023). "Voyager: An Open-Ended Embodied Agent with Large Language Models." arXiv:2305.16291. https://voyager.minedojo.org/

[3]: Tanaike. (2026). "Recursive Knowledge Crystallization: A Framework for Persistent Autonomous Agent Self-Evolution." https://dev.to/gde/recursive-knowledge-crystallization-a-framework-for-persistent-autonomous-agent-self-evolution-4mk4

[4]: Kang, J., et al. (2025). "Memory OS of AI Agent." Proceedings of EMNLP 2025. https://aclanthology.org/2025.emnlp-main.1318/

[5]: The New Stack. (2026). "Inside Claude Code's leaked source: swarms, daemons, and 44 features Anthropic kept behind flags." https://thenewstack.io/claude-code-source-leak/ — Primary source for KAIROS and autoDream architectural patterns. See also: AI DM project document `docs/core/12-claude-code-architecture-analysis.md` for the full analysis.

[6]: Latent Space. (2026). "[AINews] The Claude Code Source Leak." https://www.latent.space/p/ainews-the-claude-code-source-leak

[7]: GitHub. (2026). "JackChen-me/open-multi-agent." https://github.com/JackChen-me/open-multi-agent — Open-source extraction of Claude Code's multi-agent orchestration layer. Evaluated for future Phase 2+ adoption.

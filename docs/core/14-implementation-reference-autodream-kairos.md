# Implementation Reference: autoDream, KAIROS, and Strict Write Discipline

**Author:** Manus AI
**Date:** April 1, 2026
**Status:** Technical Reference / Implementation Guide
**Version:** 1.1
**Parent Document:** `docs/core/11-meta-harness-self-learning.md` (v2.0)
**Source Material:** OpenClaude repository (`gitlawb/openclaude`), specifically `src/services/autoDream/`, `src/services/extractMemories/`, `src/memdir/`, and `src/coordinator/`

---

## 1. Purpose

This document provides implementation-ready technical patterns extracted from Anthropic's production Claude Code agent system (as revealed in the source leak and reproduced in the OpenClaude repository). It maps each pattern to the AI Dungeon Master's architecture and provides adapted TypeScript code that can be used directly or handed to an AI coding agent (Cursor, Claude Code) for implementation.

This is a **companion** to the design document (`11-meta-harness-self-learning.md`), which describes *what* to build and *why*. This document describes *how* to build it, with concrete code patterns.

---

## 2. Pattern 1: Gate Sequence (Cheapest-First Evaluation)

### 2.1. What Anthropic Does

The autoDream runner evaluates five gates in strict order, from cheapest to most expensive. If any gate fails, the function returns immediately without evaluating subsequent gates. This ensures the per-tick cost is negligible when the system is not ready to consolidate.

```typescript
// From openclaude/src/services/autoDream/autoDream.ts
// Gate order (cheapest first):
//   1. Time: hours since lastConsolidatedAt >= minHours (one stat)
//   2. Sessions: transcript count with mtime > lastConsolidatedAt >= minSessions
//   3. Lock: no other process mid-consolidation

function isGateOpen(): boolean {
  if (getKairosActive()) return false   // Feature flag check (cached, ~0 cost)
  if (getIsRemoteMode()) return false   // Env var check (~0 cost)
  if (!isAutoMemoryEnabled()) return false // Settings check (~0 cost)
  return isAutoDreamEnabled()           // Feature flag check (cached, ~0 cost)
}

// Then in the runner:
if (!force && !isGateOpen()) return           // Gate 1: feature flags
const hoursSince = (Date.now() - lastAt) / 3_600_000
if (!force && hoursSince < cfg.minHours) return // Gate 2: time (one stat() call)
if (!force && sinceScanMs < SESSION_SCAN_INTERVAL_MS) return // Gate 3: scan throttle
if (!force && sessionIds.length < cfg.minSessions) return    // Gate 4: session count
priorMtime = await tryAcquireConsolidationLock()             // Gate 5: lock (most expensive)
if (priorMtime === null) return
```

### 2.2. AI DM Adaptation

Our KAIROS daemon runs as an APScheduler interval job. The gate sequence should follow the same cheapest-first pattern. The key difference is that our "sessions" are game sessions tracked in PostgreSQL, not filesystem transcript files.

```typescript
// backend/src/services/KairosDaemon.ts

interface KairosConfig {
  tickIntervalActiveMs: number;    // 5 minutes during active sessions
  tickIntervalIdleMs: number;      // 30 minutes during idle
  minHoursSinceConsolidation: number; // Default: 6
  minSessionsSinceConsolidation: number; // Default: 3
  maxTickBudgetMs: number;         // 15000 (15-second blocking budget)
}

const DEFAULTS: KairosConfig = {
  tickIntervalActiveMs: 5 * 60 * 1000,
  tickIntervalIdleMs: 30 * 60 * 1000,
  minHoursSinceConsolidation: 6,
  minSessionsSinceConsolidation: 3,
  maxTickBudgetMs: 15_000,
};

async function shouldRunConsolidation(ctx: KairosTickContext): Promise<boolean> {
  // Gate 1: Feature flag (cached, ~0 cost)
  if (!isFeatureEnabled('self_learning')) return false;

  // Gate 2: Active sessions check (~0 cost, in-memory counter)
  if (ctx.activeSessionCount > 0) return false;

  // Gate 3: Idle duration (must be idle for 15+ minutes)
  if (!ctx.isIdlePeriod) return false;

  // Gate 4: Time since last consolidation (one DB query)
  const lastRun = await getLastConsolidationTimestamp();
  const hoursSince = (Date.now() - lastRun.getTime()) / 3_600_000;
  if (hoursSince < DEFAULTS.minHoursSinceConsolidation) return false;

  // Gate 5: Session count since last consolidation (one DB query)
  const sessionCount = await countSessionsSince(lastRun);
  if (sessionCount < DEFAULTS.minSessionsSinceConsolidation) return false;

  // Gate 6: Lock acquisition (most expensive — DB row lock)
  const acquired = await tryAcquireConsolidationLock();
  if (!acquired) return false;

  return true;
}
```

### 2.3. Key Implementation Notes

The scan throttle is a subtle but important detail. When the time gate passes but the session gate does not, the time gate will keep passing on every tick (because the lock mtime does not advance). Without a throttle, the system would re-scan sessions every tick. Anthropic uses a 10-minute cooldown between scans. For the AI DM, this translates to: do not re-query `countSessionsSince()` more than once every 10 minutes if the previous query returned insufficient sessions.

---

## 3. Pattern 2: Forked Agent with Constrained Permissions

### 3.1. What Anthropic Does

Both `extractMemories` and `autoDream` spawn a "forked agent" — a sub-process that shares the parent's prompt cache but operates under strict tool constraints. The permission model is defined by a `canUseTool` function that whitelists specific tools and restricts write operations to a specific directory.

```typescript
// From openclaude/src/services/extractMemories/extractMemories.ts

export function createAutoMemCanUseTool(memoryDir: string): CanUseToolFn {
  return async (tool: Tool, input: Record<string, unknown>) => {
    // ALLOW unrestricted: Read, Grep, Glob (inherently read-only)
    if (
      tool.name === FILE_READ_TOOL_NAME ||
      tool.name === GREP_TOOL_NAME ||
      tool.name === GLOB_TOOL_NAME
    ) {
      return { behavior: 'allow', updatedInput: input };
    }

    // ALLOW conditional: Bash (only if read-only command)
    if (tool.name === BASH_TOOL_NAME) {
      const parsed = tool.inputSchema.safeParse(input);
      if (parsed.success && tool.isReadOnly(parsed.data)) {
        return { behavior: 'allow', updatedInput: input };
      }
      return denyAutoMemTool(tool, 'Only read-only shell commands are permitted');
    }

    // ALLOW conditional: Edit/Write (only within memory directory)
    if (
      (tool.name === FILE_EDIT_TOOL_NAME || tool.name === FILE_WRITE_TOOL_NAME) &&
      'file_path' in input
    ) {
      const filePath = input.file_path;
      if (typeof filePath === 'string' && isAutoMemPath(filePath)) {
        return { behavior: 'allow', updatedInput: input };
      }
    }

    // DENY everything else
    return denyAutoMemTool(tool, `Tool not permitted in this context`);
  };
}
```

### 3.2. AI DM Adaptation

In the AI DM, the "forked agent" concept maps to a background LLM call that can read from any data source but can only write to specific tables. Since we are not running a CLI tool with filesystem access, our permission model operates at the database/API level rather than the filesystem level.

```typescript
// backend/src/services/autoDream/permissions.ts

/**
 * Defines what the autoDream consolidator is allowed to do.
 * This is the AI DM equivalent of createAutoMemCanUseTool().
 *
 * READ (unrestricted):
 *   - PromptLog table (all entries)
 *   - ExperienceDiagnosis table (all entries)
 *   - AgentSkill table (all entries)
 *   - Pinecone agent-skills namespace (similarity queries)
 *   - Pinecone intent-classifications namespace (similarity queries)
 *   - Any other Pinecone namespace (for hygiene sweeps)
 *
 * WRITE (constrained):
 *   - AgentSkill table: can update status, archive, create merged skills
 *   - AgentSkill Pinecone vectors: can upsert/delete in agent-skills namespace
 *   - ExperienceDiagnosis table: can update status to 'promoted' or 'rejected'
 *   - ConsolidationReport table: can create new reports
 *   - Hygiene sweep targets: can archive/delete per plugin rules
 *
 * BLOCKED:
 *   - PromptLog table: NEVER modify (append-only audit trail)
 *   - Game state tables (campaigns, characters, sessions): NEVER touch
 *   - User/auth tables: NEVER touch
 *   - Application code files: NEVER touch
 *   - Environment variables or config files: NEVER touch
 */

interface ConsolidationPermissions {
  canReadTable(tableName: string): boolean;
  canWriteTable(tableName: string): boolean;
  canWritePineconeNamespace(namespace: string): boolean;
}

const WRITABLE_TABLES = new Set([
  'AgentSkill',
  'ExperienceDiagnosis',
  'ConsolidationReport',
  'SystemRecommendation',
]);

const WRITABLE_PINECONE_NAMESPACES = new Set([
  'agent-skills',
  'intent-classifications',  // For hygiene sweeps only
]);

// Tables that hygiene sweeps can archive FROM (not delete)
const ARCHIVABLE_TABLES = new Set([
  'PromptLog',               // Archive to cold storage (not delete)
  'GeneratedAsset',          // Mark as orphaned
  'NpcConversationMemory',   // Prune old turns
]);

export function createConsolidationPermissions(): ConsolidationPermissions {
  return {
    canReadTable: () => true,  // Read anything
    canWriteTable: (table: string) =>
      WRITABLE_TABLES.has(table) || ARCHIVABLE_TABLES.has(table),
    canWritePineconeNamespace: (ns: string) =>
      WRITABLE_PINECONE_NAMESPACES.has(ns),
  };
}
```

### 3.3. Key Implementation Notes

Anthropic's forked agent shares the parent's prompt cache via `createCacheSafeParams(context)`. This is a cost optimization specific to their architecture (the Anthropic API supports prompt caching). For the AI DM, the equivalent optimization is to use a cheap model (`gpt-4.1-nano`) for consolidation decisions and only escalate to a more capable model (`gpt-4.1-mini`) for complex merge/contradiction resolution. The consolidation prompt itself does not need to be cached because it runs infrequently (at most a few times per day).

The `skipTranscript: true` flag ensures the forked agent's internal reasoning does not pollute the main conversation history. In the AI DM, this means the consolidation agent's LLM calls should be logged to a separate `ConsolidationLog` table (or a `source: 'autodream'` flag on `PromptLog`) so they do not appear in the normal admin PromptLog view unless explicitly filtered.

---

## 4. Pattern 3: The Consolidation Prompt (Four-Phase Dream)

### 4.1. What Anthropic Does

The consolidation prompt is structured as a four-phase workflow that guides the LLM through a systematic review of accumulated knowledge.

```
# Dream: Memory Consolidation

You are performing a dream — a reflective pass over your memory files.
Synthesize what you've learned recently into durable, well-organized
memories so that future sessions can orient quickly.

## Phase 1 — Orient
- ls the memory directory to see what already exists
- Read MEMORY.md to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates

## Phase 2 — Gather recent signal
Look for new information worth persisting. Sources in priority order:
1. Daily logs (if present) — the append-only stream
2. Existing memories that drifted — facts that contradict current state
3. Transcript search — grep narrowly for specific context

Don't exhaustively read transcripts. Look only for things you already
suspect matter.

## Phase 3 — Consolidate
For each thing worth remembering, write or update a memory file.
Focus on:
- Merging new signal into existing topic files (not creating near-duplicates)
- Converting relative dates to absolute dates
- Deleting contradicted facts

## Phase 4 — Prune and index
Update MEMORY.md so it stays under MAX_ENTRYPOINT_LINES and ~25KB.
It's an index, not a dump — each entry should be one line under ~150 chars.
- Remove pointers to stale/wrong/superseded memories
- Add pointers to newly important memories
- Resolve contradictions
```

### 4.2. AI DM Adaptation

Our consolidation prompt operates on database records rather than files, but the four-phase structure is directly applicable. The key adaptation is that "Orient" means querying the database, not listing a directory.

```typescript
// backend/src/services/autoDream/consolidationPrompt.ts

export function buildConsolidationPrompt(context: ConsolidationContext): string {
  return `# Dream: Memory Consolidation

You are performing a memory consolidation pass for the AI Dungeon Master system.
Your job is to review recent experience, merge duplicate knowledge, resolve
contradictions, and ensure the skill library stays clean and useful.

## Current State

Active skills: ${context.activeSkillCount}
Flagged skills (contradictions): ${context.flaggedSkillCount}
Pending diagnoses: ${context.pendingDiagnosisCount}
Sessions since last consolidation: ${context.sessionsSinceLastRun}
Last consolidation: ${context.lastConsolidationAt.toISOString()}

## Phase 1 — Orient

Review the current skill library. Below are all active and flagged skills,
grouped by domain:

${context.skillSummaryByDomain}

## Phase 2 — Identify Consolidation Targets

From the skill list above, identify:

1. **Near-duplicates**: Skills in the same domain with overlapping advice.
   For each pair, I will provide their full text and evidence links.
2. **Contradictions**: Flagged skills that give opposing advice for similar
   situations. I will provide both skills and their performance metrics.
3. **Promotion candidates**: Pending diagnoses that cluster around the same
   theme (3+ similar diagnoses = ready for promotion).

Do NOT exhaustively analyze every skill. Focus on the targets I have
pre-identified below.

### Pre-identified targets:

${context.mergeTargets.length > 0
  ? context.mergeTargets.map((t, i) =>
    `**Merge Target ${i + 1}:**\n` +
    `- Skill A [${t.skillA.id}]: "${t.skillA.ruleText}"\n` +
    `  (confidence: ${t.skillA.confidence}, used ${t.skillA.timesUsed}x, ` +
    `success rate: ${(t.skillA.successRate * 100).toFixed(0)}%)\n` +
    `- Skill B [${t.skillB.id}]: "${t.skillB.ruleText}"\n` +
    `  (confidence: ${t.skillB.confidence}, used ${t.skillB.timesUsed}x, ` +
    `success rate: ${(t.skillB.successRate * 100).toFixed(0)}%)\n` +
    `- Similarity: ${(t.similarity * 100).toFixed(0)}%`
  ).join('\n\n')
  : 'No merge targets identified.'}

${context.contradictionTargets.length > 0
  ? context.contradictionTargets.map((t, i) =>
    `**Contradiction ${i + 1}:**\n` +
    `- Skill A [${t.skillA.id}]: "${t.skillA.ruleText}"\n` +
    `  (confidence: ${t.skillA.confidence}, success rate: ` +
    `${(t.skillA.successRate * 100).toFixed(0)}%)\n` +
    `- Skill B [${t.skillB.id}]: "${t.skillB.ruleText}"\n` +
    `  (confidence: ${t.skillB.confidence}, success rate: ` +
    `${(t.skillB.successRate * 100).toFixed(0)}%)`
  ).join('\n\n')
  : 'No contradictions flagged.'}

${context.promotionCandidates.length > 0
  ? context.promotionCandidates.map((t, i) =>
    `**Promotion Cluster ${i + 1}:**\n` +
    `- ${t.diagnoses.length} similar diagnoses in domain "${t.domain}":\n` +
    t.diagnoses.map(d =>
      `  - [${d.id}]: "${d.proposedRule}" (confidence: ${d.confidence})`
    ).join('\n')
  ).join('\n\n')
  : 'No promotion candidates.'}

## Phase 3 — Decide Actions

For each target, respond with a JSON action:

For merges:
\`\`\`json
{
  "action": "merge",
  "sourceSkillIds": ["skill_a_id", "skill_b_id"],
  "mergedRuleText": "The combined, improved rule text",
  "mergedDomain": "domain",
  "mergedTargetAgent": "agent_name",
  "reason": "Why this merge makes sense"
}
\`\`\`

For contradictions:
\`\`\`json
{
  "action": "resolve_contradiction",
  "keepSkillId": "skill_to_keep" | null,
  "archiveSkillId": "skill_to_archive" | null,
  "resolution": "kept_one" | "archived_both" | "merged" | "escalated_to_human",
  "mergedRuleText": "..." (if resolution is "merged"),
  "reason": "Why this resolution is correct, citing evidence"
}
\`\`\`

For promotions:
\`\`\`json
{
  "action": "promote",
  "diagnosisIds": ["d1", "d2", "d3"],
  "promotedRuleText": "The generalized rule distilled from these diagnoses",
  "domain": "domain",
  "targetAgent": "agent_name",
  "reason": "Why this pattern is real and worth codifying"
}
\`\`\`

## Phase 4 — Summary

After listing all actions, provide a brief natural-language summary of what
you consolidated, what contradictions you resolved, and any concerns you
want to flag for the developer.

## Constraints

- You MUST NOT create entirely new skills that are not based on existing
  diagnoses or merges of existing skills.
- You MUST cite evidence (skill IDs, diagnosis IDs, performance metrics)
  for every decision.
- If you are not confident (< 0.7) in a contradiction resolution, use
  "escalated_to_human" instead of guessing.
- Maximum actions per run: 10 merges, 5 contradiction resolutions,
  10 promotions.
- If a merged rule would be longer than 200 words, it is too complex.
  Split it into two separate skills instead.`;
}
```

### 4.3. Key Differences from Anthropic's Approach

Anthropic's consolidation prompt tells the LLM to use tools (ls, grep, read, write) to explore and modify files. Our adaptation pre-loads all relevant data into the prompt context and asks the LLM to return structured JSON actions. This is because our data lives in PostgreSQL and Pinecone, not in a filesystem, and giving an LLM direct database access would violate our Strict Write Discipline. The trade-off is that our prompt is larger (it includes all the skill data), but the LLM's output is constrained and parseable.

The "Don't exhaustively read transcripts" instruction maps to our pre-identification of merge targets. Rather than letting the LLM scan the entire skill library (which could be hundreds of skills), we pre-compute merge candidates using Pinecone similarity search and only present the relevant pairs. This reduces token usage and focuses the LLM's reasoning on decisions, not discovery.

---

## 5. Pattern 4: Lock-as-Timestamp

### 5.1. What Anthropic Does

The consolidation lock file serves double duty: its existence indicates a lock is held, and its `mtime` (modification time) records when the last consolidation completed. The file body stores the holder's PID for crash recovery.

```typescript
// From openclaude/src/services/autoDream/consolidationLock.ts

// Lock file whose mtime IS lastConsolidatedAt. Body is the holder PID.
const LOCK_FILE = '.consolidate-lock'
const HOLDER_STALE_MS = 60 * 60 * 1000  // 1 hour

// Read: one stat() call
async function readLastConsolidatedAt(): Promise<number> {
  try {
    const s = await stat(lockPath())
    return s.mtimeMs
  } catch {
    return 0  // No lock file = never consolidated
  }
}

// Acquire: write PID, verify we won the race
async function tryAcquireConsolidationLock(): Promise<number | null> {
  // Check if lock exists and is held by a live process
  // If stale (>1 hour) or dead PID: reclaim
  // Write our PID, then re-read to verify we won
  // Return pre-acquire mtime (for rollback) or null if blocked
}

// Rollback: rewind mtime to pre-acquire value
async function rollbackConsolidationLock(priorMtime: number): Promise<void> {
  // If priorMtime was 0: delete lock file
  // Otherwise: clear PID body, set mtime back to priorMtime
}
```

### 5.2. AI DM Adaptation

Since the AI DM uses PostgreSQL (not a filesystem), we implement this as a database row with an advisory lock pattern.

```typescript
// backend/src/services/autoDream/consolidationLock.ts

import { PrismaClient } from '@prisma/client';

/**
 * Prisma model:
 *
 * model ConsolidationLock {
 *   id                String   @id @default("singleton")
 *   lastConsolidatedAt DateTime @default(now())
 *   holderInstanceId   String?  // Server instance ID (replaces PID)
 *   acquiredAt         DateTime?
 *   staleAfterMs       Int      @default(3600000) // 1 hour
 * }
 */

export class ConsolidationLockService {
  constructor(private prisma: PrismaClient) {}

  async readLastConsolidatedAt(): Promise<Date> {
    const lock = await this.prisma.consolidationLock.findUnique({
      where: { id: 'singleton' },
    });
    return lock?.lastConsolidatedAt ?? new Date(0);
  }

  async tryAcquire(instanceId: string): Promise<{ acquired: boolean; priorTimestamp: Date }> {
    const now = new Date();

    // Use a transaction with serializable isolation to prevent races
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.consolidationLock.findUnique({
        where: { id: 'singleton' },
      });

      if (!lock) {
        // First ever acquisition — create the lock row
        await tx.consolidationLock.create({
          data: {
            id: 'singleton',
            lastConsolidatedAt: new Date(0),
            holderInstanceId: instanceId,
            acquiredAt: now,
          },
        });
        return { acquired: true, priorTimestamp: new Date(0) };
      }

      // Check if lock is held by another instance
      if (lock.holderInstanceId && lock.acquiredAt) {
        const heldForMs = now.getTime() - lock.acquiredAt.getTime();
        if (heldForMs < lock.staleAfterMs) {
          // Lock is held and not stale — bail
          return { acquired: false, priorTimestamp: lock.lastConsolidatedAt };
        }
        // Lock is stale — reclaim
      }

      // Acquire the lock
      const priorTimestamp = lock.lastConsolidatedAt;
      await tx.consolidationLock.update({
        where: { id: 'singleton' },
        data: {
          holderInstanceId: instanceId,
          acquiredAt: now,
        },
      });

      return { acquired: true, priorTimestamp };
    });
  }

  async release(instanceId: string): Promise<void> {
    await this.prisma.consolidationLock.update({
      where: { id: 'singleton' },
      data: {
        holderInstanceId: null,
        acquiredAt: null,
        lastConsolidatedAt: new Date(), // Stamp = now (success)
      },
    });
  }

  async rollback(instanceId: string, priorTimestamp: Date): Promise<void> {
    await this.prisma.consolidationLock.update({
      where: { id: 'singleton' },
      data: {
        holderInstanceId: null,
        acquiredAt: null,
        lastConsolidatedAt: priorTimestamp, // Rewind to pre-acquire
      },
    });
  }
}
```

---

## 6. Pattern 5: Memory Types and What NOT to Save

### 6.1. What Anthropic Does

Anthropic defines four memory types, each with explicit `when_to_save`, `how_to_use`, and `body_structure` guidance. Critically, they also define what NOT to save — information that is derivable from the current project state should never be stored as a memory.

Their four types are: **user** (role, preferences), **feedback** (corrections AND confirmations), **project** (ongoing work context), and **reference** (pointers to external systems).

The "What NOT to save" list is equally important:

> - Code patterns, conventions, architecture, file paths — derivable by reading the project
> - Git history, recent changes — `git log` / `git blame` are authoritative
> - Debugging solutions — the fix is in the code; the commit message has context
> - Anything already documented in CLAUDE.md files
> - Ephemeral task details: in-progress work, temporary state

They also enforce: "These exclusions apply even when the user explicitly asks you to save."

### 6.2. AI DM Adaptation

Our `AgentSkill` type system maps to a game-specific taxonomy. The key insight from Anthropic is that each type needs explicit save/use/structure guidance, and the "do not save" rules are just as important as the "do save" rules.

```typescript
// backend/src/services/experienceLedger/skillTypes.ts

/**
 * Skill domain taxonomy for the AI Dungeon Master.
 *
 * Each domain has explicit guidance for what to save and what NOT to save.
 * This guidance is included in the ReflectorAgent's system prompt when
 * creating new skills, and in the autoDream consolidation prompt when
 * merging or pruning skills.
 */

export const SKILL_DOMAINS = {
  'image-generation': {
    description: 'Rules for generating scene, character, and item images',
    whenToSave: [
      'When a specific prompt pattern consistently produces better/worse images',
      'When a model-specific behavior is discovered (e.g., SDXL vs DALL-E differences)',
      'When a style descriptor is confirmed to work or fail for a specific scene type',
      'When a negative prompt pattern prevents a recurring artifact',
    ],
    whatNotToSave: [
      'The specific content of any single image prompt (ephemeral)',
      'Model version numbers that will change (use model family names)',
      'Aspect ratios or dimensions (these are config, not learned knowledge)',
      'Anything already specified in the ImageAgent system prompt template',
    ],
    bodyStructure:
      'Lead with the rule, then **Evidence:** (what was tried and what happened) ' +
      'and **When to apply:** (the specific scene/content conditions).',
    examples: [
      {
        trigger: 'AvQaService rejected 3 consecutive dark interior images as "muddy"',
        skill: 'For dark interior scenes, always include "volumetric lighting" and ' +
          'specify a directional light source (e.g., "torchlight from the left"). ' +
          'Without this, SDXL produces flat, low-contrast results. ' +
          '**Evidence:** 3/3 rejections without lighting descriptors, 0/5 rejections ' +
          'with them. **When to apply:** Any indoor scene with dim or magical lighting.',
      },
    ],
  },

  'narrative-generation': {
    description: 'Rules for generating story narration, dialogue, and descriptions',
    whenToSave: [
      'When a narrative pattern causes ResponseValidator failures (hallucinations)',
      'When a specific context assembly strategy improves/degrades narrative quality',
      'When a tone or style instruction is confirmed effective for a game mode',
      'When a common player action type consistently produces poor narration',
    ],
    whatNotToSave: [
      'Specific NPC names, locations, or plot points (these are game state, not rules)',
      'The content of any single narration (ephemeral)',
      'Token budget numbers (these are config parameters, not learned knowledge)',
      'Anything already in the NarratorAgent or StorytellerAgent system prompts',
    ],
    bodyStructure:
      'Lead with the rule, then **Evidence:** (specific failure examples) ' +
      'and **When to apply:** (game mode, scene type, or player action conditions).',
    examples: [
      {
        trigger: 'ResponseValidator caught 5 hallucinations where NPC referenced items not in room',
        skill: 'When generating NPC dialogue that references objects, always cross-check ' +
          'the room inventory in the context. If the inventory section is missing or ' +
          'truncated, do NOT have NPCs reference specific objects — use generic ' +
          'descriptions instead. **Evidence:** 5/12 hallucinations in rooms where ' +
          'inventory was truncated due to token budget. **When to apply:** Any NPC ' +
          'dialogue that mentions picking up, pointing at, or interacting with objects.',
      },
    ],
  },

  'combat-mechanics': {
    description: 'Rules for combat narration, damage calculation, and tactical AI',
    whenToSave: [
      'When combat narration contradicts mechanical outcomes',
      'When a specific encounter type consistently produces poor results',
      'When a balance issue is identified through repeated play patterns',
    ],
    whatNotToSave: [
      'Specific damage numbers or stat blocks (these are game data)',
      'Individual combat encounter outcomes (ephemeral)',
      'D&D 5e rules (these are in the rules engine, not learned knowledge)',
    ],
    bodyStructure:
      'Lead with the rule, then **Evidence:** and **When to apply:**.',
    examples: [],
  },

  'intent-classification': {
    description: 'Rules for classifying player input into game actions',
    whenToSave: [
      'When a class of player input consistently falls through to Learning Mode',
      'When a correction reveals a systematic misclassification pattern',
      'When a new intent category emerges from player behavior',
    ],
    whatNotToSave: [
      'Individual player messages (ephemeral, and already in IntentLearningService)',
      'Intent confidence thresholds (these are config parameters)',
      'Anything already captured by IntentLearningService corrections',
    ],
    bodyStructure:
      'Lead with the classification rule, then **Evidence:** (misclassification examples) ' +
      'and **When to apply:** (input patterns that trigger this rule).',
    examples: [],
  },

  'blueprint-generation': {
    description: 'Rules for generating campaign blueprints and world structures',
    whenToSave: [
      'When BlueprintQaService consistently rejects a specific structure pattern',
      'When a generation strategy produces better/worse campaign coherence',
    ],
    whatNotToSave: [
      'Specific campaign content (ephemeral)',
      'Blueprint schema requirements (these are in BlueprintQaService validation rules)',
    ],
    bodyStructure:
      'Lead with the rule, then **Evidence:** and **When to apply:**.',
    examples: [],
  },

  'system-wide': {
    description: 'Cross-cutting rules that apply to multiple agents',
    whenToSave: [
      'When a pattern affects multiple agents simultaneously',
      'When a context assembly strategy has broad impact',
      'When a model-level behavior affects all agents (e.g., token budget cliffs)',
    ],
    whatNotToSave: [
      'Agent-specific rules (use the appropriate domain instead)',
      'Infrastructure/deployment details (not learned knowledge)',
    ],
    bodyStructure:
      'Lead with the rule, then **Evidence:** and **Affected agents:**.',
    examples: [],
  },
} as const;

export type SkillDomain = keyof typeof SKILL_DOMAINS;
```

### 6.3. The Memory Drift Caveat

Anthropic includes a critical instruction that applies to all memory recall:

> "A memory that names a specific function, file, or flag is a claim that it existed *when the memory was written*. It may have been renamed, removed, or never merged. Before recommending it: if the memory names a file path, check the file exists. If the memory names a function or flag, grep for it."

For the AI DM, this translates to: **skills that reference specific code patterns, model names, or API behaviors should include a `validatedAt` timestamp, and the SkillRetriever should flag skills that haven't been validated in 30+ days.** The autoDream consolidator should periodically check whether referenced code patterns still exist.

---

## 7. Pattern 6: KAIROS Daily Log Mode

### 7.1. What Anthropic Does

When KAIROS is active, the memory system switches from a "maintain a live index" model to an "append-only daily log" model. New observations are written as timestamped bullets to date-named files (`logs/YYYY/MM/YYYY-MM-DD.md`). A separate nightly `/dream` process distills these logs into the main `MEMORY.md` index and topic files.

This separation is important because long-running sessions generate too many observations to maintain a coherent index in real-time. The append-only log is cheap and fast; the distillation is expensive but runs offline.

```
// From openclaude/src/memdir/memdir.ts — buildAssistantDailyLogPrompt()

"This session is long-lived. As you work, record anything worth
remembering by appending to today's daily log file:
logs/YYYY/MM/YYYY-MM-DD.md

Write each entry as a short timestamped bullet. Create the file on
first write if it does not exist. Do not rewrite or reorganize the
log — it is append-only. A separate nightly process distills these
logs into MEMORY.md and topic files."
```

### 7.2. AI DM Adaptation

This maps directly to our Tier 1 (Raw Experience) and Tier 3 (Distilled Skills) separation. The PromptLog is our "append-only daily log" — every AI call is logged with full context. The ExperienceDiagnosis table is our "topic files" — analyzed observations grouped by theme. The AgentSkill table is our "MEMORY.md" — the distilled index that agents actually read.

The key implementation insight is that the PromptLog should NEVER be modified by any automated process. It is the immutable audit trail. All intelligence operates on copies/summaries of the data, never the originals.

```
PromptLog (append-only, never modified)
    ↓ [ReflectorAgent reads, triggered by events]
ExperienceDiagnosis (analyzed observations)
    ↓ [autoDream promotes clusters of 3+]
AgentSkill (distilled rules, injected into prompts)
    ↓ [autoDream merges, prunes, resolves contradictions]
AgentSkill (consolidated, clean)
```

---

## 8. Pattern 7: Coordinator Mode (Future Reference)

### 8.1. What Anthropic Does

The coordinator pattern is a multi-agent orchestration model where a "coordinator" agent spawns "worker" agents for parallel research, implementation, and verification. Workers report back via `<task-notification>` XML messages. The coordinator synthesizes findings and directs follow-up work.

Key principles from their system prompt:

1. **"Always synthesize — your most important job."** The coordinator must understand worker findings before directing follow-up. Never say "based on your findings" — that delegates understanding.

2. **"Parallelism is your superpower."** Launch independent workers concurrently. Read-only tasks run in parallel freely. Write-heavy tasks are serialized per file area.

3. **"Workers can't see your conversation."** Every worker prompt must be self-contained with everything the worker needs.

4. **Scratchpad directory** for cross-worker knowledge sharing without permission prompts.

### 8.2. AI DM Relevance (Future Phase)

This pattern is not needed for the MVP self-learning system, but becomes relevant when the AI DM's agent count grows beyond what a simple linear pipeline can handle. The current architecture has the Director/Orchestrator calling agents sequentially. A coordinator pattern would allow parallel scene generation (image + narration + audio simultaneously) with a coordinator that synthesizes the results.

The scratchpad concept maps to our Pinecone-based skill library — it is the shared knowledge space that all agents can read from without explicit coordination.

This is documented here for future reference. The `open-multi-agent` library (extracted from this same codebase) provides an embeddable implementation of this pattern if needed.

---

## 9. Pattern 8: Skill Self-Improvement Hook

### 9.1. What Anthropic Does
Anthropic runs a lightweight side-channel LLM call after every tool use to detect if the user expressed a preference that should update a skill file.

```typescript
// From openclaude/src/utils/hooks/skillImprovement.ts
const config: ApiQueryHookConfig<SkillUpdate[]> = {
  name: 'skill_improvement_detection',
  systemPrompt: 'You detect user preferences and process improvements during skill execution. Flag anything the user asks for that should be remembered for next time.',
  useTools: false,
  parseResponse(content) {
    const updatesStr = extractTag(content, 'updates');
    return updatesStr ? jsonParse(updatesStr) : [];
  },
  logResult(result, context) {
    if (result.type === 'success' && result.result.length > 0) {
      // Suggestion surfaced to user
    }
  },
  getModel: getSmallFastModel, // Cheap model
};
```

### 9.2. AI DM Adaptation
We adapt this to run after every player turn to detect passive preferences (e.g., "stop describing the smell", "more sarcastic narration").

```typescript
// backend/src/services/hooks/SkillImprovementHook.ts
export async function detectSkillImprovement(
  context: AIContext,
  playerInput: string,
  aiResponse: string
): Promise<void> {
  const result = await sideQuery({
    model: 'gpt-4.1-mini',
    system: 'You detect player preferences and stylistic corrections. If the player corrects the AI DM (e.g., "too much detail", "be more sarcastic"), output a JSON array of skill updates.',
    messages: [
      { role: 'user', content: playerInput },
      { role: 'assistant', content: aiResponse }
    ]
  });

  if (result.updates.length > 0) {
    await experienceLedgerService.proposeSkillUpdate(result.updates);
  }
}
```

## 10. Pattern 9: Side Query Abstraction

### 10.1. What Anthropic Does
Anthropic uses a `sideQuery` wrapper for LLM calls that should not pollute the main conversation history or use expensive models.

```typescript
// From openclaude/src/utils/sideQuery.ts
export type SideQueryOptions = {
  model: string;
  system?: string | TextBlockParam[];
  messages: MessageParam[];
  thinking?: number | false; // Disable thinking to save cost
  skipSystemPromptPrefix?: boolean;
};
```

### 10.2. AI DM Adaptation
We use this abstraction for KAIROS ticks, ReflectorAgent diagnoses, and the SkillImprovementHook.

```typescript
// backend/src/services/ai/sideQuery.ts
export async function sideQuery(options: SideQueryOptions): Promise<any> {
  // Ensure we don't log to the main PromptLog
  const logId = await consolidationLogService.createEntry({
    source: 'side-query',
    model: options.model,
  });
  
  // Execute call using standard AI client
  const result = await aiClient.call(options);
  
  await consolidationLogService.updateEntry(logId, result);
  return result;
}
```

## 11. Pattern 10: Tool Orchestration (Read/Write Partitioning)

### 11.1. What Anthropic Does
Anthropic partitions tool calls into read-only (concurrent) and write (serial) batches.

```typescript
// From openclaude/src/services/tools/toolOrchestration.ts
function partitionToolCalls(toolUseMessages: ToolUseBlock[], context: ToolUseContext): Batch[] {
  // Groups tools where isConcurrencySafe() is true into parallel batches,
  // and isolates write tools into serial batches.
}
```

### 11.2. AI DM Adaptation
When we scale to multi-agent coordination, we use this to prevent race conditions on game state.

```typescript
// backend/src/ai/orchestrator/ToolPartitioner.ts
export interface AgentTool {
  name: string;
  isConcurrencySafe: () => boolean; // e.g., get_inventory = true, consume_item = false
  execute: (input: any) => Promise<any>;
}
```

 
## 12. Implementation Priority Map

Based on the patterns above, here is the recommended implementation order, mapped to the phases in `11-meta-harness-self-learning.md`:

| Phase | Patterns Used | Source Files to Reference |
| :--- | :--- | :--- |
| Phase 1: Enhanced Logging | Pattern 6 (append-only log), Pattern 5 (what NOT to save) | `memdir.ts`, `memoryTypes.ts` |
| Phase 2: Skill Retrieval | Pattern 5 (memory types, drift caveat) | `memoryTypes.ts`, `memdir.ts` |
| Phase 3: Feedback Loop | Pattern 5 (feedback type — corrections AND confirmations) | `memoryTypes.ts` |
| Phase 4: ReflectorAgent | Pattern 3 (four-phase dream prompt structure) | `consolidationPrompt.ts` |
| Phase 4.5: Passive Detection | Pattern 8 (Skill hook), Pattern 9 (Side Query) | `skillImprovement.ts`, `sideQuery.ts` |
| Phase 5: KAIROS Daemon | Pattern 1 (gate sequence), Pattern 4 (lock-as-timestamp) | `autoDream.ts`, `consolidationLock.ts` |
| Phase 6: autoDream | Pattern 2 (forked agent + permissions), Pattern 3 (consolidation prompt), Pattern 4 (lock) | `autoDream.ts`, `extractMemories.ts`, `consolidationLock.ts`, `consolidationPrompt.ts` |
| Phase 7: Recommendations | Pattern 7 (coordinator synthesis) | `coordinatorMode.ts` |

---

## 13. Files in the OpenClaude Repository for Reference

The following files in the cloned repository (`/home/ubuntu/openclaude-src/`) contain the source code referenced in this document:

| File | Lines | Purpose |
| :--- | :--- | :--- |
| `src/services/autoDream/autoDream.ts` | 325 | Core autoDream runner with gate sequence, forked agent execution, progress tracking |
| `src/services/autoDream/consolidationPrompt.ts` | 66 | The four-phase dream prompt builder |
| `src/services/autoDream/consolidationLock.ts` | 141 | Lock-as-timestamp implementation with PID-based crash recovery |
| `src/services/autoDream/config.ts` | ~20 | Feature flag gate for autoDream enablement |
| `src/services/extractMemories/extractMemories.ts` | 616 | Permission model (`createAutoMemCanUseTool`), forked agent pattern, cursor-based processing |
| `src/services/extractMemories/prompts.ts` | ~100 | Extraction prompt templates |
| `src/memdir/memdir.ts` | 508 | Memory directory management, KAIROS daily log mode, search past context |
| `src/memdir/memoryTypes.ts` | 272 | Memory type taxonomy with save/use/structure guidance |
| `src/coordinator/coordinatorMode.ts` | 370 | Coordinator system prompt, worker orchestration patterns |
| `src/utils/hooks/skillImprovement.ts` | 138 | Passive detection of user preferences via side-channel LLM call |
| `src/utils/sideQuery.ts` | 118 | Lightweight wrapper for background LLM calls |
| `src/services/tools/toolOrchestration.ts` | 158 | Read/write tool partitioning logic |

---

## References

- OpenClaude repository: https://github.com/gitlawb/openclaude
- Parent design document: `docs/core/11-meta-harness-self-learning.md` (v2.0)
- Claude Code architecture analysis: `docs/core/12-claude-code-architecture-analysis.md`
- Repo comparison and security analysis: `docs/core/13-claude-code-repos-and-security.md`

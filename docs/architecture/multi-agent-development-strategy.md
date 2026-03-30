# Multi-Agent Parallel Development Strategy

As the PulseOne codebase grows and the prompt library expands past 20 distinct feature prompts, executing them sequentially becomes a bottleneck. However, we do not need to manage multiple IDEs or manually juggle git branches. 

We can leverage native parallel agent features in modern AI coding tools—specifically **Cursor's Parallel Agents (Worktrees)** or **Claude Code's Agent Teams**—to build different architectural slices simultaneously within a single workspace.

This document outlines a strategy for breaking up the remaining prompt library into parallel tracks using these native features.

## 1. Assessment of Current Prompt Differentiation

Currently, Prompts 1 through 21 are highly differentiated by *feature*, but they are tightly coupled by *dependency*. 

For example:
*   Prompt 15 (Role Profiles) modifies the database schema.
*   Prompt 16 (Newsletter Rendering) depends on the schema from 15.
*   Prompt 17 (Sandbox Role Filter) depends on the UI from 16.

Because of this linear dependency chain, feeding all 21 prompts into a single sequential agent run creates a fragile house of cards. If the agent makes a mistake on Prompt 15, Prompts 16 and 17 will fail to compile. 

**Conclusion:** We have excellent feature differentiation, but we need to restructure the execution into isolated, non-blocking tracks to safely use parallel agents.

## 2. Agentic Decomposition Strategy

To break this up, we assign specific "personas" or "roles" to different sub-agents. Each agent gets a specialized set of prompts and operates in an isolated scope.

### Track A: The UI/UX Agent (Frontend Focused)
**Scope:** `frontend/src/`
**Responsibilities:**
*   Radar component scaling and label management
*   Admin dashboard UI layouts (Curation tabs, Topic merge modals)
*   Newsletter Sandbox UI wiring

### Track B: The Data & Pipeline Agent (Backend Focused)
**Scope:** `backend/models/`, `backend/routers/`
**Responsibilities:**
*   Database schema migrations (Role profiles, Content Library)
*   API endpoint creation (Merge endpoints, Library CRUD)
*   Newsletter HTML generation logic

### Track C: The Intelligence Agent (AI/Vector Focused)
**Scope:** `backend/services/ai_service.py`, `backend/services/signal_service.py`
**Responsibilities:**
*   Pinecone vector embedding pipeline
*   Signal scoring math (Velocity/Acceleration)
*   Prompt engineering for Claude clustering

## 3. How to Execute Using Native Parallel Tools

You can choose either Cursor or Claude Code to execute this strategy without leaving your primary workspace.

### Option 1: Using Cursor Parallel Agents (Worktrees)
Cursor 2.0+ supports running multiple agents locally in parallel using Git Worktrees. Each agent runs in its own isolated worktree, allowing them to make edits without interfering with your main branch or each other.

1. **Open Cursor's Agent panel.**
2. **Launch Agent A (UI):** Paste the Frontend-only prompt and select "Run in background/worktree". Cursor will spin up a worktree (e.g., `.cursor/worktrees/feat-ui`).
3. **Launch Agent B (Data):** Paste the Backend-only prompt in a new agent chat and run it in a separate worktree.
4. **Launch Agent C (Intelligence):** Paste the AI pipeline prompt in a third agent chat and run it in a worktree.
5. **Review and Apply:** Once the agents finish, Cursor presents an "Apply" button for each. You review the diffs and apply them to your main branch one by one, resolving any minor integration conflicts natively in the IDE.

### Option 2: Using Claude Code Agent Teams
If you are using the `claude` CLI, you can use the experimental Agent Teams feature (v2.1.32+).

1. Enable teams in `settings.json`: `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": true`
2. Start the lead agent: `claude`
3. Instruct the lead agent to spawn a team: 
   *"Spawn a team of 3 sub-agents. Assign Agent 1 to build the frontend UI for the Topic Merge tool. Assign Agent 2 to build the backend API endpoint for merging topics. Assign Agent 3 to update the AI clustering prompt in `ai_service.py`."*
4. The lead agent will orchestrate the sub-agents, who will work in parallel, communicate with each other to align on API contracts, and report back when finished.

## 4. Recommendation for Next Steps

To transition to this model:
1.  Stop running monolithic "full-stack" prompts.
2.  For the remaining un-executed work (e.g., Pinecone, Content Library, Deduplication), we will generate split prompts (e.g., `20A-pinecone-backend.md`, `20B-pinecone-frontend.md`).
3.  Use Cursor's Background Agents to run `20A` and `20B` simultaneously.

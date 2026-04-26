"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type TabId = "proposals" | "registry";

interface Proposal {
  id: number;
  agent_name: string;
  base_version: string;
  model: string | null;
  proposed_system_prompt: string;
  rationale: string;
  test_improvement_score: number | null;
  status: string;
  created_at: string;
}

interface PromptTemplateRow {
  id: number;
  agent_name: string;
  version: string;
  model: string | null;
  is_active: boolean;
  created_at: string;
  system_prompt: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

interface PromptModel {
  id: string;
  name: string;
}

interface ProposalDraft {
  proposed_system_prompt: string;
  model: string;
  rationale: string;
}

let toastSeq = 0;

/** Line-level diff chunks (subset of `diff` package `Change`). */
interface LineChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * Line diff without the `diff` npm package (avoids missing-module issues when
 * node_modules is stale, e.g. Docker named volume for /app/node_modules).
 */
function diffLines(oldText: string, newText: string): LineChange[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: LineChange[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ value: `${a[i]}\n` });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ value: `${a[i]}\n`, removed: true });
      i++;
    } else {
      out.push({ value: `${b[j]}\n`, added: true });
      j++;
    }
  }
  while (i < n) {
    out.push({ value: `${a[i]}\n`, removed: true });
    i++;
  }
  while (j < m) {
    out.push({ value: `${b[j]}\n`, added: true });
    j++;
  }
  return out;
}

const AGENT_RING_PALETTE = [
  "bg-violet-500/20 text-violet-400 ring-violet-500/30",
  "bg-rose-500/20 text-rose-400 ring-rose-500/30",
  "bg-sky-500/20 text-sky-400 ring-sky-500/30",
  "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
  "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  "bg-amber-500/20 text-amber-400 ring-amber-500/30",
];

function agentPillClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 1000;
  }
  return (
    AGENT_RING_PALETTE[h % AGENT_RING_PALETTE.length] ??
    "bg-slate-500/20 text-slate-400 ring-slate-500/30"
  );
}

function AgentPill({ name }: { name: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${agentPillClass(name)}`}
    >
      {name}
    </span>
  );
}

function pickActivePrompt(rows: PromptTemplateRow[], agent: string): string | null {
  const forAgent = rows.filter((r) => r.agent_name === agent && r.is_active);
  if (forAgent.length === 0) return null;
  return forAgent.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]?.system_prompt ?? null;
}

function defaultModel(models: PromptModel[]): string {
  return models[0]?.id ?? "claude-haiku-4-5-20251001";
}

/** Mirrors backend `_next_prompt_version_after_approval` for display (v_base → v_new). */
function nextPromptVersionAfterApproval(baseVersion: string): string {
  const s = baseVersion.trim();
  if (s === "fallback") return "1.1.0";
  const parts = s.split(".");
  if (
    parts.length >= 2 &&
    /^\d+$/.test(parts[0] ?? "") &&
    /^\d+$/.test(parts[1] ?? "")
  ) {
    return `${parseInt(parts[0]!, 10)}.${parseInt(parts[1]!, 10) + 1}.0`;
  }
  if (parts.length >= 1 && /^\d+$/.test(parts[0] ?? "")) {
    return `${parseInt(parts[0]!, 10)}.1.0`;
  }
  return "1.1.0";
}

function IconChevronDown({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`size-4 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function PromptDiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts: LineChange[] = diffLines(oldText || "", newText || "");
  return (
    <div className="space-y-0 rounded-lg border border-gray-800 font-mono text-xs leading-relaxed">
      {parts.map((part: LineChange, i: number) => {
        const raw = part.value.endsWith("\n") ? part.value.slice(0, -1) : part.value;
        const lines = raw.length ? raw.split("\n") : [""];
        return (
          <div key={i}>
            {lines.map((line: string, j: number) => (
              <div
                key={`${i}-${j}`}
                className={`whitespace-pre-wrap break-words px-2 py-0.5 ${
                  part.added
                    ? "bg-emerald-500/10 text-emerald-400"
                    : part.removed
                      ? "bg-red-500/10 text-red-400"
                      : "bg-gray-900/50 text-gray-400"
                }`}
              >
                {part.added ? "+" : part.removed ? "-" : " "}
                {line || " "}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function PromptLabPage() {
  const [tab, setTab] = useState<TabId>("proposals");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [templates, setTemplates] = useState<PromptTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [models, setModels] = useState<PromptModel[]>([]);
  const [expandedView, setExpandedView] = useState<Record<number, boolean>>({});
  const [baselineCache, setBaselineCache] = useState<Record<string, string | null>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedRegistryId, setExpandedRegistryId] = useState<number | null>(null);
  const [proposalDrafts, setProposalDrafts] = useState<Record<number, ProposalDraft>>({});
  const [creatingFromTemplateId, setCreatingFromTemplateId] = useState<number | null>(null);
  const [labSourceId, setLabSourceId] = useState<number | null>(null);
  const [labModel, setLabModel] = useState("claude-haiku-4-5-20251001");
  const [labPrompt, setLabPrompt] = useState("");
  const [labRequest, setLabRequest] = useState("");
  const [labOutput, setLabOutput] = useState("");
  const [labRunning, setLabRunning] = useState(false);

  function addToast(type: "success" | "error", message: string) {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const fetchProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/prompt-proposals?status=pending`,
      );
      if (!res.ok) {
        setProposals([]);
        return;
      }
      const data = (await res.json()) as Proposal[];
      setProposals(data);
      setProposalDrafts((prev) => {
        const next = { ...prev };
        for (const p of data) {
          next[p.id] ??= {
            proposed_system_prompt: p.proposed_system_prompt,
            model: p.model || defaultModel(models),
            rationale: p.rationale || "",
          };
        }
        return next;
      });
    } catch {
      setProposals([]);
    } finally {
      setProposalsLoading(false);
    }
  }, [models]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/prompt-templates?agent=all`);
      if (!res.ok) {
        setTemplates([]);
        return;
      }
      const data = (await res.json()) as PromptTemplateRow[];
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/prompt-models`);
      if (!res.ok) return;
      const data = (await res.json()) as PromptModel[];
      setModels(data);
      setLabModel((m) => m || defaultModel(data));
    } catch {
      // Model list is convenience-only; backend also has a fallback.
    }
  }, []);

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  useEffect(() => {
    void fetchTemplates();
    void fetchModels();
  }, [fetchTemplates, fetchModels]);

  function loadTemplateIntoLab(row: PromptTemplateRow) {
    setLabSourceId(row.id);
    setLabPrompt(row.system_prompt);
    setLabModel(row.model || defaultModel(models));
    setLabOutput("");
    addToast("success", `Loaded ${row.agent_name} v${row.version} into the lab`);
  }

  async function createProposalFromTemplate(row: PromptTemplateRow) {
    setCreatingFromTemplateId(row.id);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/prompt-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: row.id,
          proposed_system_prompt: row.system_prompt,
          model: row.model || defaultModel(models),
          rationale: "Manual proposal from Prompt Lab registry",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const proposal = (await res.json()) as Proposal;
      setProposals((prev) => [proposal, ...prev]);
      setProposalDrafts((prev) => ({
        ...prev,
        [proposal.id]: {
          proposed_system_prompt: proposal.proposed_system_prompt,
          model: proposal.model || defaultModel(models),
          rationale: proposal.rationale || "",
        },
      }));
      setTab("proposals");
      addToast("success", `Created pending proposal for ${row.agent_name}`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Create proposal failed");
    } finally {
      setCreatingFromTemplateId(null);
    }
  }

  async function saveProposalDraft(id: number) {
    const draft = proposalDrafts[id];
    if (!draft) return;
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/prompt-proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Proposal;
      setProposals((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setProposalDrafts((prev) => ({
        ...prev,
        [id]: {
          proposed_system_prompt: updated.proposed_system_prompt,
          model: updated.model || defaultModel(models),
          rationale: updated.rationale || "",
        },
      }));
      addToast("success", "Proposal saved");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Save failed");
    }
  }

  async function runLabTest() {
    setLabRunning(true);
    setLabOutput("");
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/prompt-lab/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: labPrompt,
          user_message: labRequest,
          model: labModel || defaultModel(models),
          max_tokens: 2048,
        }),
      });
      const data = (await res.json()) as { output?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail || "Prompt test failed");
      setLabOutput(data.output || "");
    } catch (e) {
      setLabOutput(e instanceof Error ? e.message : "Prompt test failed");
    } finally {
      setLabRunning(false);
    }
  }

  async function ensureBaseline(agent: string) {
    if (baselineCache[agent] !== undefined) return;
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/prompt-templates?agent=${encodeURIComponent(agent)}`,
      );
      if (!res.ok) {
        setBaselineCache((c) => ({ ...c, [agent]: null }));
        return;
      }
      const rows = (await res.json()) as PromptTemplateRow[];
      const active = pickActivePrompt(rows, agent);
      setBaselineCache((c) => ({ ...c, [agent]: active }));
    } catch {
      setBaselineCache((c) => ({ ...c, [agent]: null }));
    }
  }

  async function toggleDiff(proposalId: number, agent: string) {
    const next = !expandedView[proposalId];
    setExpandedView((e) => ({ ...e, [proposalId]: next }));
    if (next) await ensureBaseline(agent);
  }

  async function approve(id: number, agentName: string) {
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/prompt-proposals/${id}/approve`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { message?: string; new_version: string };
      addToast(
        "success",
        `Prompt v${data.new_version} is now live for ${agentName}`,
      );
      setProposals((p) => p.filter((x) => x.id !== id));
      setBaselineCache({});
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Approve failed");
    }
  }

  async function reject(id: number) {
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/prompt-proposals/${id}/reject`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      addToast("success", "Proposal rejected");
      setProposals((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Reject failed");
    }
  }

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Prompt Lab</h1>
          <p className="mt-1 text-sm text-gray-400">
            Review optimizer proposals and inspect the prompt registry.
          </p>
        </header>

        <div
          className="mb-8 flex rounded-lg border border-gray-800 bg-gray-900/80 p-0.5"
          role="tablist"
          aria-label="Prompt Lab sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "proposals"}
            onClick={() => setTab("proposals")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "proposals"
                ? "bg-gray-800 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Proposals
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "registry"}
            onClick={() => setTab("registry")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "registry"
                ? "bg-gray-800 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Registry
          </button>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                Lab Test Bench
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Load a registered prompt, choose a model, send a request, and inspect the raw model output.
              </p>
            </div>
            <select
              value={labSourceId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                const row = templates.find((t) => t.id === id);
                if (row) loadTemplateIntoLab(row);
              }}
              className="min-w-64 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
            >
              <option value="">Load registered prompt…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.agent_name} v{t.version}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4">
            <label className="block text-sm">
              <span className="text-gray-400">Model</span>
              <select
                value={labModel}
                onChange={(e) => setLabModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200"
              >
                {models.length === 0 ? (
                  <option value={labModel || "claude-haiku-4-5-20251001"}>
                    {labModel || "claude-haiku-4-5-20251001"}
                  </option>
                ) : null}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">System prompt</span>
              <textarea
                value={labPrompt}
                onChange={(e) => setLabPrompt(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-200"
                placeholder="Load a registered prompt or paste a prompt to test…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">Request</span>
              <textarea
                value={labRequest}
                onChange={(e) => setLabRequest(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200"
                placeholder="Enter the user message / sample input for this prompt…"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={labRunning || !labPrompt.trim() || !labRequest.trim() || !labModel}
                onClick={() => void runLabTest()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
              >
                {labRunning ? "Running…" : "Run test"}
              </button>
            </div>
            {labOutput ? (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs text-gray-300">
                {labOutput}
              </pre>
            ) : null}
          </div>
        </section>

        {tab === "proposals" && (
          <>
            {proposalsLoading ? (
              <div className="flex items-center gap-3 text-gray-400">
                <span
                  className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
                  aria-hidden
                />
                <span>Loading proposals…</span>
              </div>
            ) : proposals.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/40 px-6 py-16 text-center">
                <p className="max-w-md text-sm text-gray-500">
                  No pending proposals. The optimizer runs daily at 02:00 UTC.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {proposals.map((p) => {
                  const proposedVersion = nextPromptVersionAfterApproval(p.base_version);
                  const draft = proposalDrafts[p.id] ?? {
                    proposed_system_prompt: p.proposed_system_prompt,
                    model: p.model || defaultModel(models),
                    rationale: p.rationale || "",
                  };
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-gray-800 bg-gray-900 p-6"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                            Pending
                          </span>
                          <AgentPill name={p.agent_name} />
                          <span className="font-mono text-xs text-gray-400">
                            v{p.base_version} → v{proposedVersion}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Generated{" "}
                          {new Date(p.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="text-sm text-gray-400">
                          <span className="font-medium text-gray-300">Trigger metric: </span>
                          test_improvement_score{" "}
                          <span className="tabular-nums text-white">
                            {p.test_improvement_score != null
                              ? p.test_improvement_score.toFixed(2)
                              : "—"}
                          </span>
                        </p>
                        <p className="text-sm text-gray-400">
                          <span className="font-medium text-gray-300">Model: </span>
                          <span className="font-mono text-xs text-white">{draft.model}</span>
                        </p>
                      </div>

                      <div className="mt-6 grid gap-4">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Model
                          </span>
                          <select
                            value={draft.model}
                            onChange={(e) =>
                              setProposalDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, model: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200"
                          >
                            {models.length === 0 ? (
                              <option value={draft.model}>{draft.model}</option>
                            ) : null}
                            {models.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.id})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Rationale
                          </span>
                          <textarea
                            value={draft.rationale}
                            onChange={(e) =>
                              setProposalDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, rationale: e.target.value },
                              }))
                            }
                            rows={3}
                            className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-300"
                            placeholder="Why this prompt/model change is being proposed…"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Proposed system prompt
                          </span>
                          <textarea
                            value={draft.proposed_system_prompt}
                            onChange={(e) =>
                              setProposalDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, proposed_system_prompt: e.target.value },
                              }))
                            }
                            rows={10}
                            className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-gray-300"
                          />
                        </label>
                      </div>

                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => void toggleDiff(p.id, p.agent_name)}
                          className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                          aria-expanded={Boolean(expandedView[p.id])}
                        >
                          <IconChevronDown expanded={Boolean(expandedView[p.id])} />
                          {expandedView[p.id] ? "Hide Prompt Diff" : "Show Prompt Diff"}
                        </button>
                        {expandedView[p.id] ? (
                          <div className="mt-3">
                            {baselineCache[p.agent_name] === undefined ? (
                              <p className="text-sm text-gray-500">Loading current prompt…</p>
                            ) : (
                              <PromptDiffView
                                oldText={baselineCache[p.agent_name] ?? ""}
                                newText={draft.proposed_system_prompt}
                              />
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-800 pt-6">
                        <button
                          type="button"
                          onClick={() => {
                            setLabPrompt(draft.proposed_system_prompt);
                            setLabModel(draft.model);
                            setLabOutput("");
                            addToast("success", `Loaded proposal ${p.id} into the lab`);
                          }}
                          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                        >
                          Load to Lab
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveProposalDraft(p.id)}
                          className="rounded-lg border border-teal-700/70 bg-teal-900/30 px-4 py-2 text-sm font-semibold text-teal-200 transition-colors hover:bg-teal-900/50"
                        >
                          Save edits
                        </button>
                        <button
                          type="button"
                          onClick={() => void approve(p.id, p.agent_name)}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reject(p.id)}
                          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "registry" && (
          <>
            {templatesLoading ? (
              <div className="flex items-center gap-3 text-gray-400">
                <span
                  className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
                  aria-hidden
                />
                <span>Loading registry…</span>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500">No prompt templates in the registry.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-300">Agent</th>
                      <th className="px-4 py-3 font-medium text-gray-300">Version</th>
                      <th className="px-4 py-3 font-medium text-gray-300">Model</th>
                      <th className="px-4 py-3 font-medium text-gray-300">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-300">Created</th>
                      <th className="px-4 py-3 font-medium text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-gray-950">
                    {templates.map((row) => (
                      <FragmentRow
                        key={row.id}
                        row={row}
                        expanded={expandedRegistryId === row.id}
                        onToggle={() =>
                          setExpandedRegistryId((id) => (id === row.id ? null : row.id))
                        }
                        onLoadLab={() => loadTemplateIntoLab(row)}
                        onCreateProposal={() => void createProposalFromTemplate(row)}
                        creatingProposal={creatingFromTemplateId === row.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}

function FragmentRow({
  row,
  expanded,
  onToggle,
  onLoadLab,
  onCreateProposal,
  creatingProposal,
}: {
  row: PromptTemplateRow;
  expanded: boolean;
  onToggle: () => void;
  onLoadLab: () => void;
  onCreateProposal: () => void;
  creatingProposal: boolean;
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-3">
          <AgentPill name={row.agent_name} />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-300">{row.version}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.model ?? "—"}</td>
        <td className="px-4 py-3">
          {row.is_active ? (
            <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-gray-600/30 px-2.5 py-0.5 text-xs font-medium text-gray-400">
              retired
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
          {new Date(row.created_at).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onLoadLab}
              className="text-sm font-medium text-teal-300 hover:text-teal-200"
            >
              Load to Lab
            </button>
            <button
              type="button"
              disabled={creatingProposal}
              onClick={onCreateProposal}
              className="text-sm font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50"
            >
              {creatingProposal ? "Creating…" : "Create Proposal"}
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-gray-900/50">
          <td colSpan={6} className="px-4 pb-4 pt-0">
            <pre className="max-h-[min(480px,70vh)] overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-xs text-gray-300">
              {row.system_prompt}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

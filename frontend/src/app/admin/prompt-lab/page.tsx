"use client";

import { diffLines, type Change } from "diff";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type TabId = "proposals" | "registry";

interface Proposal {
  id: number;
  agent_name: string;
  base_version: string;
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
  is_active: boolean;
  created_at: string;
  system_prompt: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastSeq = 0;

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
  const parts: Change[] = diffLines(oldText || "", newText || "");
  return (
    <div className="space-y-0 rounded-lg border border-gray-800 font-mono text-xs leading-relaxed">
      {parts.map((part: Change, i: number) => {
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
  const [expandedView, setExpandedView] = useState<Record<number, boolean>>({});
  const [baselineCache, setBaselineCache] = useState<Record<string, string | null>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedRegistryId, setExpandedRegistryId] = useState<number | null>(null);

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
    } catch {
      setProposals([]);
    } finally {
      setProposalsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  useEffect(() => {
    if (tab === "registry") {
      void fetchTemplates();
    }
  }, [tab, fetchTemplates]);

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
                      </div>

                      <div className="mt-6">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rationale
                        </h3>
                        <div className="rounded-lg bg-gray-950 p-4 text-sm text-gray-300">
                          {p.rationale?.trim() ? p.rationale : (
                            <span className="text-gray-600">No rationale provided.</span>
                          )}
                        </div>
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
                                newText={p.proposed_system_prompt}
                              />
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-6 flex justify-end gap-2 border-t border-gray-800 pt-6">
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
}: {
  row: PromptTemplateRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-3">
          <AgentPill name={row.agent_name} />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-300">{row.version}</td>
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
          <button
            type="button"
            onClick={onToggle}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            {expanded ? "Hide" : "View"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-gray-900/50">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <pre className="max-h-[min(480px,70vh)] overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-xs text-gray-300">
              {row.system_prompt}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

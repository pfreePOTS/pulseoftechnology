"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

/** Column headers for the master industry grid — must match backend / AI suggestions. */
export const INDUSTRY_OPTIONS = [
  "Healthcare",
  "Financial Services",
  "Technology",
  "Manufacturing",
  "Energy",
  "Retail",
  "Government",
  "Education",
  "Telecommunications",
  "Transportation",
  "Media & Entertainment",
  "Real Estate",
  "Agriculture",
  "Pharma & Biotech",
  "Legal Services",
  "Hospitality",
  "Nonprofit",
  "Defense & Aerospace",
  "Insurance",
  "Professional Services",
] as const;

const ADOPTION_STATES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

const ADOPTION_DOT: Record<string, string> = {
  "Learn About": "bg-slate-400",
  "Get Ahead Of": "bg-sky-400",
  "Get Prepared For": "bg-amber-400",
  "Get Your Hands Around": "bg-orange-400",
  "Make the Most Of": "bg-emerald-400",
};

interface IndustryPosition {
  impact_score?: number;
  risk_level?: number;
  adoption_state: string;
  rationale?: string;
  impact_approved?: boolean;
}

interface TopicRow {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  article_count: number;
  is_published: boolean;
}

interface ArticleDetail {
  id: number;
  persona_impacts: Record<string, string> | null;
}

interface TopicDetail {
  articles: ArticleDetail[];
}

interface RoleRow {
  id: number;
  name: string;
}

function clonePositions(
  raw: Record<string, IndustryPosition> | null | undefined,
): Record<string, IndustryPosition> {
  if (!raw) return {};
  const out: Record<string, IndustryPosition> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = { ...v };
  }
  return out;
}

function defaultIndustryRow(): IndustryPosition {
  return {
    adoption_state: ADOPTION_STATES[0],
    impact_score: 5,
    risk_level: 5,
    impact_approved: true,
  };
}

function normalizeSuggestionRow(row: Record<string, unknown>): IndustryPosition {
  const adoption =
    typeof row.adoption_state === "string" ? row.adoption_state : ADOPTION_STATES[0];
  const impact =
    typeof row.impact_score === "number"
      ? row.impact_score
      : typeof row.score === "number"
        ? row.score
        : 5;
  const risk = typeof row.risk_level === "number" ? row.risk_level : 5;
  const rationale = typeof row.rationale === "string" ? row.rationale : undefined;
  return {
    adoption_state: ADOPTION_STATES.includes(adoption as (typeof ADOPTION_STATES)[number])
      ? adoption
      : ADOPTION_STATES[0],
    impact_score: Math.min(10, Math.max(1, impact)),
    risk_level: Math.min(10, Math.max(1, risk)),
    rationale,
    impact_approved: false,
  };
}

function impactHeatClass(impact: number): string {
  if (impact >= 9) return "bg-red-500/10";
  if (impact >= 6) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

const ADOPTION_BORDER: Record<string, string> = {
  "Learn About": "border-l-slate-500",
  "Get Ahead Of": "border-l-sky-500",
  "Get Prepared For": "border-l-amber-500",
  "Get Your Hands Around": "border-l-orange-500",
  "Make the Most Of": "border-l-emerald-500",
};

export default function AnalysisPage() {
  const [mainTab, setMainTab] = useState<"industry" | "persona">("industry");
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Record<string, IndustryPosition>>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [suggestingAll, setSuggestingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [personaMatrix, setPersonaMatrix] = useState<Record<number, Record<string, string>>>({});
  const [personaLoading, setPersonaLoading] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await adminFetch(`${API_BASE}/api/admin/topics?status=selected`);
    if (!res.ok) {
      setLoadError("Could not load approved topics.");
      setTopics([]);
      setDrafts({});
      setLoading(false);
      return;
    }
    const data: TopicRow[] = await res.json();
    setTopics(data);
    const d: Record<number, Record<string, IndustryPosition>> = {};
    for (const t of data) {
      d[t.id] = clonePositions(t.industry_positions);
    }
    setDrafts(d);
    setDirtyIds(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (mainTab !== "persona" || topics.length === 0) return;
    let cancelled = false;
    async function loadPersona() {
      setPersonaLoading(true);
      setPersonaMatrix({});
      try {
        const rr = await adminFetch(`${API_BASE}/api/admin/roles`);
        if (!rr.ok || cancelled) return;
        const roleList: RoleRow[] = await rr.json();
        if (cancelled) return;
        setRoles(roleList);
        const matrix: Record<number, Record<string, string>> = {};
        for (const t of topics) {
          const tr = await adminFetch(`${API_BASE}/api/admin/topics/${t.id}`);
          if (!tr.ok) continue;
          const detail: TopicDetail = await tr.json();
          const byRole: Record<string, string> = {};
          for (const role of roleList) {
            const texts: string[] = [];
            for (const art of detail.articles ?? []) {
              const pi = art.persona_impacts;
              if (pi && typeof pi === "object" && role.name in pi) {
                const s = String((pi as Record<string, string>)[role.name] ?? "").trim();
                if (s) texts.push(s);
              }
            }
            byRole[role.name] = texts.length ? [...new Set(texts)].join(" · ") : "—";
          }
          matrix[t.id] = byRole;
        }
        if (!cancelled) setPersonaMatrix(matrix);
      } finally {
        if (!cancelled) setPersonaLoading(false);
      }
    }
    void loadPersona();
    return () => {
      cancelled = true;
    };
  }, [mainTab, topics]);

  const markDirty = useCallback((topicId: number) => {
    setDirtyIds((prev) => new Set(prev).add(topicId));
  }, []);

  const updateCell = useCallback(
    (topicId: number, industry: string, patch: Partial<IndustryPosition>) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        const row = { ...(cur[industry] ?? defaultIndustryRow()), ...patch };
        cur[industry] = row;
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  const addIndustryCell = useCallback(
    (topicId: number, industry: string) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        if (cur[industry]) return prev;
        cur[industry] = defaultIndustryRow();
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  const removeIndustryCell = useCallback(
    (topicId: number, industry: string) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        delete cur[industry];
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  const saveTopic = useCallback(async (topicId: number) => {
    const industry_positions = drafts[topicId] ?? {};
    const res = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}`, {
      method: "PUT",
      body: JSON.stringify({ industry_positions }),
    });
    if (!res.ok) return false;
    const updated: TopicRow = await res.json();
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...updated } : t)));
    setDrafts((prev) => ({
      ...prev,
      [topicId]: clonePositions(updated.industry_positions),
    }));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    return true;
  }, [drafts]);

  const saveAllDirty = useCallback(async () => {
    setActionError(null);
    setSavingAll(true);
    try {
      for (const id of dirtyIds) {
        const ok = await saveTopic(id);
        if (!ok) {
          setActionError(`Save failed for topic ${id}.`);
          return;
        }
      }
    } finally {
      setSavingAll(false);
    }
  }, [dirtyIds, saveTopic]);

  const suggestIndustries = useCallback(async (topicId: number) => {
    const res = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}/suggest-industry-positions`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
            : "AI suggestion failed.";
      throw new Error(msg || "AI suggestion failed.");
    }
    const result: {
      industry_suggestions?: Record<string, Record<string, unknown>>;
      industry_positions?: Record<string, Record<string, unknown>>;
    } = await res.json();
    const raw = result.industry_suggestions ?? result.industry_positions ?? {};
    setDrafts((prev) => {
      const cur = { ...prev[topicId] };
      for (const [name, row] of Object.entries(raw)) {
        if (row && typeof row === "object") {
          cur[name] = normalizeSuggestionRow(row as Record<string, unknown>);
        }
      }
      return { ...prev, [topicId]: cur };
    });
    markDirty(topicId);
  }, [markDirty]);

  const runAiSuggestAll = useCallback(async () => {
    setActionError(null);
    setSuggestingAll(true);
    try {
      for (const t of topics) {
        try {
          await suggestIndustries(t.id);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "AI suggest failed.");
          return;
        }
      }
    } finally {
      setSuggestingAll(false);
    }
  }, [topics, suggestIndustries]);

  const nCols = INDUSTRY_OPTIONS.length;
  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `240px repeat(${nCols}, minmax(140px, 1fr))`,
      minWidth: `${240 + nCols * 160}px`,
    }),
    [nCols],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[min(100%,1920px)] px-4 py-8">
        <p className="text-sm text-gray-500">Loading topics…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[min(100%,1920px)] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analysis</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Industry positions for selected topics — spreadsheet view. Tab through Impact and Risk inputs to edit
            quickly. Heat colors reflect impact magnitude.
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/80 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "industry"}
            onClick={() => setMainTab("industry")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mainTab === "industry" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Industry Positions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "persona"}
            onClick={() => setMainTab("persona")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mainTab === "persona" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Persona Impacts
          </button>
        </div>
      </div>

      {actionError && (
        <div
          className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loadError && <p className="mb-4 text-sm text-red-400">{loadError}</p>}

      {mainTab === "persona" ? (
        <>
          {personaLoading ? (
            <p className="text-sm text-gray-500">Loading persona data…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-gray-500">No selected topics yet.</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-gray-500">No role profiles defined. Add roles under Role Profiles.</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-950">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900">
                    <th className="sticky left-0 z-20 min-w-[220px] bg-gray-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Topic
                    </th>
                    {roles.map((r) => (
                      <th
                        key={r.id}
                        className="min-w-[160px] px-2 py-2 text-xs font-semibold text-gray-400"
                      >
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {topics.map((topic) => (
                    <tr key={topic.id} className="hover:bg-gray-900/50">
                      <td className="sticky left-0 z-10 bg-gray-950 px-3 py-2 align-top">
                        <p className="font-medium text-white">{topic.name}</p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            DOMAIN_COLORS[topic.domain] ?? "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {topic.domain}
                        </span>
                      </td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-2 py-2 align-top text-xs leading-snug text-gray-400">
                          {personaMatrix[topic.id]?.[r.name] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-gray-800 px-3 py-2 text-xs text-gray-600">
                Read-only: persona lines come from AI-generated fields on articles. Edit articles or re-run ingestion
                to refresh.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {!loadError && topics.length === 0 && (
            <p className="text-sm text-gray-500">No selected topics yet. Select topics in the pipeline first.</p>
          )}

          {topics.length > 0 && (
            <>
              <div className="mb-4 max-h-[min(70vh,900px)] overflow-auto rounded-xl border border-gray-800 bg-gray-900/40">
                <div className="grid gap-px bg-gray-800 p-px" style={gridStyle}>
                  <div className="sticky top-0 left-0 z-[45] flex items-end border-b border-r border-gray-800 bg-gray-900 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Topic
                  </div>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <div
                      key={ind}
                      className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900 px-1 py-2 text-center text-[10px] font-semibold leading-tight text-gray-400"
                    >
                      {ind}
                    </div>
                  ))}

                  {topics.map((topic) => {
                    const domainClass = DOMAIN_COLORS[topic.domain] ?? "bg-slate-500/20 text-slate-400";
                    return (
                      <Fragment key={topic.id}>
                        <div className="sticky left-0 z-30 flex flex-col justify-center gap-1 border-b border-r border-gray-800 bg-gray-950 px-2 py-2">
                          <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${domainClass}`}>
                            {topic.domain}
                          </span>
                          <span className="line-clamp-2 text-sm font-medium leading-tight text-white">{topic.name}</span>
                          <span className="text-[10px] tabular-nums text-amber-400/90">
                            U {topic.urgency_score.toFixed(1)}
                          </span>
                        </div>
                        {INDUSTRY_OPTIONS.map((industry) => {
                          const row = drafts[topic.id]?.[industry];
                          const has = !!row;
                          const impact = row?.impact_score ?? 5;
                          const risk = row?.risk_level ?? 5;
                          const state =
                            row?.adoption_state && ADOPTION_STATES.includes(row.adoption_state as (typeof ADOPTION_STATES)[number])
                              ? row.adoption_state
                              : ADOPTION_STATES[0];
                          const heat = impactHeatClass(impact);
                          const borderAdopt = ADOPTION_BORDER[state] ?? "border-l-gray-600";

                          if (!has) {
                            return (
                              <div
                                key={`${topic.id}-${industry}`}
                                className="flex min-h-[88px] items-center justify-center border-b border-gray-800 bg-gray-950/80 p-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => addIndustryCell(topic.id, industry)}
                                  className="rounded-md border border-dashed border-gray-700 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-indigo-500/50 hover:text-indigo-300"
                                >
                                  +
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`${topic.id}-${industry}`}
                              className={`relative border-b border-gray-800 p-1.5 ${heat} border-l-2 ${borderAdopt}`}
                            >
                              <button
                                type="button"
                                title="Remove industry"
                                className="absolute right-0.5 top-0.5 z-10 rounded p-0.5 text-[10px] leading-none text-gray-600 hover:bg-gray-800 hover:text-red-400"
                                onClick={() => removeIndustryCell(topic.id, industry)}
                              >
                                ×
                              </button>
                              <div className="mb-1 flex items-center gap-1 pr-4">
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${ADOPTION_DOT[state] ?? "bg-gray-500"}`}
                                  aria-hidden
                                />
                                <select
                                  value={state}
                                  onChange={(e) =>
                                    updateCell(topic.id, industry, { adoption_state: e.target.value })
                                  }
                                  className="w-full min-w-0 max-w-full truncate rounded border border-gray-700 bg-gray-900/90 py-0.5 pl-1 text-[10px] text-gray-200"
                                >
                                  {ADOPTION_STATES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <label className="flex flex-1 flex-col gap-0.5">
                                  <span className="text-[9px] uppercase text-gray-600">Imp</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={impact}
                                    onChange={(e) =>
                                      updateCell(topic.id, industry, {
                                        impact_score: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded border border-gray-700 bg-gray-900/90 px-1 py-0.5 text-[11px] tabular-nums text-indigo-200"
                                  />
                                </label>
                                <label className="flex flex-1 flex-col gap-0.5">
                                  <span className="text-[9px] uppercase text-gray-600">Risk</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={risk}
                                    onChange={(e) =>
                                      updateCell(topic.id, industry, {
                                        risk_level: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded border border-gray-700 bg-gray-900/90 px-1 py-0.5 text-[11px] tabular-nums text-amber-200"
                                  />
                                </label>
                              </div>
                              <label className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={row.impact_approved !== false}
                                  onChange={(e) =>
                                    updateCell(topic.id, industry, { impact_approved: e.target.checked })
                                  }
                                  className="rounded border-gray-600 bg-gray-900 text-indigo-500"
                                />
                                Radar
                              </label>
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4">
                <button
                  type="button"
                  disabled={suggestingAll || topics.length === 0}
                  onClick={() => {
                    setActionError(null);
                    void runAiSuggestAll().catch((e) =>
                      setActionError(e instanceof Error ? e.message : "AI failed"),
                    );
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestingAll ? "AI Suggest…" : "AI Suggest (all topics)"}
                </button>
                <button
                  type="button"
                  disabled={savingAll || dirtyIds.size === 0}
                  onClick={() => void saveAllDirty()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAll ? "Saving…" : `Save all${dirtyIds.size ? ` (${dirtyIds.size})` : ""}`}
                </button>
                {dirtyIds.size > 0 && (
                  <span className="text-xs text-amber-400/90">{dirtyIds.size} topic(s) with unsaved changes</span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

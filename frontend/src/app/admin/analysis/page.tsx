"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

const INDUSTRY_OPTIONS = [
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
    impact_approved: false,
  };
}

function normalizeSuggestionRow(
  row: Record<string, unknown>,
): IndustryPosition {
  const adoption =
    typeof row.adoption_state === "string"
      ? row.adoption_state
      : ADOPTION_STATES[0];
  const impact =
    typeof row.impact_score === "number"
      ? row.impact_score
      : typeof row.score === "number"
        ? row.score
        : 5;
  const risk =
    typeof row.risk_level === "number" ? row.risk_level : 5;
  const rationale =
    typeof row.rationale === "string" ? row.rationale : undefined;
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

export default function AnalysisPage() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [drafts, setDrafts] = useState<
    Record<number, Record<string, IndustryPosition>>
  >({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [suggestingId, setSuggestingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addIndustryPick, setAddIndustryPick] = useState<
    Record<number, string>
  >({});

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await adminFetch(
      `${API_BASE}/api/admin/topics?status=selected`,
    );
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
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateRow = (
    topicId: number,
    industry: string,
    patch: Partial<IndustryPosition>,
  ) => {
    setDrafts((prev) => {
      const cur = { ...prev[topicId] };
      const row = { ...(cur[industry] ?? defaultIndustryRow()), ...patch };
      cur[industry] = row;
      return { ...prev, [topicId]: cur };
    });
  };

  const removeIndustry = (topicId: number, industry: string) => {
    setDrafts((prev) => {
      const cur = { ...prev[topicId] };
      delete cur[industry];
      return { ...prev, [topicId]: cur };
    });
  };

  const addIndustry = (topicId: number) => {
    const have = new Set(Object.keys(drafts[topicId] ?? {}));
    const avail = INDUSTRY_OPTIONS.filter((o) => !have.has(o));
    let pick = addIndustryPick[topicId];
    if (!pick || !avail.includes(pick as (typeof INDUSTRY_OPTIONS)[number]))
      pick = avail[0];
    if (!pick) return;
    setDrafts((prev) => {
      const cur = { ...prev[topicId] };
      if (cur[pick]) return prev;
      cur[pick] = defaultIndustryRow();
      return { ...prev, [topicId]: cur };
    });
  };

  async function saveTopic(topicId: number) {
    setActionError(null);
    setSavingId(topicId);
    const industry_positions = drafts[topicId] ?? {};
    const res = await adminFetch(
      `${API_BASE}/api/admin/topics/${topicId}`,
      {
        method: "PUT",
        body: JSON.stringify({ industry_positions }),
      },
    );
    setSavingId(null);
    if (!res.ok) {
      setActionError("Save failed. Try again.");
      return;
    }
    const updated: TopicRow = await res.json();
    setTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, ...updated } : t)),
    );
    setDrafts((prev) => ({
      ...prev,
      [topicId]: clonePositions(updated.industry_positions),
    }));
  }

  async function suggestIndustries(topicId: number) {
    setActionError(null);
    setSuggestingId(topicId);
    const res = await adminFetch(
      `${API_BASE}/api/admin/topics/${topicId}/suggest-industry-positions`,
      { method: "POST" },
    );
    setSuggestingId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
            : "AI suggestion failed.";
      setActionError(msg || "AI suggestion failed.");
      return;
    }
    const result: {
      industry_suggestions?: Record<string, Record<string, unknown>>;
      industry_positions?: Record<string, Record<string, unknown>>;
    } = await res.json();
    const raw =
      result.industry_suggestions ?? result.industry_positions ?? {};
    setDrafts((prev) => {
      const cur = { ...prev[topicId] };
      for (const [name, row] of Object.entries(raw)) {
        if (row && typeof row === "object") {
          cur[name] = normalizeSuggestionRow(row as Record<string, unknown>);
        }
      }
      return { ...prev, [topicId]: cur };
    });
  }

  const sortedIndustryKeys = (topicId: number) => {
    const keys = Object.keys(drafts[topicId] ?? {});
    keys.sort((a, b) => a.localeCompare(b));
    return keys;
  };

  const availableToAdd = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const t of topics) {
      const have = new Set(Object.keys(drafts[t.id] ?? {}));
      map[t.id] = INDUSTRY_OPTIONS.filter((o) => !have.has(o));
    }
    return map;
  }, [topics, drafts]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Analysis
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Industry-specific risk, impact, and adoption state for all approved
          topics. Edit inline or use AI suggestions.
        </p>
      </div>

      {actionError && (
        <div
          className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500">Loading topics…</p>
      )}
      {loadError && (
        <p className="text-sm text-red-400">{loadError}</p>
      )}

      {!loading && !loadError && topics.length === 0 && (
        <p className="text-sm text-gray-500">
          No approved topics yet. Approve topics in the pipeline first.
        </p>
      )}

      <div className="space-y-4">
        {topics.map((topic) => {
          const isOpen = !!expanded[topic.id];
          const positions = drafts[topic.id] ?? {};
          const industryCount = Object.keys(positions).length;
          const domainClass =
            DOMAIN_COLORS[topic.domain] ??
            "bg-gray-500/20 text-gray-400";

          return (
            <div
              key={topic.id}
              className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900"
            >
              <button
                type="button"
                onClick={() => toggleExpanded(topic.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/50"
                aria-expanded={isOpen}
              >
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${domainClass}`}
                >
                  {topic.domain}
                </span>
                <span className="min-w-0 flex-1 font-medium text-white">
                  {topic.name}
                </span>
                <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Urgency {topic.urgency_score.toFixed(1)}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {industryCount} industr{industryCount === 1 ? "y" : "ies"}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {topic.article_count} article
                  {topic.article_count === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 text-gray-500" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-800 px-4 py-4">
                  <div className="mb-4 overflow-x-auto">
                    <div className="min-w-[720px] space-y-3">
                      <div className="grid grid-cols-[minmax(140px,1fr)_140px_140px_minmax(160px,1fr)_100px_40px] gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        <span>Industry</span>
                        <span>Impact</span>
                        <span>Risk</span>
                        <span>Adoption</span>
                        <span>On radar</span>
                        <span aria-hidden className="text-center">
                          —
                        </span>
                      </div>
                      {sortedIndustryKeys(topic.id).map((industry) => {
                        const row =
                          positions[industry] ?? defaultIndustryRow();
                        const impact = row.impact_score ?? 5;
                        const risk = row.risk_level ?? 5;
                        return (
                          <div
                            key={industry}
                            className="grid grid-cols-[minmax(140px,1fr)_140px_140px_minmax(160px,1fr)_100px_40px] items-center gap-2 rounded-lg border border-gray-800/80 bg-gray-950/50 px-2 py-2"
                          >
                            <span className="text-sm font-medium text-gray-200">
                              {industry}
                            </span>
                            <div className="flex flex-col gap-1">
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.1}
                                value={impact}
                                onChange={(e) =>
                                  updateRow(topic.id, industry, {
                                    impact_score: Number(e.target.value),
                                  })
                                }
                                className="h-2 w-full accent-indigo-500"
                                aria-label={`${industry} impact score`}
                              />
                              <span className="text-center text-xs tabular-nums text-gray-400">
                                {impact.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.1}
                                value={risk}
                                onChange={(e) =>
                                  updateRow(topic.id, industry, {
                                    risk_level: Number(e.target.value),
                                  })
                                }
                                className="h-2 w-full accent-rose-500"
                                aria-label={`${industry} risk level`}
                              />
                              <span className="text-center text-xs tabular-nums text-gray-400">
                                {risk.toFixed(1)}
                              </span>
                            </div>
                            <select
                              value={
                                ADOPTION_STATES.includes(
                                  row.adoption_state as (typeof ADOPTION_STATES)[number],
                                )
                                  ? row.adoption_state
                                  : ADOPTION_STATES[0]
                              }
                              onChange={(e) =>
                                updateRow(topic.id, industry, {
                                  adoption_state: e.target.value,
                                })
                              }
                              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                            >
                              {ADOPTION_STATES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={!!row.impact_approved}
                                onChange={(e) =>
                                  updateRow(topic.id, industry, {
                                    impact_approved: e.target.checked,
                                  })
                                }
                                className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                              />
                              <span className="sr-only">On radar</span>
                            </label>
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() =>
                                  removeIndustry(topic.id, industry)
                                }
                                className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                                title="Remove industry"
                                aria-label={`Remove ${industry}`}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-end gap-2 border-t border-gray-800 pt-4">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`add-industry-${topic.id}`}
                        className="text-xs text-gray-500"
                      >
                        Add industry
                      </label>
                      <select
                        id={`add-industry-${topic.id}`}
                        value={
                          addIndustryPick[topic.id] ??
                          availableToAdd[topic.id]?.[0] ??
                          ""
                        }
                        onChange={(e) =>
                          setAddIndustryPick((p) => ({
                            ...p,
                            [topic.id]: e.target.value,
                          }))
                        }
                        className="min-w-[200px] rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                        disabled={!availableToAdd[topic.id]?.length}
                      >
                        {availableToAdd[topic.id]?.length ? (
                          availableToAdd[topic.id].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))
                        ) : (
                          <option value="">All industries added</option>
                        )}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => addIndustry(topic.id)}
                      disabled={!availableToAdd[topic.id]?.length}
                      className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void suggestIndustries(topic.id)}
                      disabled={suggestingId === topic.id}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestingId === topic.id
                        ? "AI Suggest…"
                        : "AI Suggest"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveTopic(topic.id)}
                      disabled={savingId === topic.id}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === topic.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

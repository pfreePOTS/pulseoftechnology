"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { type IndustryPosition } from "@/components/RadarChart";
import { adminFetch, API_BASE } from "@/lib/api";

const ADOPTION_STATES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

interface TopicRow {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
}

function normalizeIndustryPositions(
  raw: Record<string, IndustryPosition> | null | undefined,
): Record<string, IndustryPosition> {
  if (!raw) return {};
  const out: Record<string, IndustryPosition> = {};
  for (const [k, v] of Object.entries(raw)) {
    const impact =
      typeof v.impact_score === "number"
        ? v.impact_score
        : typeof v.urgency_score === "number"
          ? v.urgency_score
          : 5;
    const risk = typeof v.risk_level === "number" ? v.risk_level : 5;
    out[k] = {
      ...v,
      impact_score: impact,
      urgency_score: typeof v.urgency_score === "number" ? v.urgency_score : impact,
      risk_level: risk,
      adoption_state: v.adoption_state ?? "Learn About",
      impact_approved: v.impact_approved !== false,
    };
  }
  return out;
}

export default function WorkbenchImpactTab() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Record<string, IndustryPosition>>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [suggestId, setSuggestId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [rW, rS] = await Promise.all([
      adminFetch(`${API_BASE}/api/admin/topics?status=watched`),
      adminFetch(`${API_BASE}/api/admin/topics?status=selected`),
    ]);
    const watched = rW.ok ? ((await rW.json()) as TopicRow[]) : [];
    const selected = rS.ok ? ((await rS.json()) as TopicRow[]) : [];
    const all = [...selected, ...watched];
    if (!rW.ok && !rS.ok) {
      setError("Could not load topics");
      setTopics([]);
      setLoading(false);
      return;
    }
    setTopics(all);
    const initial: Record<number, Record<string, IndustryPosition>> = {};
    for (const t of all) {
      initial[t.id] = normalizeIndustryPositions(t.industry_positions);
    }
    setDrafts(initial);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateDraft(
    topicId: number,
    industry: string,
    patch: Partial<IndustryPosition>,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] ?? {}),
        [industry]: {
          ...(prev[topicId]?.[industry] ?? {
            adoption_state: "Learn About",
            impact_score: 5,
            risk_level: 5,
            urgency_score: 5,
          }),
          ...patch,
        },
      },
    }));
  }

  function removeIndustry(topicId: number, industry: string) {
    setDrafts((prev) => {
      const next = { ...(prev[topicId] ?? {}) };
      delete next[industry];
      return { ...prev, [topicId]: next };
    });
  }

  async function saveTopic(topic: TopicRow) {
    const positions = drafts[topic.id];
    if (!positions) return;
    setSavingId(topic.id);
    setError(null);
    const payload = {
      industry_positions: Object.keys(positions).length > 0 ? positions : null,
    };
    const r = await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError((d as { detail?: string }).detail ?? "Save failed");
      setSavingId(null);
      return;
    }
    const updated = (await r.json()) as TopicRow;
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, ...updated } : t)));
    setDrafts((prev) => ({ ...prev, [topic.id]: normalizeIndustryPositions(updated.industry_positions) }));
    setSavingId(null);
  }

  async function runSuggest(topic: TopicRow) {
    setSuggestId(topic.id);
    setError(null);
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/suggest-industry-positions`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const suggestions = data.industry_suggestions ?? {};
      setDrafts((prev) => {
        const current = { ...(prev[topic.id] ?? {}) };
        for (const [industry, row] of Object.entries(suggestions)) {
          const r = row as {
            impact_score?: number;
            score?: number;
            risk_level?: number;
            adoption_state?: string;
            rationale?: string;
          };
          const impact = typeof r.impact_score === "number" ? r.impact_score : Number(r.score ?? 5);
          const risk = typeof r.risk_level === "number" ? r.risk_level : 5;
          current[industry] = {
            impact_score: Math.round(impact * 10) / 10,
            urgency_score: Math.round(impact * 10) / 10,
            risk_level: Math.round(risk * 10) / 10,
            adoption_state: r.adoption_state ?? current[industry]?.adoption_state ?? "Get Prepared For",
            rationale: r.rationale ?? current[industry]?.rationale,
            impact_approved: false,
          };
        }
        return { ...prev, [topic.id]: current };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI suggestion failed");
    }
    setSuggestId(null);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading topics…</p>;
  }

  if (topics.length === 0) {
    return (
      <div className="max-w-5xl rounded-xl border border-dashed border-gray-700 bg-gray-900/50 px-6 py-10 text-center">
        <p className="text-sm text-gray-400">No watched or selected topics yet.</p>
        <p className="mt-2 text-xs text-gray-600">
          Approve topics in <strong className="text-gray-400">Curation</strong> first, then set per-industry impact
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Impact</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        For each <strong className="text-gray-300">watched or selected</strong> topic, set{" "}
        <strong className="text-gray-300">impact</strong> (how strong the signal is for that industry) and{" "}
        <strong className="text-gray-300">risk</strong> (regulatory, compliance, security, or disruption exposure).
        Higher risk pulls the star <strong className="text-gray-300">toward the centre</strong> of the public radar;
        higher impact pushes it outward on the adoption spoke. Approve each row when it is ready for the live radar.
      </p>
      {error && (
        <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {topics.map((topic) => {
          const open = openId === topic.id;
          const draft = drafts[topic.id] ?? {};
          const industries = Object.keys(draft);
          return (
            <li
              key={topic.id}
              className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : topic.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-900"
              >
                <div>
                  <p className="font-medium text-white">{topic.name}</p>
                  <p className="text-xs text-gray-500">
                    {topic.domain} · topic urgency {topic.urgency_score.toFixed(1)} · {industries.length}{" "}
                    {industries.length === 1 ? "industry" : "industries"}
                  </p>
                </div>
                <span className="text-xs text-gray-500">{open ? "▼" : "▶"}</span>
              </button>

              {open && (
                <div className="border-t border-gray-800 px-4 py-4">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runSuggest(topic)}
                      disabled={suggestId === topic.id}
                      className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50"
                    >
                      {suggestId === topic.id ? "Generating…" : "✨ AI suggest industries"}
                    </button>
                    <Link
                      href={`/admin/topics/${topic.id}`}
                      className="text-xs text-gray-500 hover:text-indigo-400"
                    >
                      Open full topic editor
                    </Link>
                  </div>

                  {industries.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No industry rows yet. Run AI suggestions or add positions on the topic page.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {industries.map((industry) => {
                        const pos = draft[industry];
                        const impact = pos.impact_score ?? pos.urgency_score ?? 5;
                        const risk = pos.risk_level ?? 5;
                        return (
                          <div
                            key={industry}
                            className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-200">{industry}</span>
                              <label className="flex items-center gap-2 text-xs text-gray-400">
                                <input
                                  type="checkbox"
                                  checked={pos.impact_approved !== false}
                                  onChange={(e) =>
                                    updateDraft(topic.id, industry, {
                                      impact_approved: e.target.checked,
                                    })
                                  }
                                  className="rounded border-gray-600 bg-gray-800 text-indigo-500"
                                />
                                Approved for radar
                              </label>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="w-16 shrink-0 text-[10px] uppercase text-gray-600">Impact</span>
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.1}
                                value={impact}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  updateDraft(topic.id, industry, {
                                    impact_score: v,
                                    urgency_score: v,
                                  });
                                }}
                                className="min-w-[120px] flex-1 accent-indigo-500"
                              />
                              <span className="w-8 text-right text-xs tabular-nums text-indigo-300">
                                {impact.toFixed(1)}
                              </span>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="w-16 shrink-0 text-[10px] uppercase text-gray-600">Risk</span>
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.1}
                                value={risk}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  updateDraft(topic.id, industry, { risk_level: v });
                                }}
                                className="min-w-[120px] flex-1 accent-amber-500"
                              />
                              <span className="w-8 text-right text-xs tabular-nums text-amber-300">
                                {risk.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-16 shrink-0 text-[10px] uppercase text-gray-600">Stage</span>
                              <select
                                value={pos.adoption_state}
                                onChange={(e) =>
                                  updateDraft(topic.id, industry, { adoption_state: e.target.value })
                                }
                                className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
                              >
                                {ADOPTION_STATES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeIndustry(topic.id, industry)}
                                className="text-xs text-gray-600 hover:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                            {pos.rationale && (
                              <p className="mt-2 text-xs italic text-gray-500">{pos.rationale}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveTopic(topic)}
                      disabled={savingId === topic.id}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {savingId === topic.id ? "Saving…" : "Save industry impact"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

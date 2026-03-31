"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Article {
  id: number;
  title: string;
  url: string;
  content: string | null;
  status: string;
  what_is_it: string | null;
  why_it_matters: string | null;
  tags: string[] | null;
}

const ADOPTION_STATES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Manufacturing",
  "Education",
  "Retail & E-Commerce",
  "Government & Public Sector",
  "Media & Entertainment",
  "Energy & Utilities",
  "Other",
] as const;

interface IndustryPosition {
  urgency_score: number;
  impact_score?: number;
  risk_level?: number;
  adoption_state: string;
  rationale?: string;
  /** When false, row is omitted from public radar until approved in Impact workbench */
  impact_approved?: boolean;
}

function rowImpact(p: IndustryPosition): number {
  return typeof p.impact_score === "number" ? p.impact_score : p.urgency_score;
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  status: string;
  is_published: boolean;
  articles: Article[];
}

type SaveState = "idle" | "saving" | "saved" | "error";
type WatchState = "idle" | "watching" | "watched" | "error";

// ── Shared input styles (dark admin theme)
const inputCls =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50";

export default function TopicEditor({ topic }: { topic: TopicDetail }) {
  const router = useRouter();
  const [summary, setSummary] = useState(topic.summary ?? "");
  const [urgency, setUrgency] = useState(String(topic.urgency_score));
  const [adoptionState, setAdoptionState] = useState(topic.adoption_state);
  const [industryPositions, setIndustryPositions] = useState<
    Record<string, IndustryPosition>
  >(topic.industry_positions ?? {});

  // New-row form state
  const [newIndustry, setNewIndustry] = useState<string>("");
  const [newUrgency, setNewUrgency] = useState("5.0");
  const [newAdoptionState, setNewAdoptionState] = useState<string>(
    "Learn About",
  );

  const [pendingSuggestions, setPendingSuggestions] = useState<Record<
    string,
    IndustryPosition
  > | null>(null);
  const [suggestState, setSuggestState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const [summaryGenState, setSummaryGenState] = useState<"idle" | "loading" | "error">("idle");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [watchState, setWatchState] = useState<WatchState>(
    topic.status !== "pending" ? "watched" : "idle",
  );
  const [isPublished, setIsPublished] = useState(topic.is_published);
  const [errorMsg, setErrorMsg] = useState("");

  const isWatched =
    watchState === "watched" || topic.status !== "pending";

  // ── Industry position helpers
  function addIndustryPosition() {
    if (!newIndustry) return;
    setIndustryPositions((prev) => ({
      ...prev,
      [newIndustry]: {
        urgency_score: parseFloat(newUrgency) || 5.0,
        impact_score: parseFloat(newUrgency) || 5.0,
        risk_level: 5,
        adoption_state: newAdoptionState,
        impact_approved: true,
      },
    }));
    setNewIndustry("");
    setNewUrgency("5.0");
    setNewAdoptionState("Learn About");
  }

  function removeIndustryPosition(industry: string) {
    setIndustryPositions((prev) => {
      const next = { ...prev };
      delete next[industry];
      return next;
    });
  }

  function updateIndustryPosition(
    industry: string,
    field: keyof IndustryPosition,
    value: string,
  ) {
    setIndustryPositions((prev) => {
      const cur = prev[industry];
      if (!cur) return prev;
      let nextVal: string | number | boolean = value;
      if (field === "urgency_score" || field === "impact_score" || field === "risk_level") {
        nextVal = parseFloat(value) || 0;
      }
      const next: IndustryPosition = { ...cur, [field]: nextVal } as IndustryPosition;
      if (field === "urgency_score" || field === "impact_score") {
        const v = typeof nextVal === "number" ? nextVal : parseFloat(String(nextVal)) || 0;
        next.urgency_score = v;
        next.impact_score = v;
      }
      return { ...prev, [industry]: next };
    });
  }

  // ── Build payload (shared between Save and Approve)
  function buildPayload() {
    return {
      summary: summary || null,
      urgency_score: parseFloat(urgency),
      adoption_state: adoptionState,
      industry_positions:
        Object.keys(industryPositions).length > 0 ? industryPositions : null,
    };
  }

  async function handleGenerateSummary() {
    setSummaryGenState("loading");
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/generate-summary`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummary(data.summary ?? "");
      setSummaryGenState("idle");
    } catch {
      setSummaryGenState("error");
      setTimeout(() => setSummaryGenState("idle"), 3000);
    }
  }

  async function handleSuggest() {
    setSuggestState("loading");
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/suggest-industry-positions`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const suggestions: Record<
        string,
        {
          score?: number;
          impact_score?: number;
          risk_level?: number;
          adoption_state: string;
          rationale: string;
        }
      > = data.industry_suggestions ?? {};

      // Build pending suggestions (includes rationale) for curator review before applying
      const merged: Record<string, IndustryPosition> = { ...industryPositions };
      for (const [industry, row] of Object.entries(suggestions)) {
        const impact =
          typeof row.impact_score === "number"
            ? row.impact_score
            : typeof row.score === "number"
              ? row.score
              : 5;
        const risk = typeof row.risk_level === "number" ? row.risk_level : 5;
        merged[industry] = {
          urgency_score: Math.round(impact * 10) / 10,
          impact_score: Math.round(impact * 10) / 10,
          risk_level: Math.round(risk * 10) / 10,
          adoption_state:
            row.adoption_state ?? industryPositions[industry]?.adoption_state ?? "Get Prepared For",
          rationale: row.rationale,
          impact_approved: false,
        };
      }
      setPendingSuggestions(merged);
      setSuggestState("idle");
    } catch {
      setSuggestState("error");
      setTimeout(() => setSuggestState("idle"), 3000);
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  async function handleWatch() {
    setWatchState("watching");
    setErrorMsg("");
    try {
      await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        body: JSON.stringify(buildPayload()),
      });
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/watch`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      setWatchState("watched");
      setTimeout(() => router.push("/admin?step=research"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Watch failed");
      setWatchState("error");
    }
  }

  async function handleTogglePublish() {
    const endpoint = isPublished ? "unpublish" : "publish";
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/${endpoint}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      setIsPublished(!isPublished);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  const displayPositions = pendingSuggestions ?? industryPositions;
  const availableIndustries = INDUSTRIES.filter(
    (ind) => !(ind in displayPositions),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {topic.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {topic.domain}
            </span>
            {isWatched && (
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-green-500/30">
                {topic.status === "selected" ? "Selected" : "Watched"}
              </span>
            )}
            {isPublished && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
                Live on Radar
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Edit Form ── */}
        <section className="lg:col-span-3 space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Edit Briefing
          </h2>

          {/* Summary */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="summary"
                className="text-sm font-medium text-gray-300"
              >
                Executive Summary
              </label>
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={summaryGenState === "loading"}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50"
              >
                {summaryGenState === "loading" ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" /> Generating…</>
                ) : summaryGenState === "error" ? (
                  "Error — retry"
                ) : (
                  "✨ Generate Summary"
                )}
              </button>
            </div>
            <textarea
              id="summary"
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`w-full ${inputCls}`}
              placeholder="AI-generated executive summary will appear here…"
            />
          </div>

          {/* Default urgency + adoption state */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="urgency"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Default Urgency{" "}
                <span className="text-xs text-gray-500">(1–10)</span>
              </label>
              <input
                id="urgency"
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label
                htmlFor="adoption-state"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Default Adoption State
              </label>
              <select
                id="adoption-state"
                value={adoptionState}
                onChange={(e) => setAdoptionState(e.target.value)}
                className={`w-full ${inputCls}`}
              >
                {ADOPTION_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Industry Positions ── */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-300">
                  Industry Positions
                </h3>
                <p className="text-xs text-gray-500">
                  Per-industry impact and risk (radar distance and pull toward centre), adoption stage, and radar
                  visibility
                </p>
              </div>
              <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={suggestState === "loading"}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 ring-1 ring-indigo-500/30 transition-colors hover:bg-indigo-600/30 disabled:opacity-50"
                >
                  {suggestState === "loading" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
                      Generating…
                    </>
                  ) : suggestState === "error" ? (
                    "⚠ Failed — try again"
                  ) : (
                    "✨ Generate AI Suggestions"
                  )}
                </button>
            </div>

            {/* AI suggestions pending Apply/Discard */}
            {pendingSuggestions && (
              <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
                <p className="text-sm font-medium text-indigo-300">AI Suggestions Ready</p>
                <p className="mt-1 text-xs text-indigo-400/80">
                  Review the suggested positions below. Apply them to overwrite current settings.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => { setIndustryPositions(pendingSuggestions); setPendingSuggestions(null); }}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Apply Suggestions
                  </button>
                  <button
                    onClick={() => setPendingSuggestions(null)}
                    className="rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Existing rows */}
            {Object.entries(displayPositions).length > 0 ? (
              <div className="mb-3 divide-y divide-gray-800 rounded-lg border border-gray-700">
                {Object.entries(displayPositions).map(
                  ([industry, pos]) => (
                    <div key={industry}>
                      <div className="flex flex-col gap-1.5 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-36 shrink-0 text-xs font-medium text-gray-300">
                            {industry}
                          </span>
                          <label className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-500">
                            <input
                              type="checkbox"
                              checked={pos.impact_approved !== false}
                              disabled={!!pendingSuggestions}
                              onChange={(e) =>
                                setIndustryPositions((prev) => ({
                                  ...prev,
                                  [industry]: {
                                    ...prev[industry]!,
                                    impact_approved: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded border-gray-600 bg-gray-800"
                            />
                            On radar
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[10px] uppercase text-gray-600">Impact</span>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.1"
                            value={rowImpact(pos)}
                            disabled={!!pendingSuggestions}
                            onChange={(e) =>
                              updateIndustryPosition(industry, "urgency_score", e.target.value)
                            }
                            className="flex-1 accent-indigo-500 disabled:opacity-50"
                          />
                          <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-indigo-300">
                            {rowImpact(pos).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[10px] uppercase text-gray-600">Risk</span>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.1"
                            value={typeof pos.risk_level === "number" ? pos.risk_level : 5}
                            disabled={!!pendingSuggestions}
                            onChange={(e) =>
                              updateIndustryPosition(industry, "risk_level", e.target.value)
                            }
                            className="flex-1 accent-amber-500 disabled:opacity-50"
                          />
                          <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-amber-300">
                            {(typeof pos.risk_level === "number" ? pos.risk_level : 5).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pl-[72px]">
                          <select
                            value={pos.adoption_state}
                            disabled={!!pendingSuggestions}
                            onChange={(e) =>
                              updateIndustryPosition(
                                industry,
                                "adoption_state",
                                e.target.value,
                              )
                            }
                            className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                          >
                            {ADOPTION_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeIndustryPosition(industry)}
                            className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                        {pos.rationale && (
                          <p className="text-xs italic leading-relaxed text-gray-500">
                            {pos.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mb-3 text-xs text-gray-600">
                No industry overrides — all industries use the default above.
              </p>
            )}

            {/* Add-row form */}
            {availableIndustries.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">Add industry…</option>
                  {availableIndustries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={newUrgency}
                  onChange={(e) => setNewUrgency(e.target.value)}
                  className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="Urgency"
                />
                <select
                  value={newAdoptionState}
                  onChange={(e) => setNewAdoptionState(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {ADOPTION_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addIndustryPosition}
                  disabled={!newIndustry}
                  className="shrink-0 rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 disabled:opacity-40 transition-colors"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save Changes"}
            </button>
            {saveState === "saved" && (
              <span className="text-sm text-green-400">Saved</span>
            )}
            {!isWatched && (
              <button
                onClick={handleWatch}
                disabled={watchState === "watching"}
                className="rounded-lg bg-pulse-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {watchState === "watching" ? "Watching…" : "Start Watching"}
              </button>
            )}
            {isWatched && (
              <button
                onClick={handleTogglePublish}
                className={`ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isPublished
                    ? "bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500/40 hover:bg-indigo-600/20"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isPublished ? "bg-indigo-400" : "bg-gray-500"}`} />
                {isPublished ? "Live on Radar" : "Publish to Radar"}
              </button>
            )}
          </div>

          {watchState === "watched" && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
              Topic is now being watched. Redirecting to workbench…
            </p>
          )}
        </section>

        {/* ── Source Articles ── */}
        <aside className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Source Articles ({topic.articles.length})
          </h2>
          {topic.articles.length === 0 ? (
            <p className="text-sm text-gray-600">No articles linked.</p>
          ) : (
            <ul className="space-y-3">
              {topic.articles.map((article) => (
                <li
                  key={article.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                >
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {article.title}
                  </a>
                  {article.what_is_it && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">
                        What is it
                      </p>
                      <p className="text-xs leading-relaxed text-gray-400">
                        {article.what_is_it}
                      </p>
                    </div>
                  )}
                  {article.why_it_matters && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">
                        Why it matters
                      </p>
                      <p className="text-xs leading-relaxed text-gray-400">
                        {article.why_it_matters}
                      </p>
                    </div>
                  )}
                  {!article.what_is_it && article.content && (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-500">
                      {article.content}
                    </p>
                  )}
                  {article.tags && article.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

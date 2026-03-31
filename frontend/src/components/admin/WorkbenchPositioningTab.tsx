"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface TopicInsight {
  topic_id: number;
  name: string;
  domain: string;
  urgency_score: number;
  article_count: number;
  articles_last_7d: number;
  articles_prior_7d: number;
  trend: "up" | "down" | "flat";
  label: string;
  note: string;
  ai_enriched: boolean;
}

function TrendPanel({
  last7,
  prior7,
  trend: trendRaw,
  label,
  note,
  urgency,
  aiEnriched,
}: {
  last7: number;
  prior7: number;
  trend: string;
  label: string;
  note: string;
  urgency: number;
  aiEnriched: boolean;
}) {
  const trend: "up" | "down" | "flat" =
    trendRaw === "up" || trendRaw === "down" || trendRaw === "flat" ? trendRaw : "flat";
  const max = Math.max(last7, prior7, 1);
  const barH = 28;
  const hPrior = Math.max(4, Math.round((prior7 / max) * barH));
  const hLast = Math.max(4, Math.round((last7 / max) * barH));
  const arrow =
    trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendCls =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-rose-400"
        : "text-slate-400";
  const tip = `${note}\n\nTopic urgency: ${urgency.toFixed(1)}/10\nArticles ingested — last 7 days: ${last7}, prior 7 days: ${prior7}.${aiEnriched ? "" : "\n(Trend from volume; enable ANTHROPIC_API_KEY for AI tone analysis.)"}`;

  return (
    <div
      className="group/trend mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-800/80 bg-gray-950/40 px-3 py-2"
      title={tip}
    >
      <span className={`select-none text-2xl font-bold leading-none ${trendCls}`} aria-hidden>
        {arrow}
      </span>
      <div
        className="flex items-end gap-1.5 border-l border-gray-800 pl-3"
        aria-label="Article ingests: prior 7 days versus last 7 days"
      >
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="w-5 rounded-sm bg-slate-600"
            style={{ height: `${hPrior}px` }}
            title={`${prior7} article(s) ingested in the 7 days before last week`}
          />
          <span className="text-[9px] uppercase tracking-wide text-gray-600">−7d</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="w-5 rounded-sm bg-indigo-500"
            style={{ height: `${hLast}px` }}
            title={`${last7} article(s) ingested in the last 7 days`}
          />
          <span className="text-[9px] uppercase tracking-wide text-gray-600">7d</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-snug text-gray-200">{label}</p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          Coverage: {prior7} → {last7} ingest{last7 === 1 ? "" : "s"} / 7d · Urgency {urgency.toFixed(1)}
          {aiEnriched ? (
            <span className="text-indigo-400/80"> · AI</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  industry_positions: Record<string, unknown> | null;
  articles: {
    id: number;
    title?: string;
    persona_impacts: Record<string, string> | null;
  }[];
}

function collectPersonaKeys(articles: TopicDetail["articles"] | undefined): string[] {
  const keys = new Set<string>();
  const list = articles ?? [];
  for (const a of list) {
    const pi = a.persona_impacts;
    if (pi && typeof pi === "object") {
      Object.keys(pi).forEach((k) => keys.add(k));
    }
  }
  return [...keys].sort();
}

export default function WorkbenchPositioningTab() {
  const [topics, setTopics] = useState<TopicInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<number, TopicDetail | "loading" | "error">>({});
  const [errorById, setErrorById] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    setInsightsError(null);
    adminFetch(`${API_BASE}/api/admin/topics/positioning-insights`)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || `HTTP ${r.status}`);
        }
        return r.json() as Promise<TopicInsight[]>;
      })
      .then((data) => {
        if (!cancelled) setTopics(Array.isArray(data) ? data : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setInsightsError(e instanceof Error ? e.message : "Failed to load positioning insights");
          setTopics([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setErrorById((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    setDetails((d) => ({ ...d, [id]: "loading" }));
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/topics/${id}`);
      const raw = await r.text();
      if (!r.ok) {
        let detail = `Request failed (${r.status})`;
        try {
          const j = JSON.parse(raw) as { detail?: string };
          if (j.detail) detail = typeof j.detail === "string" ? j.detail : detail;
        } catch {
          if (raw) detail = raw.slice(0, 200);
        }
        setErrorById((e) => ({ ...e, [id]: detail }));
        setDetails((d) => ({ ...d, [id]: "error" }));
        return;
      }
      let data: TopicDetail;
      try {
        data = JSON.parse(raw) as TopicDetail;
      } catch {
        setErrorById((e) => ({ ...e, [id]: "Invalid JSON from server" }));
        setDetails((d) => ({ ...d, [id]: "error" }));
        return;
      }
      if (!data.articles) {
        data = { ...data, articles: [] };
      }
      setDetails((d) => ({ ...d, [id]: data }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorById((e) => ({ ...e, [id]: msg }));
      setDetails((d) => ({ ...d, [id]: "error" }));
    }
  }, []);

  function clearDetail(id: number) {
    setDetails((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    setErrorById((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Positioning</h2>
      <p className="mt-1 text-sm text-gray-400">
        Refine industry positions per topic and review AI-generated persona impacts for each article. Trends compare
        article ingests last 7 days vs the prior 7 days; when configured, Claude Haiku adds tone and momentum context.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading positioning insights (may take a few seconds if AI is enabled)…</p>
      ) : insightsError ? (
        <div className="mt-6 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {insightsError}
        </div>
      ) : topics.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No selected topics yet. Select topics for the radar in the Selection step first.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {topics.map((t) => {
            const row = details[t.topic_id];
            const articles = row && row !== "loading" && row !== "error" ? row.articles ?? [] : [];
            const personaKeys = row && row !== "loading" && row !== "error" ? collectPersonaKeys(articles) : [];
            const errMsg = errorById[t.topic_id];

            return (
              <div
                key={t.topic_id}
                className="rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.domain} · {t.article_count} article{t.article_count !== 1 ? "s" : ""} · urgency{" "}
                      {typeof t.urgency_score === "number" ? t.urgency_score.toFixed(1) : t.urgency_score}
                    </p>
                  </div>
                  <Link
                    href={`/admin/topics/${t.topic_id}`}
                    className="shrink-0 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
                  >
                    Edit topic & positions
                  </Link>
                </div>

                <TrendPanel
                  last7={t.articles_last_7d}
                  prior7={t.articles_prior_7d}
                  trend={t.trend}
                  label={t.label}
                  note={t.note}
                  urgency={t.urgency_score}
                  aiEnriched={t.ai_enriched}
                />

                {row === "loading" && (
                  <p className="mt-3 text-xs text-indigo-400">Loading persona impact coverage…</p>
                )}

                {row === "error" && (
                  <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2">
                    <p className="text-xs text-red-300">
                      {errMsg ?? "Could not load topic detail."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadDetail(t.topic_id)}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => clearDetail(t.topic_id)}
                        className="text-xs text-gray-500 hover:text-gray-400"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {row && row !== "loading" && row !== "error" && (
                  <div className="mt-3 space-y-3 border-t border-gray-800/80 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Personas with generated impacts: </span>
                        {personaKeys.length > 0 ? (
                          <span className="text-gray-200">{personaKeys.join(", ")}</span>
                        ) : (
                          <span className="text-amber-400/90">
                            None yet — run article processing so persona_impacts are saved, or open the topic to
                            inspect articles.
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => clearDetail(t.topic_id)}
                        className="text-xs text-gray-500 hover:text-gray-400"
                      >
                        Hide coverage
                      </button>
                    </div>

                    {articles.length === 0 ? (
                      <p className="text-xs text-gray-500">No articles are linked to this topic yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {articles.map((a) => {
                          const pi = a.persona_impacts;
                          const entries =
                            pi && typeof pi === "object" ? Object.entries(pi) : [];
                          const hasPi = entries.length > 0;
                          return (
                            <li
                              key={a.id}
                              className="rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2 text-xs"
                            >
                              <p className="font-medium text-gray-200">
                                {a.title ?? `Article #${a.id}`}
                              </p>
                              {hasPi ? (
                                <ul className="mt-2 space-y-1.5 border-t border-gray-800/80 pt-2">
                                  {entries.map(([role, text]) => (
                                    <li key={role}>
                                      <span className="font-semibold text-indigo-400">{role}: </span>
                                      <span className="text-gray-400">{text}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-gray-600">
                                  No persona impacts stored for this article (pipeline may not have run yet).
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {!row && (
                  <button
                    type="button"
                    onClick={() => void loadDetail(t.topic_id)}
                    className="mt-3 cursor-pointer text-left text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    Show persona impact coverage
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

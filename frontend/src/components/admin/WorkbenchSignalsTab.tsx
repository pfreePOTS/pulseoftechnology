"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

export interface Signal {
  id: number;
  topic_id: number;
  topic_name: string;
  topic_domain: string;
  current_state: string;
  suggested_state: string;
  rationale: string;
  velocity_score: number;
  acceleration_score: number;
  status: string;
  created_at: string;
}

interface TopicArticle {
  id: number;
  title: string;
  what_is_it: string | null;
}

interface TopicDetailPayload {
  id: number;
  status: string;
  articles: TopicArticle[];
}

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

type MainTab = "pending" | "acted";

function mergeActedSignals(approved: Signal[], rejected: Signal[]): Signal[] {
  return [...approved, ...rejected].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export default function WorkbenchSignalsTab() {
  const [mainTab, setMainTab] = useState<MainTab>("pending");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<number>>(new Set());
  const [topicLoading, setTopicLoading] = useState<Record<number, boolean>>({});
  const [topicCache, setTopicCache] = useState<Record<number, TopicDetailPayload | null>>({});

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    if (mainTab === "pending") {
      const r = await adminFetch(`${API_BASE}/api/admin/signals?status=pending`);
      if (r.ok) setSignals(await r.json());
      else setSignals([]);
    } else {
      const [ra, rr] = await Promise.all([
        adminFetch(`${API_BASE}/api/admin/signals?status=approved`),
        adminFetch(`${API_BASE}/api/admin/signals?status=rejected`),
      ]);
      const approved: Signal[] = ra.ok ? await ra.json() : [];
      const rejected: Signal[] = rr.ok ? await rr.json() : [];
      setSignals(mergeActedSignals(approved, rejected));
    }
    setLoading(false);
  }, [mainTab]);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals]);

  const emptyMessage = useMemo(() => {
    if (mainTab === "pending") {
      return {
        title: "No pending signals",
        hint: "Run the Signal Scorer above, or wait for the scheduled job.",
      };
    }
    return {
      title: "No acted signals yet",
      hint: "Approved and dismissed recommendations will appear here.",
    };
  }, [mainTab]);

  async function handleRunScorer() {
    setRunning(true);
    await adminFetch(`${API_BASE}/api/admin/jobs/signals`, { method: "POST" });
    window.setTimeout(() => {
      void fetchSignals().finally(() => setRunning(false));
    }, 3000);
  }

  async function handleDismiss(id: number) {
    setActing(id);
    await adminFetch(`${API_BASE}/api/admin/signals/${id}/reject`, { method: "POST" });
    setActing(null);
    await fetchSignals();
  }

  async function handleStartWatching(sig: Signal) {
    setActing(sig.id);
    const approveR = await adminFetch(`${API_BASE}/api/admin/signals/${sig.id}/approve`, {
      method: "POST",
    });
    if (approveR.ok) {
      const topicR = await adminFetch(`${API_BASE}/api/admin/topics/${sig.topic_id}`);
      if (topicR.ok) {
        const topic = (await topicR.json()) as TopicDetailPayload;
        if (topic.status === "pending") {
          await adminFetch(`${API_BASE}/api/admin/topics/${sig.topic_id}/watch`, {
            method: "POST",
          });
        }
      }
    }
    setActing(null);
    await fetchSignals();
  }

  async function toggleSupportingArticles(topicId: number) {
    const next = new Set(expandedTopicIds);
    if (next.has(topicId)) {
      next.delete(topicId);
      setExpandedTopicIds(next);
      return;
    }
    next.add(topicId);
    setExpandedTopicIds(next);

    if (topicCache[topicId] !== undefined) return;

    setTopicLoading((prev) => ({ ...prev, [topicId]: true }));
    const r = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}`);
    setTopicLoading((prev) => ({ ...prev, [topicId]: false }));
    if (r.ok) {
      const data = (await r.json()) as TopicDetailPayload;
      setTopicCache((prev) => ({ ...prev, [topicId]: data }));
    } else {
      setTopicCache((prev) => ({ ...prev, [topicId]: null }));
    }
  }

  function recentArticles(articles: TopicArticle[]): TopicArticle[] {
    return [...articles].sort((a, b) => b.id - a.id).slice(0, 12);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Signals</h2>
          <p className="mt-1 text-sm text-gray-400">
            What is the system telling us is trending?
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRunScorer()}
          disabled={running}
          className="flex shrink-0 items-center justify-center gap-2 self-end rounded-lg bg-indigo-600/20 px-4 py-2 text-sm font-semibold text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50 sm:self-auto"
        >
          {running ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
              Scoring…
            </>
          ) : (
            "Run Signal Scorer"
          )}
        </button>
      </div>

      <div className="mb-5 flex w-fit gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
        <button
          type="button"
          onClick={() => setMainTab("pending")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "pending"
              ? "bg-gray-700 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setMainTab("acted")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "acted" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Acted on
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-base font-medium text-gray-400">{emptyMessage.title}</p>
          <p className="mt-1 text-sm text-gray-600">{emptyMessage.hint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((sig) => (
            <div
              key={sig.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        DOMAIN_COLORS[sig.topic_domain] ?? "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {sig.topic_domain}
                    </span>
                    <span className="text-sm font-bold text-white">{sig.topic_name}</span>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded bg-gray-800 px-2 py-1 text-xs font-medium text-gray-400">
                      {sig.current_state}
                    </span>
                    <span className="text-indigo-400">→</span>
                    <span className="rounded bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                      {sig.suggested_state}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-gray-300">{sig.velocity_score}</span>{" "}
                      articles last 7 days
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span>
                      <span className="font-semibold text-gray-300">
                        {sig.acceleration_score.toFixed(1)}×
                      </span>{" "}
                      acceleration vs prior week
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-gray-400">{sig.rationale}</p>

                  <p className="mt-3 text-xs text-gray-600">
                    Generated{" "}
                    {new Date(sig.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  <div className="mt-4 border-t border-gray-800 pt-3">
                    <button
                      type="button"
                      onClick={() => void toggleSupportingArticles(sig.topic_id)}
                      className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      {expandedTopicIds.has(sig.topic_id)
                        ? "Hide supporting articles"
                        : "Show supporting articles"}
                    </button>

                    {expandedTopicIds.has(sig.topic_id) && (
                      <div className="mt-3 space-y-3">
                        {topicLoading[sig.topic_id] ? (
                          <p className="text-xs text-gray-500">Loading articles…</p>
                        ) : topicCache[sig.topic_id] === null ? (
                          <p className="text-xs text-gray-500">Could not load topic.</p>
                        ) : topicCache[sig.topic_id] ? (
                          recentArticles(topicCache[sig.topic_id]!.articles).length === 0 ? (
                            <p className="text-xs text-gray-500">No articles yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {recentArticles(topicCache[sig.topic_id]!.articles).map((a) => (
                                <li
                                  key={a.id}
                                  className="rounded-lg border border-gray-800/80 bg-gray-950/50 p-3"
                                >
                                  <p className="text-sm font-medium text-white">{a.title}</p>
                                  {a.what_is_it ? (
                                    <p className="mt-1 text-xs leading-relaxed text-gray-400">
                                      {a.what_is_it}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {mainTab === "pending" && (
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={() => void handleStartWatching(sig)}
                      disabled={acting === sig.id}
                      className="rounded-lg bg-green-600/20 px-4 py-2 text-xs font-semibold text-green-400 ring-1 ring-green-500/30 hover:bg-green-600/30 disabled:opacity-50"
                    >
                      {acting === sig.id ? "…" : "Start Watching"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDismiss(sig.id)}
                      disabled={acting === sig.id}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

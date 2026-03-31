"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch, API_BASE } from "@/lib/api";

export interface TopicRow {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  status: string;
  adoption_state: string;
  article_count: number;
  is_published: boolean;
  velocity_score: number | null;
  acceleration_score: number | null;
  signal_rationale: string | null;
  signal_suggested_state: string | null;
  signal_id: number | null;
}

interface TopicDetailArticle {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  source_name: string | null;
}

interface TopicDetailResponse {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  articles: TopicDetailArticle[];
}

type TabId = "pending" | "approved";

const TAB_IDS = new Set<TabId>(["pending", "approved"]);

function DomainPill({ domain }: { domain: string }) {
  const palette: Record<string, string> = {
    AI: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
    Security: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    Cloud: "bg-sky-500/20 text-sky-400 ring-sky-500/30",
    Finance: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    Leadership: "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  };
  const cls = palette[domain] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {domain}
    </span>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function fmtOneDecimal(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function articleSourceLabel(a: TopicDetailArticle): string {
  if (a.source_name?.trim()) return a.source_name;
  try {
    return new URL(a.url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

function fmtPublished(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function VelocityMini({
  velocity,
  acceleration,
}: {
  velocity: number | null;
  acceleration: number | null;
}) {
  const v = typeof velocity === "number" && !Number.isNaN(velocity) ? velocity : 0;
  const a = typeof acceleration === "number" && !Number.isNaN(acceleration) ? acceleration : 0;
  const vh = Math.min(100, Math.max(8, (v / 12) * 100));
  const ah = Math.min(100, Math.max(8, (a / 4) * 100));
  return (
    <div className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Velocity (7d)</span>
        <div className="flex h-14 items-end rounded-md bg-gray-800/80 px-2 pt-2">
          <div
            className="w-full min-h-[6px] rounded-sm bg-indigo-500/90 transition-[height]"
            style={{ height: `${vh}%` }}
            title={`${v.toFixed(1)} articles`}
          />
        </div>
        <span className="text-center text-xs tabular-nums text-indigo-300">{fmtOneDecimal(velocity)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Acceleration</span>
        <div className="flex h-14 items-end rounded-md bg-gray-800/80 px-2 pt-2">
          <div
            className="w-full min-h-[6px] rounded-sm bg-amber-500/90 transition-[height]"
            style={{ height: `${ah}%` }}
            title={`${a.toFixed(2)}× vs prior week`}
          />
        </div>
        <span className="text-center text-xs tabular-nums text-amber-300">
          {acceleration === null || Number.isNaN(acceleration) ? "—" : `${acceleration.toFixed(1)}×`}
        </span>
      </div>
    </div>
  );
}

function TrendDiscoveryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<TabId>("pending");

  useEffect(() => {
    const q = searchParams.get("tab");
    if (q && TAB_IDS.has(q as TabId)) {
      setTabState(q as TabId);
    }
  }, [searchParams]);

  function setTab(next: TabId) {
    setTabState(next);
    router.replace(`/admin?tab=${next}`, { scroll: false });
  }

  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [topicDetail, setTopicDetail] = useState<TopicDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const selectedTopicIdRef = useRef<number | null>(null);
  selectedTopicIdRef.current = selectedTopicId;

  const statusParam = tab === "pending" ? "pending" : "selected";

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics?status=${statusParam}`);
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        setTopics([]);
        return;
      }
      const data = (await res.json()) as TopicRow[];
      setTopics(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [statusParam]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    setSelectedIds(new Set());
    setMergeOpen(false);
    setSelectedTopicId(null);
    setTopicDetail(null);
  }, [tab]);

  useEffect(() => {
    if (selectedTopicId === null) {
      setTopicDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/admin/topics/${selectedTopicId}`);
        if (cancelled) return;
        if (!res.ok) {
          setDetailError("Could not load topic detail.");
          setTopicDetail(null);
          return;
        }
        const data = (await res.json()) as TopicDetailResponse;
        if (!cancelled) setTopicDetail(data);
      } catch {
        if (!cancelled) {
          setDetailError("Could not load topic detail.");
          setTopicDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedTopicId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedTopicId === null) {
      setDrawerEntered(false);
      return;
    }
    setDrawerEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [selectedTopicId]);

  const checkedTopics = useMemo(() => {
    return topics.filter((t) => selectedIds.has(t.id));
  }, [topics, selectedIds]);

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllPending(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(topics.map((t) => t.id)));
  }

  async function approveTopic(id: number) {
    setApprovingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setSelectedTopicId((cur) => (cur === id ? null : cur));
      await loadTopics();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApprovingId(null);
    }
  }

  async function analyzeTopicTrend(id: number) {
    setAnalyzingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/trend-analysis`, {
        method: "POST",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        setError(t);
        return;
      }
      await loadTopics();
      if (selectedTopicIdRef.current === id) {
        const detailRes = await adminFetch(`${API_BASE}/api/admin/topics/${id}`);
        if (detailRes.ok) {
          setTopicDetail((await detailRes.json()) as TopicDetailResponse);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function runBulkTrendAnalysis() {
    setBulkAnalyzing(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/jobs/trend-analysis`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      await new Promise((r) => setTimeout(r, 6000));
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk analysis failed");
    } finally {
      setBulkAnalyzing(false);
    }
  }

  async function submitMerge() {
    if (mergeTargetId === null || checkedTopics.length < 2) return;
    const source_topic_ids = checkedTopics.map((t) => t.id).filter((id) => id !== mergeTargetId);
    if (source_topic_ids.length === 0) {
      setError("Choose a target that is not the only selected topic.");
      return;
    }
    setMerging(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/merge`, {
        method: "POST",
        body: JSON.stringify({ source_topic_ids, target_topic_id: mergeTargetId }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setMergeOpen(false);
      setSelectedIds(new Set());
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  function openMergeModal() {
    const first = checkedTopics[0];
    setMergeTargetId(first?.id ?? null);
    setMergeOpen(true);
  }

  const allPendingSelected =
    tab === "pending" && topics.length > 0 && topics.every((t) => selectedIds.has(t.id));

  const selectedRow = useMemo(
    () => (selectedTopicId === null ? undefined : topics.find((t) => t.id === selectedTopicId)),
    [topics, selectedTopicId],
  );

  const sortedDrawerArticles = useMemo(() => {
    const list = topicDetail?.articles ?? [];
    return [...list].sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });
  }, [topicDetail?.articles]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Trend Discovery</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          Velocity = articles linked to this topic in the last 7 days; acceleration = ratio vs the prior 7 days.
          Use <span className="text-gray-300">AI analyze</span> to run Claude on each topic for suggested adoption state
          and rationale (or run the bulk job below). Approve to move topics into the analysis pipeline.
        </p>
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-gray-800 pb-4">
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/80 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            onClick={() => setTab("pending")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "pending" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "approved"}
            onClick={() => setTab("approved")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "approved" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            Approved
          </button>
        </div>

        {tab === "pending" && checkedTopics.length >= 2 && (
          <button
            type="button"
            onClick={openMergeModal}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Merge selected ({checkedTopics.length})
          </button>
        )}

        {tab === "pending" && topics.length > 0 && (
          <button
            type="button"
            disabled={bulkAnalyzing}
            onClick={() => void runBulkTrendAnalysis()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkAnalyzing ? (
              <>
                <Spinner className="h-4 w-4" />
                Starting bulk AI…
              </>
            ) : (
              "Run AI analysis (all pending)"
            )}
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">Loading topics…</p>
      ) : tab === "pending" ? (
        topics.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No pending topics. New clusters will appear here after signal ingestion.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500/40"
                      checked={allPendingSelected}
                      onChange={(e) => toggleAllPending(e.target.checked)}
                      title="Select all"
                    />
                  </th>
                  <th className="px-3 py-3">Domain</th>
                  <th className="px-3 py-3">Topic</th>
                  <th className="px-3 py-3">Velocity</th>
                  <th className="px-3 py-3">Acceleration</th>
                  <th className="px-3 py-3">Articles</th>
                  <th className="px-3 py-3">Suggested State</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {topics.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setSelectedTopicId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedTopicId(row.id);
                      }
                    }}
                    className={`cursor-pointer border-l-2 transition-colors hover:bg-gray-900/40 ${
                      selectedTopicId === row.id
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-transparent"
                    }`}
                  >
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500/40"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => toggleRow(row.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <DomainPill domain={row.domain} />
                    </td>
                    <td className="max-w-xs px-3 py-3 align-top">
                      <p className="font-semibold text-white">{row.name}</p>
                      {row.signal_rationale?.trim() ? (
                        <p className="mt-1 line-clamp-2 text-xs italic text-gray-400">{row.signal_rationale}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                      {fmtOneDecimal(row.velocity_score)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                      {row.acceleration_score === null || Number.isNaN(row.acceleration_score)
                        ? "—"
                        : `${row.acceleration_score.toFixed(1)}x`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">{row.article_count}</td>
                    <td className="px-3 py-3 align-top">
                      {row.signal_suggested_state?.trim() ? (
                        <span className="inline-flex rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-200 ring-1 ring-gray-700">
                          {row.signal_suggested_state}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={analyzingId === row.id || approvingId === row.id}
                          onClick={() => void analyzeTopicTrend(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {analyzingId === row.id ? (
                            <>
                              <Spinner className="h-3.5 w-3.5" />
                              AI…
                            </>
                          ) : (
                            "AI analyze"
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={approvingId === row.id || analyzingId === row.id}
                          onClick={() => void approveTopic(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {approvingId === row.id ? (
                            <>
                              <Spinner className="h-3.5 w-3.5" />
                              <span>Approving…</span>
                            </>
                          ) : (
                            "Approve"
                          )}
                        </button>
                        <Link
                          href={`/admin/topics/${row.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          <IconPencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : topics.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No approved topics yet. Approve items from the Pending tab to see them here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3">Domain</th>
                <th className="px-3 py-3">Topic</th>
                <th className="px-3 py-3">Urgency</th>
                <th className="px-3 py-3">Articles</th>
                <th className="px-3 py-3">Adoption State</th>
                <th className="px-3 py-3">Published</th>
                <th className="px-3 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {topics.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => setSelectedTopicId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTopicId(row.id);
                    }
                  }}
                  className={`cursor-pointer border-l-2 transition-colors hover:bg-gray-900/40 ${
                    selectedTopicId === row.id ? "border-indigo-500 bg-indigo-500/5" : "border-transparent"
                  }`}
                >
                  <td className="px-3 py-3 align-top">
                    <DomainPill domain={row.domain} />
                  </td>
                  <td className="max-w-md px-3 py-3 align-top">
                    <p className="font-semibold text-white">{row.name}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                    {row.urgency_score.toFixed(1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">{row.article_count}</td>
                  <td className="px-3 py-3 align-top text-gray-300">{row.adoption_state}</td>
                  <td className="px-3 py-3 align-top">
                    {row.is_published ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-gray-700">
                        No
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/admin/topics/${row.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      <IconPencil className="h-4 w-4" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTopicId !== null && (
        <div className="fixed inset-0 z-[45] flex justify-end" role="presentation">
          <button
            type="button"
            className="h-full min-h-0 flex-1 cursor-default bg-black/50"
            aria-label="Close detail panel"
            onClick={() => setSelectedTopicId(null)}
          />
          <aside
            className={`flex h-full w-full max-w-full shrink-0 flex-col border-l border-gray-800 bg-gray-950 shadow-2xl transition-transform duration-300 ease-out sm:w-[400px] sm:max-w-[400px] ${
              drawerEntered ? "translate-x-0" : "translate-x-full"
            }`}
            aria-labelledby="drawer-topic-title"
          >
            <div className="flex items-start justify-between gap-2 border-b border-gray-800 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="drawer-topic-title" className="text-lg font-semibold leading-tight text-white">
                  {selectedRow?.name ?? topicDetail?.name ?? "Topic"}
                </h2>
                {(selectedRow ?? topicDetail) && (
                  <div className="mt-2">
                    <DomainPill domain={(selectedRow ?? topicDetail)!.domain} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopicId(null)}
                className="shrink-0 rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {detailLoading && <p className="text-sm text-gray-500">Loading details…</p>}
              {detailError && !detailLoading && (
                <p className="text-sm text-red-400" role="alert">
                  {detailError}
                </p>
              )}

              {selectedRow && (
                <>
                  <VelocityMini
                    velocity={selectedRow.velocity_score}
                    acceleration={selectedRow.acceleration_score}
                  />
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signal rationale</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                      {selectedRow.signal_rationale?.trim() ||
                        "No AI rationale yet. Use “AI analyze” in the table to generate one."}
                    </p>
                  </div>
                  {selectedRow.signal_suggested_state?.trim() ? (
                    <p className="mt-3 text-xs text-gray-500">
                      Suggested state:{" "}
                      <span className="text-gray-300">{selectedRow.signal_suggested_state}</span>
                    </p>
                  ) : null}
                </>
              )}

              <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Supporting articles
              </h3>
              {!detailLoading && !detailError && sortedDrawerArticles.length === 0 ? (
                <p className="text-sm text-gray-500">No articles linked to this topic.</p>
              ) : (
                <ul className="space-y-3">
                  {sortedDrawerArticles.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        {a.title}
                      </a>
                      <p className="mt-1 text-xs text-gray-500">
                        {articleSourceLabel(a)} · {fmtPublished(a.published_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedRow?.status === "pending" && (
              <div className="border-t border-gray-800 px-4 py-3">
                <button
                  type="button"
                  disabled={approvingId === selectedTopicId}
                  onClick={() => selectedTopicId !== null && void approveTopic(selectedTopicId)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approvingId === selectedTopicId ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Approving…
                    </>
                  ) : (
                    "Approve"
                  )}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Merge topics</h2>
            <p className="mt-1 text-sm text-gray-400">Select the topic to keep. Other selected topics will be merged into it.</p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Target topic
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={mergeTargetId ?? ""}
              onChange={(e) => setMergeTargetId(Number(e.target.value))}
            >
              {checkedTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={merging || mergeTargetId === null}
                onClick={() => void submitMerge()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {merging ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Merging…
                  </>
                ) : (
                  "Merge"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendDiscoveryFallback() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-gray-500">Loading topics…</div>
  );
}

export default function TrendDiscoveryPage() {
  return (
    <Suspense fallback={<TrendDiscoveryFallback />}>
      <TrendDiscoveryInner />
    </Suspense>
  );
}

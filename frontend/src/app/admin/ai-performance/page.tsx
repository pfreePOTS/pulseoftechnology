"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { adminFetch, adminResponseErrorDetail, API_BASE } from "@/lib/api";

interface Summary {
  total_runs: number;
  success_rate: number;
  avg_latency_ms: number | null;
  total_tokens: number;
  primary_model?: string | null;
}

interface ByAgentRow {
  agent_name: string;
  total_runs: number;
  success_rate: number;
  fallback_count: number;
  avg_latency_ms: number | null;
  avg_tokens: number | null;
  primary_model?: string | null;
}

interface RunRow {
  id: number;
  agent_name: string;
  created_at: string;
  article_id: number | null;
  article_title: string | null;
  status: string;
  latency_ms: number | null;
  tokens: number | null;
  model: string | null;
  failure_detail: string | null;
  context_excerpt: string | null;
}

interface RunDetailPayload {
  id: number;
  agent_name: string;
  created_at: string;
  article_id: number | null;
  article_title: string | null;
  status: string;
  latency_ms: number | null;
  tokens: number | null;
  model: string | null;
  failure_detail: string | null;
  context_text: string | null;
}

interface RunListResponse {
  items: RunRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_LIMIT = 100;

const AGENT_RING_PALETTE = [
  "bg-violet-500/20 text-violet-400 ring-violet-500/30",
  "bg-rose-500/20 text-rose-400 ring-rose-500/30",
  "bg-sky-500/20 text-sky-400 ring-sky-500/30",
  "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
  "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  "bg-amber-500/20 text-amber-400 ring-amber-500/30",
  "bg-cyan-500/20 text-cyan-400 ring-cyan-500/30",
  "bg-fuchsia-500/20 text-fuchsia-400 ring-fuchsia-500/30",
];

function agentPillClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 1000;
  }
  return AGENT_RING_PALETTE[h % AGENT_RING_PALETTE.length] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
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

function RunStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "success") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        success
      </span>
    );
  }
  if (s === "fallback") {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        fallback
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="inline-flex rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-300">
      {status}
    </span>
  );
}

function truncateTitle(title: string | null, max = 56): string {
  if (!title) return "—";
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Bar + label color: green if &gt;95%, amber if 80–95%, red if &lt;80%. */
function successRateTier(pct: number): { bar: string; text: string } {
  if (pct > 95) return { bar: "bg-emerald-500", text: "text-emerald-400" };
  if (pct >= 80) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-400" };
}

function MiniSuccessRateBar({
  pct,
  compact = false,
  hideTrailingPercent = false,
}: {
  pct: number;
  compact?: boolean;
  /** When false, bar still shows tier color; omit the small % when a headline % is above. */
  hideTrailingPercent?: boolean;
}) {
  const tier = successRateTier(pct);
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "mt-2"}`}>
      <div
        className={`min-w-0 flex-1 overflow-hidden rounded-full bg-gray-800 ${compact ? "h-1" : "h-1.5"}`}
      >
        <div
          className={`h-full rounded-full transition-[width] ${tier.bar}`}
          style={{ width: `${w}%` }}
        />
      </div>
      {!hideTrailingPercent ? (
        <span className={`shrink-0 text-xs tabular-nums ${tier.text}`}>
          {pct.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}

type BreakdownWindow = 1 | 7 | 30;
type LogStatusFilter = "all" | "success" | "fallback" | "failed";

export default function AiPerformancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const summaryRef = useRef<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  /** Set when we have no summary yet (initial load / hard failure). */
  const [summaryBlockError, setSummaryBlockError] = useState<string | null>(null);
  /** Set when polling fails but we still show the last good summary. */
  const [summaryRefreshWarning, setSummaryRefreshWarning] = useState<string | null>(null);
  const [byAgent, setByAgent] = useState<ByAgentRow[]>([]);
  const [byAgentLoading, setByAgentLoading] = useState(true);
  const [breakdownDays, setBreakdownDays] = useState<BreakdownWindow>(7);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsLoadingMore, setRunsLoadingMore] = useState(false);
  const [logAgent, setLogAgent] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<LogStatusFilter>("all");

  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [detailPayload, setDetailPayload] = useState<RunDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    if (detailRunId === null) {
      setDetailPayload(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await adminFetch(
          `${API_BASE}/api/admin/agent-runs/${detailRunId}`,
        );
        if (!res.ok) {
          const detail = await adminResponseErrorDetail(res);
          if (!cancelled) {
            setDetailPayload(null);
            setDetailError(detail || `HTTP ${res.status}`);
          }
          return;
        }
        const data = (await res.json()) as RunDetailPayload;
        if (!cancelled) {
          setDetailPayload(data);
        }
      } catch (e) {
        if (!cancelled) {
          setDetailPayload(null);
          setDetailError(e instanceof Error ? e.message : "Network error");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [detailRunId]);

  useEffect(() => {
    if (detailRunId === null) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setDetailRunId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRunId]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/agent-runs/summary`);
      if (!res.ok) {
        const detail = await adminResponseErrorDetail(res);
        const msg =
          res.status === 403
            ? "You need the AI Performance permission (or superuser) to load agent telemetry."
            : detail;
        if (summaryRef.current === null) {
          setSummaryBlockError(msg);
        } else {
          setSummaryRefreshWarning(`Could not refresh summary: ${msg}`);
        }
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
      setSummaryBlockError(null);
      setSummaryRefreshWarning(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      if (summaryRef.current === null) {
        setSummaryBlockError(msg);
      } else {
        setSummaryRefreshWarning(`Could not refresh summary: ${msg}`);
      }
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchByAgent = useCallback(async () => {
    setByAgentLoading(true);
    try {
      const params = new URLSearchParams({ days: String(breakdownDays) });
      const res = await adminFetch(
        `${API_BASE}/api/admin/agent-runs/by-agent?${params.toString()}`,
      );
      if (!res.ok) {
        setByAgent([]);
        return;
      }
      const data = (await res.json()) as ByAgentRow[];
      setByAgent(data);
    } catch {
      setByAgent([]);
    } finally {
      setByAgentLoading(false);
    }
  }, [breakdownDays]);

  const fetchRuns = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });
      if (logAgent) params.set("agent", logAgent);
      if (logStatus !== "all") params.set("status", logStatus);

      const res = await adminFetch(
        `${API_BASE}/api/admin/agent-runs?${params.toString()}`,
      );
      if (!res.ok) {
        if (!append) {
          setRuns([]);
          setRunsTotal(0);
        }
        return;
      }
      const data = (await res.json()) as RunListResponse;
      setRunsTotal(data.total);
      setRuns((prev) => (append ? [...prev, ...data.items] : data.items));
    },
    [logAgent, logStatus],
  );

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const id = setInterval(() => void fetchSummary(), 30_000);
    return () => clearInterval(id);
  }, [fetchSummary]);

  useEffect(() => {
    void fetchByAgent();
  }, [fetchByAgent]);

  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    void (async () => {
      await fetchRuns(0, false);
      if (!cancelled) setRunsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRuns]);

  async function loadMoreRuns() {
    setRunsLoadingMore(true);
    await fetchRuns(runs.length, true);
    setRunsLoadingMore(false);
  }

  const showLoadMore =
    !runsLoading && runs.length > 0 && runs.length < runsTotal;

  const agentButtons = [
    null,
    ...byAgent.map((r) => r.agent_name).filter((n, i, a) => a.indexOf(n) === i),
  ].slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          AI Performance
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Agent telemetry for the last 24 hours (summary auto-refreshes every 30s).{" "}
          <span className="text-gray-500">
            <strong className="font-medium text-gray-400">Model</strong> is the provider id stored on each run
            (DeepSeek or Claude after fallback)—also the most common id in the breakdown window.
          </span>
        </p>
      </div>

      {/* Summary cards */}
      {summaryRefreshWarning ? (
        <div
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          {summaryRefreshWarning}
        </div>
      ) : null}

      {summaryLoading ? (
        <div className="mb-10 flex items-center gap-3 text-gray-400">
          <span
            className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
            aria-hidden
          />
          <span>Loading summary…</span>
        </div>
      ) : summary ? (
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total runs
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {summary.total_runs}
            </p>
            <p className="mt-1 text-xs text-gray-500">Last 24 hours</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Success rate
            </p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${successRateTier(summary.success_rate).text}`}
            >
              {summary.success_rate.toFixed(1)}%
            </p>
            <MiniSuccessRateBar pct={summary.success_rate} hideTrailingPercent />
            <p className="mt-2 text-xs text-gray-500">Strict JSON path · last 24h</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Avg latency
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {summary.avg_latency_ms != null
                ? `${Math.round(summary.avg_latency_ms)} ms`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">Where recorded</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Token spend
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {summary.total_tokens.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">Sum where recorded</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Top model (24h)
            </p>
            <p
              className="mt-2 break-all font-mono text-base font-semibold leading-snug text-indigo-200"
              title="Most frequent model id on recorded runs in the last 24 hours"
            >
              {summary.primary_model?.trim() ? summary.primary_model : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">Recorded on AgentRun rows</p>
          </div>
        </div>
      ) : summaryBlockError ? (
        <div
          className="mb-10 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <p className="font-semibold text-red-100">Could not load summary</p>
          <p className="mt-2 whitespace-pre-wrap">{summaryBlockError}</p>
          <p className="mt-2 text-xs text-red-300/90">
            Check that <code className="text-red-100/90">NEXT_PUBLIC_API_URL</code> is the API origin only
            (e.g. <code className="text-red-100/90">http://localhost:8100</code>, not <code className="text-red-100/90">…/api</code>
            ), the backend is running, and your account has the AI Performance role.
          </p>
        </div>
      ) : (
        <p className="mb-10 text-sm text-gray-500">Summary unavailable.</p>
      )}

      {/* Agent breakdown */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Per-agent breakdown</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">
          Fallback means the model output did not parse as strict JSON, so safe defaults ran.
          Rows recorded before detail fields were added may show fallback without an issue message.{" "}
          <strong className="font-medium text-gray-400">Primary model</strong> is the most common provider id
          recorded for that agent in the selected window (when runs store a model).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              [1, "24h"],
              [7, "7d"],
              [30, "30d"],
            ] as const
          ).map(([d, label]) => (
            <button
              key={d}
              type="button"
              onClick={() => setBreakdownDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                breakdownDays === d
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {byAgentLoading ? (
        <div className="mb-10 flex items-center gap-3 text-gray-400">
          <span
            className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
            aria-hidden
          />
          <span>Loading breakdown…</span>
        </div>
      ) : byAgent.length === 0 ? (
        <p className="mb-10 text-sm text-gray-500">No agent runs in this window.</p>
      ) : (
        <div className="mb-10 overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-300">Agent</th>
                <th className="px-4 py-3 font-medium text-gray-300">Primary model</th>
                <th className="px-4 py-3 font-medium text-gray-300">Runs</th>
                <th className="px-4 py-3 font-medium text-gray-300">Success %</th>
                <th className="px-4 py-3 font-medium text-gray-300">Fallbacks</th>
                <th className="px-4 py-3 font-medium text-gray-300">Avg latency</th>
                <th className="px-4 py-3 font-medium text-gray-300">Avg tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {byAgent.map((row) => (
                <tr key={row.agent_name}>
                  <td className="px-4 py-3">
                    <AgentPill name={row.agent_name} />
                  </td>
                  <td className="max-w-[200px] px-4 py-3 align-top font-mono text-xs text-indigo-200/95">
                    {row.primary_model?.trim() ? (
                      <span className="break-all" title={row.primary_model}>
                        {row.primary_model}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-300">
                    {row.total_runs}
                  </td>
                  <td className="min-w-[120px] max-w-[180px] px-4 py-3">
                    <MiniSuccessRateBar pct={row.success_rate} compact />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-amber-400/90">
                    {row.fallback_count}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-400">
                    {row.avg_latency_ms != null
                      ? `${Math.round(row.avg_latency_ms)} ms`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-400">
                    {row.avg_tokens != null
                      ? Math.round(row.avg_tokens).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run log */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Run log</h2>
        <p className="mt-1 text-sm text-gray-500">
          Parsed outputs and fallbacks (newest first). Filters apply to the full history. Use Full
          output to open the saved model text when present (especially for fallback runs).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase text-gray-500">Agent</span>
          <div className="flex flex-wrap gap-2">
            {agentButtons.map((name) => (
              <button
                key={name ?? "all"}
                type="button"
                onClick={() => setLogAgent(name)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  logAgent === name
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {name ?? "All"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase text-gray-500">Status</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["success", "Success"],
                ["fallback", "Fallback"],
                ["failed", "Failed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLogStatus(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  logStatus === value
                    ? "bg-cyan-700 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {runsLoading ? (
        <div className="flex items-center gap-3 text-gray-400">
          <span
            className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
            aria-hidden
          />
          <span>Loading runs…</span>
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-gray-500">No runs match these filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-300">Timestamp</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Agent</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Article</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Issue</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Latency</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Tokens</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Model</th>
                  <th className="px-4 py-3 font-medium text-gray-300"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {runs.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <AgentPill name={row.agent_name} />
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-gray-300">
                      {truncateTitle(row.article_title)}
                    </td>
                    <td className="px-4 py-3">
                      <RunStatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[min(280px,32vw)] px-4 py-3 align-top">
                      <p className="break-words text-xs text-gray-400">
                        {row.failure_detail ?? "—"}
                      </p>
                      {row.context_excerpt ? (
                        <pre className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-gray-500">
                          {row.context_excerpt}
                        </pre>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-400">
                      {row.latency_ms != null ? `${row.latency_ms} ms` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-400">
                      {row.tokens != null ? row.tokens.toLocaleString() : "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-gray-500">
                      {row.model ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailRunId(row.id)}
                        className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-200 hover:border-gray-600 hover:bg-gray-700"
                      >
                        Full output
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showLoadMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMoreRuns()}
                disabled={runsLoadingMore}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {runsLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}

      {detailRunId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/65"
            onClick={() => setDetailRunId(null)}
          />
          <div
            className="relative z-[1] flex max-h-[min(560px,85vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-run-detail-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 px-5 py-4">
              <div className="min-w-0">
                <p
                  id="agent-run-detail-title"
                  className="truncate text-lg font-semibold text-white"
                >
                  Run #{detailRunId}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Saved model response (truncated server-side when stored). Inspect JSON shape and stray
                  text when debugging fallbacks.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800"
                onClick={() => setDetailRunId(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : detailError ? (
                <p className="break-words text-sm text-red-300">{detailError}</p>
              ) : detailPayload ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-md bg-gray-800 px-2 py-1 font-mono text-gray-300">
                      {detailPayload.agent_name}
                    </span>
                    {detailPayload.model?.trim() ? (
                      <span
                        className="rounded-md bg-indigo-950/80 px-2 py-1 font-mono text-indigo-200"
                        title="Provider model id for this run"
                      >
                        {detailPayload.model}
                      </span>
                    ) : null}
                    <span>{new Date(detailPayload.created_at).toLocaleString()}</span>
                    {truncateTitle(detailPayload.article_title) !== "—" ? (
                      <span className="max-w-[18rem] truncate">
                        Article: {detailPayload.article_title}
                      </span>
                    ) : null}
                  </div>
                  {detailPayload.failure_detail ? (
                    <div className="rounded-lg border border-amber-600/35 bg-amber-500/10 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-400/95">
                        Parse / failure detail
                      </p>
                      <p className="mt-1 break-words text-sm text-amber-100">
                        {detailPayload.failure_detail}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Raw output
                    </p>
                    <pre className="mt-2 max-h-[min(320px,40vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-gray-300">
                      {detailPayload.context_text ??
                        "(No raw text stored for this run — often older telemetry or success path.)"}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

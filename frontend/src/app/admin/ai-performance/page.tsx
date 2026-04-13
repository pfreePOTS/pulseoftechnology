"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Summary {
  total_runs: number;
  success_rate: number;
  avg_latency_ms: number | null;
  total_tokens: number;
}

interface ByAgentRow {
  agent_name: string;
  total_runs: number;
  success_rate: number;
  fallback_count: number;
  avg_latency_ms: number | null;
  avg_tokens: number | null;
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
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [byAgent, setByAgent] = useState<ByAgentRow[]>([]);
  const [byAgentLoading, setByAgentLoading] = useState(true);
  const [breakdownDays, setBreakdownDays] = useState<BreakdownWindow>(7);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsLoadingMore, setRunsLoadingMore] = useState(false);
  const [logAgent, setLogAgent] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<LogStatusFilter>("all");

  const fetchSummary = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/agent-runs/summary`);
      if (!res.ok) {
        setSummary(null);
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
    } catch {
      setSummary(null);
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
          Agent telemetry for the last 24 hours (summary auto-refreshes every 30s).
        </p>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="mb-10 flex items-center gap-3 text-gray-400">
          <span
            className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
            aria-hidden
          />
          <span>Loading summary…</span>
        </div>
      ) : summary ? (
        <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        </div>
      ) : (
        <p className="mb-10 text-sm text-gray-500">Summary unavailable.</p>
      )}

      {/* Agent breakdown */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Per-agent breakdown</h2>
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-300">Agent</th>
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
          Parsed outputs and fallbacks (newest first). Filters apply to the full history.
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-300">Timestamp</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Agent</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Article</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Latency</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Tokens</th>
                  <th className="px-4 py-3 font-medium text-gray-300">Model</th>
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
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-400">
                      {row.latency_ms != null ? `${row.latency_ms} ms` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-400">
                      {row.tokens != null ? row.tokens.toLocaleString() : "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-gray-500">
                      {row.model ?? "—"}
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
    </div>
  );
}

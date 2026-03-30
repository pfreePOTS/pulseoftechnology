"use client";

import { useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Signal {
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

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [acting, setActing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  async function fetchSignals(status: string) {
    setLoading(true);
    const r = await adminFetch(`${API_BASE}/api/admin/signals?status=${status}`);
    if (r.ok) setSignals(await r.json());
    setLoading(false);
  }

  useEffect(() => { fetchSignals(tab); }, [tab]);

  async function handleApprove(id: number) {
    setActing(id);
    await adminFetch(`${API_BASE}/api/admin/signals/${id}/approve`, {
      method: "POST",
    });
    setActing(null);
    await fetchSignals(tab);
  }

  async function handleReject(id: number) {
    setActing(id);
    await adminFetch(`${API_BASE}/api/admin/signals/${id}/reject`, {
      method: "POST",
    });
    setActing(null);
    await fetchSignals(tab);
  }

  async function handleRunScorer() {
    setRunning(true);
    await adminFetch(`${API_BASE}/api/admin/jobs/signals`, {
      method: "POST",
    });
    // Give the background job a moment then reload
    setTimeout(async () => {
      await fetchSignals(tab);
      setRunning(false);
    }, 3000);
  }

  return (
    <div className="px-6 pt-8 pb-12 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Signal Intelligence</h1>
          <p className="mt-1 text-sm text-gray-400">
            AI-generated recommendations to upgrade topic adoption states based on article velocity.
          </p>
        </div>
        <button
          onClick={handleRunScorer}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-indigo-600/20 px-4 py-2 text-sm font-semibold text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50"
        >
          {running ? (
            <><span className="h-3.5 w-3.5 animate-spin rounded-full border border-indigo-400 border-t-transparent" /> Scoring…</>
          ) : "▶ Run Signal Scorer"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-base font-medium text-gray-400">No {tab} signals</p>
          <p className="mt-1 text-sm text-gray-600">
            {tab === "pending"
              ? "Run the scorer above, or wait for the daily 06:00 UTC job."
              : `No signals have been ${tab} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((sig) => (
            <div
              key={sig.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
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

                  {/* State change arrow */}
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <span className="rounded bg-gray-800 px-2 py-1 text-xs font-medium text-gray-400">
                      {sig.current_state}
                    </span>
                    <span className="text-indigo-400">→</span>
                    <span className="rounded bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                      {sig.suggested_state}
                    </span>
                  </div>

                  {/* Velocity metrics */}
                  <div className="mb-3 flex gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-gray-300">{sig.velocity_score}</span>
                      {" "}articles last 7 days
                    </span>
                    <span>·</span>
                    <span>
                      <span className="font-semibold text-gray-300">{sig.acceleration_score.toFixed(1)}×</span>
                      {" "}acceleration vs prior week
                    </span>
                  </div>

                  {/* Rationale */}
                  <p className="text-sm leading-relaxed text-gray-400">{sig.rationale}</p>
                </div>

                {/* Action buttons — only for pending */}
                {tab === "pending" && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => handleApprove(sig.id)}
                      disabled={acting === sig.id}
                      className="rounded-lg bg-green-600/20 px-4 py-2 text-xs font-semibold text-green-400 ring-1 ring-green-500/30 hover:bg-green-600/30 disabled:opacity-50"
                    >
                      {acting === sig.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(sig.id)}
                      disabled={acting === sig.id}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-gray-600">
                Generated {new Date(sig.created_at).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface TopicRow {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, unknown> | null;
  article_count: number;
  is_published: boolean;
}

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

function domainPillClass(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "bg-slate-500/20 text-slate-400";
}

function industryCount(topic: TopicRow): number {
  return Object.keys(topic.industry_positions ?? {}).length;
}

function ButtonSpinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function TopicRowCard({
  topic,
  actionLabel,
  actionClassName,
  pending,
  onAction,
}: {
  topic: TopicRow;
  actionLabel: string;
  actionClassName: string;
  pending: boolean;
  onAction: () => void;
}) {
  const industries = industryCount(topic);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${domainPillClass(topic.domain)}`}
        >
          {topic.domain}
        </span>
        <span className="min-w-0 font-medium text-white">{topic.name}</span>
        {topic.is_published && (
          <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Live
          </span>
        )}
        <span
          className="inline-flex shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs tabular-nums text-amber-300"
          title="Urgency"
        >
          {topic.urgency_score.toFixed(1)}
        </span>
        <span className="text-xs text-gray-500">
          {topic.article_count} {topic.article_count === 1 ? "article" : "articles"}
        </span>
        <span className="text-xs text-gray-500">
          {industries} {industries === 1 ? "industry" : "industries"}
        </span>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={pending}
        className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${actionClassName}`}
      >
        {pending ? <ButtonSpinner /> : null}
        {pending ? "Working…" : actionLabel}
      </button>
    </li>
  );
}

export default function WorkbenchSelectionTab() {
  const [watched, setWatched] = useState<TopicRow[]>([]);
  const [selected, setSelected] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: number; action: "select" | "deselect" } | null>(null);

  const loadBoth = useCallback(async () => {
    setError(null);
    const [wRes, sRes] = await Promise.all([
      adminFetch(`${API_BASE}/api/admin/topics?status=watched`),
      adminFetch(`${API_BASE}/api/admin/topics?status=selected`),
    ]);
    if (!wRes.ok || !sRes.ok) {
      setError("Could not load topics. Try again or check your connection.");
      setWatched([]);
      setSelected([]);
      return false;
    }
    const wJson = (await wRes.json()) as TopicRow[];
    const sJson = (await sRes.json()) as TopicRow[];
    setWatched(wJson);
    setSelected(sJson);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadBoth();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBoth]);

  async function runSelect(id: number) {
    setPending({ id, action: "select" });
    setError(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/topics/${id}/select`, { method: "POST" });
      if (!r.ok) {
        let msg = "Could not select topic.";
        try {
          const body = (await r.json()) as { detail?: unknown };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await loadBoth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Select failed");
    } finally {
      setPending(null);
    }
  }

  async function runDeselect(id: number) {
    setPending({ id, action: "deselect" });
    setError(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/topics/${id}/deselect`, { method: "POST" });
      if (!r.ok) {
        let msg = "Could not deselect topic.";
        try {
          const body = (await r.json()) as { detail?: unknown };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await loadBoth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deselect failed");
    } finally {
      setPending(null);
    }
  }

  function isPending(id: number, action: "select" | "deselect"): boolean {
    return pending?.id === id && pending.action === action;
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-xl font-semibold text-white">Selection</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          Choose which watched topics enter the radar pipeline. Selected topics are eligible for positioning,
          promotion, and publishing on the public radar.
        </p>
        <p className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <ButtonSpinner />
          Loading topics…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Selection</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        Choose which watched topics enter the radar pipeline. Selected topics are eligible for positioning,
        promotion, and publishing on the public radar.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Selected for Radar</h3>
        {selected.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-500">
            No topics selected yet. Select from watched topics below.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {selected.map((topic) => (
              <TopicRowCard
                key={topic.id}
                topic={topic}
                actionLabel="Deselect"
                actionClassName="bg-amber-600/20 text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-600/30"
                pending={isPending(topic.id, "deselect")}
                onAction={() => runDeselect(topic.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Watched — Candidates</h3>
        {watched.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-500">
            No watched topics. Watch topics in the Research step first.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {watched.map((topic) => (
              <TopicRowCard
                key={topic.id}
                topic={topic}
                actionLabel="Select for Radar"
                actionClassName="bg-gradient-to-r from-indigo-600 to-emerald-600 text-white hover:from-indigo-500 hover:to-emerald-500"
                pending={isPending(topic.id, "select")}
                onAction={() => runSelect(topic.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

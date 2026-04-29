"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RadarSection from "@/components/RadarSection";
import { type RadarTopic } from "@/components/RadarChart";

import { adminFetch, API_BASE } from "@/lib/api";

type PreviewMode = "live" | "pipeline";

type CrossHint =
  | null
  | { kind: "try_pipeline"; count: number }
  | { kind: "try_live"; count: number }
  | { kind: "both_zero" };

export default function RadarPreviewPage() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Default to pipeline so admins see watched/selected topics without publishing first. */
  const [mode, setMode] = useState<PreviewMode>("pipeline");
  const [crossHint, setCrossHint] = useState<CrossHint>(null);

  const load = useCallback(async (m: PreviewMode) => {
    setLoading(true);
    setLoadError(null);
    setCrossHint(null);
    try {
      if (m === "live") {
        // Same payload as the public home page — avoids admin-only failures and guarantees parity.
        const res = await fetch(`${API_BASE}/api/topics/published`, { cache: "no-store" });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          setLoadError(
            detail.trim() || `Could not load published topics (HTTP ${res.status}). Check API and CORS.`,
          );
          setTopics([]);
          return;
        }
        const data: unknown = await res.json();
        setTopics(Array.isArray(data) ? (data as RadarTopic[]) : []);
        return;
      }

      const res = await adminFetch(`${API_BASE}/api/admin/topics?radar_pipeline=true`);
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        setLoadError(
          detail.trim() ||
            `Pipeline topics failed (HTTP ${res.status}). Sign in again if your session expired.`,
        );
        setTopics([]);
        return;
      }
      const data: unknown = await res.json();
      setTopics(Array.isArray(data) ? (data as RadarTopic[]) : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(mode);
  }, [load, mode]);

  /** When the active view is empty but the other view has topics, nudge the curator. */
  useEffect(() => {
    if (loading || loadError || topics.length > 0) {
      setCrossHint(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (mode === "live") {
          const res = await adminFetch(`${API_BASE}/api/admin/topics?radar_pipeline=true`);
          if (cancelled || !res.ok) {
            if (!cancelled && !res.ok) setCrossHint(null);
            return;
          }
          const data: unknown = await res.json();
          const n = Array.isArray(data) ? data.length : 0;
          if (cancelled) return;
          if (n > 0) setCrossHint({ kind: "try_pipeline", count: n });
          else setCrossHint({ kind: "both_zero" });
          return;
        }
        const res = await fetch(`${API_BASE}/api/topics/published`, { cache: "no-store" });
        if (cancelled || !res.ok) {
          if (!cancelled && !res.ok) setCrossHint(null);
          return;
        }
        const data: unknown = await res.json();
        const n = Array.isArray(data) ? data.length : 0;
        if (cancelled) return;
        if (n > 0) setCrossHint({ kind: "try_live", count: n });
        else setCrossHint({ kind: "both_zero" });
      } catch {
        if (!cancelled) setCrossHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, loadError, mode, topics.length]);

  const emptyMessage = loadError
    ? "Unable to load radar data — see the alert above."
    : mode === "live"
      ? "Nothing on the live radar yet — enable “On public radar” on the Publishing page for topics you want visitors to see."
      : "No watched or selected topics yet — move candidates to Watched or Selected in Trend Discovery, then refresh.";

  return (
    <div className="flex min-h-full flex-col -mt-2">
      <div className="pb-2">
        {loadError && (
          <div
            className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            role="alert"
          >
            <strong className="text-amber-50">Could not load radar data.</strong> {loadError}
          </div>
        )}
        <p className="mb-3 rounded-md border border-teal-500/25 bg-[#019E7C]/10 px-3 py-2 text-sm leading-relaxed text-gray-200">
          <strong className="text-white">Live vs pipeline:</strong>{" "}
          <strong className="text-[#019E7C]">Live site</strong> shows the same topics visitors see (published only).{" "}
          <strong className="text-indigo-300">Pipeline staging</strong> shows every watched/selected topic — useful
          before you publish. This is independent of the public radar toggles on the{" "}
          <Link href="/admin/publishing" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Publishing
          </Link>{" "}
          page until you choose <em className="text-gray-300">Live site</em>.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Radar Preview</h1>
          <div
            className="inline-flex rounded-lg border border-gray-700 bg-gray-900/80 p-0.5 text-xs font-medium"
            role="group"
            aria-label="Preview data source"
          >
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mode === "live"
                  ? "bg-[#019E7C] text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Live site (published)
            </button>
            <button
              type="button"
              onClick={() => setMode("pipeline")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mode === "pipeline"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Pipeline staging
            </button>
          </div>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        <p className="text-sm text-gray-400">
          {mode === "live" ? (
            <>
              Matches the public Technology Radar: only topics with <strong className="text-gray-300">On public radar</strong>{" "}
              turned on under{" "}
              <Link href="/admin/publishing" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
                Publishing
              </Link>
              . Same layout and filters as the live page.
            </>
          ) : (
            <>
              All <strong className="text-gray-300">watched</strong> or <strong className="text-gray-300">selected</strong>{" "}
              topics — includes unpublished work. Use this to rehearse the chart before go-live.
            </>
          )}
        </p>

        {!loading && !loadError && topics.length === 0 && crossHint?.kind === "try_pipeline" && (
          <div
            className="mb-3 rounded-md border border-indigo-500/35 bg-indigo-950/40 px-3 py-2 text-sm text-indigo-100"
            role="status"
          >
            <strong className="text-white">{crossHint.count} topic(s)</strong> are in watched/selected but not on the live radar.
            Switch to <strong className="text-white">Pipeline staging</strong> above to preview them, or turn on{" "}
            <strong className="text-white">On public radar</strong> in{" "}
            <Link
              href="/admin/publishing"
              className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300"
            >
              Publishing
            </Link>
            .
          </div>
        )}
        {!loading && !loadError && topics.length === 0 && crossHint?.kind === "try_live" && (
          <div
            className="mb-3 rounded-md border border-[#019E7C]/35 bg-[#019E7C]/10 px-3 py-2 text-sm text-gray-100"
            role="status"
          >
            <strong className="text-white">{crossHint.count} topic(s)</strong> are already published for the live site.
            Switch to <strong className="text-white">Live site (published)</strong> to match what visitors see.
          </div>
        )}
        {!loading && !loadError && topics.length === 0 && crossHint?.kind === "both_zero" && (
          <div
            className="mb-3 rounded-md border border-gray-600/60 bg-gray-900/50 px-3 py-2 text-sm text-gray-300"
            role="status"
          >
            No topics in <strong className="text-gray-200">either</strong> view yet. Promote topics to{" "}
            <strong className="text-gray-200">Watched</strong> or <strong className="text-gray-200">Selected</strong> in Trend
            Discovery, run RSS ingestion and <strong className="text-gray-200">Process raw articles</strong> so stories attach
            to topics, then use the{" "}
            <Link href="/admin/publishing" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
              Publishing
            </Link>{" "}
            page when you are ready for the public radar. Backend logs showing{" "}
            <code className="rounded bg-gray-800 px-1 text-xs">0 articles assigned to topics</code> mean classification did not
            link new stories yet — check <code className="rounded bg-gray-800 px-1 text-xs">DEEPSEEK_API_KEY</code> and topic
            coverage.
          </div>
        )}
      </div>

      <div className="min-h-[min(70vh,560px)] flex-1 overflow-hidden">
        <RadarSection topics={topics} emptyMessage={emptyMessage} layout="compact" />
      </div>
    </div>
  );
}

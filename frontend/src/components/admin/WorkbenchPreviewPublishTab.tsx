"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import NewsletterSandboxPanel from "./NewsletterSandboxPanel";
import { adminFetch, API_BASE } from "@/lib/api";

interface SelectedTopic {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  is_published: boolean;
}

export default function WorkbenchPreviewPublishTab() {
  const [topics, setTopics] = useState<SelectedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await adminFetch(`${API_BASE}/api/admin/topics?status=selected`);
    if (!r.ok) {
      setError("Could not load selected topics");
      setTopics([]);
      setLoading(false);
      return;
    }
    const data = (await r.json()) as SelectedTopic[];
    setTopics(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setPublished(topic: SelectedTopic, publish: boolean) {
    setUpdatingId(topic.id);
    setError(null);
    const path = publish ? "publish" : "unpublish";
    const r = await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}/${path}`, {
      method: "POST",
    });
    if (r.ok) {
      const updated = (await r.json()) as SelectedTopic;
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, ...updated } : t)));
    } else {
      const data = await r.json().catch(() => ({}));
      setError((data as { detail?: string }).detail ?? "Update failed");
    }
    setUpdatingId(null);
  }

  async function publishAll() {
    const unpublished = topics.filter((t) => !t.is_published);
    if (unpublished.length === 0) return;
    setBulkPublishing(true);
    setError(null);
    try {
      for (const topic of unpublished) {
        const r = await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}/publish`, {
          method: "POST",
        });
        if (r.ok) {
          const updated = (await r.json()) as SelectedTopic;
          setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, ...updated } : t)));
        } else {
          const data = await r.json().catch(() => ({}));
          setError((data as { detail?: string }).detail ?? "Publish failed");
          break;
        }
      }
    } finally {
      setBulkPublishing(false);
    }
  }

  const liveCount = topics.filter((t) => t.is_published).length;
  const total = topics.length;
  const hasUnpublished = topics.some((t) => !t.is_published);

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xl font-semibold text-white">Preview & Publish</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          Review how the newsletter reads for each persona, then choose which selected topics go live on the public
          radar.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-7xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Newsletter Preview</h3>
        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <NewsletterSandboxPanel embedded />
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Batch newsletter send:{" "}
          <Link href="/admin/jobs" className="text-gray-400 hover:text-indigo-400">
            System Jobs → Send Daily Newsletter
          </Link>
        </p>
      </div>

      <div className="mx-auto my-10 max-w-5xl border-t border-gray-800" aria-hidden />

      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Radar Publishing</h3>
            <p className="mt-1 text-sm text-gray-500">
              {total === 0 ? "—" : `${liveCount} of ${total} topics live`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={bulkPublishing || !hasUnpublished || loading}
              onClick={() => void publishAll()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {bulkPublishing ? "Publishing…" : "Publish All"}
            </button>
            <Link
              href="/admin/radar-preview"
              className="text-xs text-gray-400 underline-offset-2 hover:text-indigo-400 hover:underline"
            >
              Chart preview
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-gray-500">Loading selected topics…</p>
        ) : topics.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">
            No selected topics. Use the Selection step to choose topics for the radar.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900">
            {topics.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300 ring-1 ring-gray-700">
                    {t.domain}
                  </span>
                  <p className="min-w-0 font-medium text-white">{t.name}</p>
                  <span className="text-xs text-gray-500">urgency {t.urgency_score.toFixed(1)}</span>
                </div>
                <button
                  type="button"
                  disabled={updatingId === t.id || bulkPublishing}
                  onClick={() => void setPublished(t, !t.is_published)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    t.is_published
                      ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-600/30"
                      : "bg-gray-700 text-gray-300 ring-1 ring-gray-600 hover:bg-gray-600"
                  }`}
                >
                  {updatingId === t.id ? "…" : t.is_published ? "Live" : "Off"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface ApprovedTopic {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  is_published: boolean;
}

export default function WorkbenchRadarPublishTab() {
  const [topics, setTopics] = useState<ApprovedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await adminFetch(`${API_BASE}/api/admin/topics?status=selected`);
    if (!r.ok) {
      setError("Could not load topics");
      setTopics([]);
      setLoading(false);
      return;
    }
    const data = (await r.json()) as ApprovedTopic[];
    setTopics(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setPublished(topic: ApprovedTopic, publish: boolean) {
    setUpdatingId(topic.id);
    setError(null);
    const path = publish ? "publish" : "unpublish";
    const r = await adminFetch(`${API_BASE}/api/admin/topics/${topic.id}/${path}`, {
      method: "POST",
    });
    if (r.ok) {
      const updated = (await r.json()) as ApprovedTopic;
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, ...updated } : t)));
    } else {
      const data = await r.json().catch(() => ({}));
      setError((data as { detail?: string }).detail ?? "Update failed");
    }
    setUpdatingId(null);
  }

  const liveCount = topics.filter((t) => t.is_published).length;

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Radar publishing</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        Choose which <strong className="text-gray-300">selected</strong> topics appear on the{" "}
        <Link href="/" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">
          public radar
        </Link>
        . This is separate from the newsletter: subscribers see stories from watched and selected topics; the radar only shows
        topics you mark <strong className="text-gray-300">Live</strong> below.
      </p>
      <p className="mt-2 text-xs text-gray-600">
        Chart preview:{" "}
        <Link href="/admin/radar-preview" className="text-gray-400 hover:text-indigo-400">
          Radar preview
        </Link>
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading selected topics…</p>
      ) : topics.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No selected topics yet. Use the Selection step to choose topics for the radar.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-500">
            {liveCount} live on radar · {topics.length} selected total
          </p>
          <ul className="mt-4 divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900">
            {topics.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.domain} · urgency {t.urgency_score.toFixed(1)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.is_published ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                      Live on radar
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs text-gray-500">
                      Not on radar
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={updatingId === t.id}
                    onClick={() => setPublished(t, !t.is_published)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      t.is_published
                        ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                        : "bg-indigo-600 text-white hover:bg-indigo-500"
                    }`}
                  >
                    {updatingId === t.id
                      ? "…"
                      : t.is_published
                        ? "Remove from radar"
                        : "Publish to radar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

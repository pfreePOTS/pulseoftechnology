"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface RadarTopic {
  id: number;
  name: string;
  domain: string;
  adoption_state: string;
  is_published: boolean;
}

function adoptionPillClass(state: string): string {
  const map: Record<string, string> = {
    "Learn About": "bg-[#019E7C]/20 text-emerald-100 ring-1 ring-[#019E7C]/40",
    "Get Ahead Of": "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/35",
    "Get Prepared For": "bg-yellow-500/15 text-yellow-100 ring-1 ring-yellow-500/40",
    "Get Your Hands Around": "bg-[#E91D24]/20 text-red-100 ring-1 ring-[#E91D24]/40",
    "Make the Most Of": "bg-emerald-700/25 text-emerald-100 ring-1 ring-emerald-500/35",
  };
  return map[state] ?? "bg-gray-800 text-gray-300 ring-1 ring-gray-600";
}

/**
 * Public radar toggles for selected topics. Primary surface: `/admin/publishing`.
 */
export default function RadarPublishingSection() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [radarLoading, setRadarLoading] = useState(true);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<number | null>(null);
  const [publishAllBusy, setPublishAllBusy] = useState(false);

  const loadRadarTopics = useCallback(async () => {
    setRadarError(null);
    setRadarLoading(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics?status=selected`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RadarTopic[];
      setTopics(data);
    } catch {
      setRadarError("Could not load approved topics.");
      setTopics([]);
    } finally {
      setRadarLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRadarTopics();
  }, [loadRadarTopics]);

  async function setPublished(topic: RadarTopic, next: boolean) {
    setToggleBusyId(topic.id);
    try {
      const path = next ? "publish" : "unpublish";
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/${topic.id}/${path}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as RadarTopic;
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, ...updated } : t)),
      );
    } catch {
      setRadarError("Failed to update publish state. Try again.");
    } finally {
      setToggleBusyId(null);
    }
  }

  async function publishAll() {
    const unpublished = topics.filter((t) => !t.is_published);
    if (unpublished.length === 0) return;
    setPublishAllBusy(true);
    setRadarError(null);
    try {
      await Promise.all(
        unpublished.map((t) =>
          adminFetch(`${API_BASE}/api/admin/topics/${t.id}/publish`, {
            method: "POST",
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<RadarTopic>;
          }),
        ),
      );
      await loadRadarTopics();
    } catch {
      setRadarError("Publish all did not complete. Refresh and try again.");
    } finally {
      setPublishAllBusy(false);
    }
  }

  const unpublishedCount = topics.filter((t) => !t.is_published).length;

  return (
    <section
      aria-labelledby="radar-heading"
      className="mx-auto w-full"
      id="radar-publishing"
    >
      <details className="mb-4 rounded-lg border border-gray-700 bg-gray-900/50 text-sm text-gray-300">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium text-white hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-200"
              aria-hidden
            >
              i
            </span>
            What “Radar Publishing” controls (and what it doesn’t)
          </span>
        </summary>
        <div className="space-y-3 border-t border-gray-800 px-4 py-3 leading-relaxed text-gray-400">
          <p>
            <strong className="text-gray-200">On public radar</strong> only changes whether a topic appears on the{" "}
            <strong className="text-gray-200">live marketing site</strong> Technology Radar and in visitor-facing{" "}
            <strong className="text-gray-200">tracked stories</strong>. <strong className="text-gray-200">Hidden</strong>{" "}
            keeps the topic in your internal pipeline (Research / Trending / Analysis) but removes it from what the
            public sees.
          </p>
          <p>
            <strong className="text-gray-200">Radar Preview</strong> (
            <Link
              href="/admin/radar-preview"
              className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300"
            >
              sidebar
            </Link>
            ) shows the chart as either <strong className="text-[#019E7C]">Live site (published)</strong> or{" "}
            <strong className="text-indigo-300">Pipeline staging</strong> (watched/selected).
          </p>
          <p>
            Pipeline <strong className="text-gray-200">test emails</strong> live on the{" "}
            <Link
              href="/admin/newsletter#newsletter-test-send"
              className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300"
            >
              Newsletter
            </Link>{" "}
            page.
          </p>
          <p>
            <strong className="text-gray-200">Scheduled newsletter</strong> uses topics in your on-radar pipeline
            (watched / selected) per scheduler rules. Turning off public publishing{" "}
            <strong className="text-gray-200">does not</strong> by itself remove a topic from email — change pipeline
            status in Research/Trending if a topic should drop out of sends.
          </p>
        </div>
      </details>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="radar-heading" className="text-lg font-semibold text-white">
          Radar Publishing
        </h2>
        <button
          type="button"
          onClick={() => void publishAll()}
          disabled={publishAllBusy || radarLoading || unpublishedCount === 0}
          className="self-start rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 sm:self-auto"
        >
          {publishAllBusy ? "Publishing…" : "Publish All"}
        </button>
      </div>

      {radarError && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {radarError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Topic Name</th>
              <th className="px-4 py-3 font-medium">Adoption State</th>
              <th className="px-4 py-3 font-medium">On public radar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {radarLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Loading approved topics…
                </td>
              </tr>
            ) : topics.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No selected topics. Approve topics in Research first.
                </td>
              </tr>
            ) : (
              topics.map((t) => (
                <tr key={t.id} className="text-gray-200">
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                      {t.domain}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-4 py-3 font-medium text-white">
                    {t.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${adoptionPillClass(t.adoption_state)}`}
                    >
                      {t.adoption_state}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={t.is_published}
                        disabled={toggleBusyId === t.id}
                        onChange={(e) => void setPublished(t, e.target.checked)}
                      />
                      <span
                        className={`relative inline-block h-6 w-11 shrink-0 rounded-full bg-gray-700 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500 ${
                          toggleBusyId === t.id ? "opacity-50" : ""
                        }`}
                      />
                      <span className="text-xs text-gray-500">
                        {toggleBusyId === t.id
                          ? "Saving…"
                          : t.is_published
                            ? "Published"
                            : "Hidden"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

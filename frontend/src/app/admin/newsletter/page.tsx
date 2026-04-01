"use client";

import { useCallback, useEffect, useState } from "react";

import NewsletterSandboxPanel from "@/components/admin/NewsletterSandboxPanel";
import { adminFetch, API_BASE } from "@/lib/api";

interface SurveyStats {
  total: number;
  highly_relevant: number;
  somewhat_relevant: number;
  not_relevant: number;
}

interface RadarTopic {
  id: number;
  name: string;
  domain: string;
  adoption_state: string;
  is_published: boolean;
}

export default function NewsletterPublishingPage() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [radarLoading, setRadarLoading] = useState(true);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<number | null>(null);
  const [publishAllBusy, setPublishAllBusy] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null);
  const [surveyStats, setSurveyStats] = useState<SurveyStats | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(true);

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

  const loadSurveyStats = useCallback(async () => {
    setSurveyLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/newsletter/survey-stats`);
      if (res.ok) setSurveyStats((await res.json()) as SurveyStats);
      else setSurveyStats(null);
    } catch {
      setSurveyStats(null);
    } finally {
      setSurveyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSurveyStats();
  }, [loadSurveyStats]);

  async function setPublished(topic: RadarTopic, next: boolean) {
    setToggleBusyId(topic.id);
    setNewsletterMessage(null);
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
    setNewsletterMessage(null);
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

  async function sendNewsletter() {
    setNewsletterBusy(true);
    setNewsletterMessage(null);
    setRadarError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/jobs/newsletter`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { message?: string };
      setNewsletterMessage(
        body.message ?? "Newsletter job started successfully.",
      );
    } catch {
      setRadarError("Failed to start newsletter job.");
    } finally {
      setNewsletterBusy(false);
    }
  }

  const unpublishedCount = topics.filter((t) => !t.is_published).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Publishing
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Control public radar visibility and preview the newsletter before
          dispatch.
        </p>
      </div>

      <section aria-labelledby="radar-heading" className="mb-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="radar-heading"
            className="text-lg font-semibold text-white"
          >
            Radar Publishing
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void publishAll()}
              disabled={
                publishAllBusy || radarLoading || unpublishedCount === 0
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40"
            >
              {publishAllBusy ? "Publishing…" : "Publish All"}
            </button>
            <button
              type="button"
              onClick={() => void sendNewsletter()}
              disabled={newsletterBusy}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {newsletterBusy ? "Sending…" : "Send Newsletter"}
            </button>
          </div>
        </div>

        {newsletterMessage && (
          <div className="mb-4 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            {newsletterMessage}
          </div>
        )}

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
                    <td className="px-4 py-3 text-gray-400">{t.adoption_state}</td>
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

      <hr className="my-10 border-gray-800" />

      <section aria-labelledby="preview-heading">
        <h2
          id="preview-heading"
          className="mb-4 text-lg font-semibold text-white"
        >
          Newsletter Preview
        </h2>
        <NewsletterSandboxPanel embedded />
      </section>

      <section aria-labelledby="feedback-heading" className="mt-10">
        <h2
          id="feedback-heading"
          className="mb-4 text-lg font-semibold text-white"
        >
          Feedback Summary
        </h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          {surveyLoading ? (
            <p className="text-sm text-gray-500">Loading survey stats…</p>
          ) : surveyStats && surveyStats.total > 0 ? (
            <>
              <p className="text-sm text-gray-300">
                Total responses (last 7 days):{" "}
                <span className="font-semibold text-white">{surveyStats.total}</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>
                  Highly relevant:{" "}
                  <span className="text-emerald-400">
                    {Math.round(
                      (100 * surveyStats.highly_relevant) / surveyStats.total,
                    )}
                    %
                  </span>{" "}
                  ({surveyStats.highly_relevant})
                </li>
                <li>
                  Somewhat relevant:{" "}
                  <span className="text-amber-400/90">
                    {Math.round(
                      (100 * surveyStats.somewhat_relevant) / surveyStats.total,
                    )}
                    %
                  </span>{" "}
                  ({surveyStats.somewhat_relevant})
                </li>
                <li>
                  Not relevant:{" "}
                  <span className="text-rose-400/90">
                    {Math.round(
                      (100 * surveyStats.not_relevant) / surveyStats.total,
                    )}
                    %
                  </span>{" "}
                  ({surveyStats.not_relevant})
                </li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No survey responses in the last 7 days.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

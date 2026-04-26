"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import NewsletterSandboxPanel from "@/components/admin/NewsletterSandboxPanel";
import NewsletterTestSendPanel from "@/components/admin/NewsletterTestSendPanel";
import { adminFetch, API_BASE } from "@/lib/api";

interface SurveyStats {
  campaign?: string;
  total: number;
  average_score?: number | null;
  highly_relevant: number;
  somewhat_relevant: number;
  not_relevant: number;
  responses?: {
    id: string;
    subscriber_email: string;
    score: number;
    newsletter_date: string;
    created_at: string | null;
  }[];
}

export default function NewsletterPage() {
  const [surveyStats, setSurveyStats] = useState<SurveyStats | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(true);

  const loadSurveyStats = useCallback(async () => {
    setSurveyLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/newsletter/feedback`);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Newsletter</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure and test the email digest. Public radar visibility is managed on{" "}
          <Link href="/admin/publishing" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Publishing
          </Link>
          ; the chart preview is on{" "}
          <Link href="/admin/radar-preview" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Radar Preview
          </Link>
          .
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-gray-700/80 bg-gray-900/40 px-4 py-3 text-sm leading-relaxed text-gray-400">
        <strong className="text-gray-200">Newsletter vs “On public radar”:</strong> Scheduled sends and pipeline test
        emails use topics in <strong className="text-gray-300">Watched</strong> or <strong className="text-gray-300">Selected</strong>{" "}
        (Trend Discovery). That list does <strong className="text-gray-200">not</strong> update automatically from
        publishing toggles alone — turning a topic on for the live site does not add it to email unless it is in the
        pipeline. To change what subscribers receive, move topics in/out of Watched or Selected.
      </div>

      <NewsletterTestSendPanel />

      <section aria-labelledby="preview-heading">
        <h2
          id="preview-heading"
          className="text-lg font-semibold text-white"
        >
          Newsletter Preview
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          HTML-only simulation with industry/domain/role filters. Uses the same watched/selected pipeline cohort as the
          scheduled send (domains narrow topics the same way as subscriber preferences).
        </p>
        <NewsletterSandboxPanel embedded />
      </section>

      <section aria-labelledby="feedback-heading" className="mt-10">
        <h2
          id="feedback-heading"
          className="mb-4 text-lg font-semibold text-white"
        >
          Rating System / Feedback
        </h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          {surveyLoading ? (
            <p className="text-sm text-gray-500">Loading survey stats…</p>
          ) : surveyStats && surveyStats.total > 0 ? (
            <>
              <p className="text-sm font-semibold text-gray-200">
                Campaign: {surveyStats.campaign ?? "Pulse of Technology Daily"}
              </p>
              <p className="mt-2 text-sm text-gray-300">
                Total responses:{" "}
                <span className="font-semibold text-white">{surveyStats.total}</span>
                {surveyStats.average_score ? (
                  <>
                    {" "}
                    · Average rating:{" "}
                    <span className="font-semibold text-white">{surveyStats.average_score}/3</span>
                  </>
                ) : null}
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
              {surveyStats.responses && surveyStats.responses.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-lg border border-gray-800">
                  <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead className="bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Subscriber</th>
                        <th className="px-4 py-3 text-left font-semibold">Rating</th>
                        <th className="px-4 py-3 text-left font-semibold">Issue date</th>
                        <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      {surveyStats.responses.slice(0, 25).map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3">{row.subscriber_email}</td>
                          <td className="px-4 py-3">
                            {row.score === 3
                              ? "Highly relevant"
                              : row.score === 2
                                ? "Somewhat relevant"
                                : "Not relevant"}
                          </td>
                          <td className="px-4 py-3">{row.newsletter_date}</td>
                          <td className="px-4 py-3">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No survey responses yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

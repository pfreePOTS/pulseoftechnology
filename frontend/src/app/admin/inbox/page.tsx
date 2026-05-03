"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface RatingResponse {
  id: string;
  subscriber_email: string;
  score: number;
  newsletter_date: string;
  created_at: string | null;
}

interface RatingStats {
  campaign: string;
  question: string;
  scale: Record<string, string>;
  total: number;
  average_score: number | null;
  highly_relevant: number;
  somewhat_relevant: number;
  not_relevant: number;
  responses: RatingResponse[];
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((100 * count) / total) : 0;
}

function ratingLabel(score: number, scale: Record<string, string>): string {
  return scale[String(score)] ?? `Score ${score}`;
}

export default function InboxPage() {
  const [ratings, setRatings] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRatings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/inbox/ratings`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const detail =
          payload && typeof payload === "object" && payload !== null && "detail" in payload
            ? (payload as { detail?: unknown }).detail
            : undefined;
        const msg =
          typeof detail === "string"
            ? detail
            : detail !== undefined
              ? JSON.stringify(detail)
              : `Could not load rating responses (${res.status}).`;
        throw new Error(msg);
      }
      setRatings(payload as RatingStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rating responses.");
      setRatings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const total = ratings?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Inbox</h1>
        <p className="mt-1 text-sm text-gray-400">
          Central inbox for subscriber signals: newsletter ratings now, free-form feedback later.
        </p>
      </div>

      <section aria-labelledby="rating-system-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="rating-system-heading" className="text-lg font-semibold text-white">
              Rating System
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Current newsletter question:{" "}
              <span className="text-gray-300">{ratings?.question ?? "How relevant was today's briefing?"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={loadRatings}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          {loading ? (
            <p className="text-sm text-gray-500">Loading rating responses...</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : ratings && total > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Campaign</p>
                  <p className="mt-2 text-sm font-semibold text-white">{ratings.campaign}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Responses</p>
                  <p className="mt-2 text-2xl font-bold text-white">{ratings.total}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Average Rating</p>
                  <p className="mt-2 text-2xl font-bold text-white">{ratings.average_score ?? "—"}/3</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Positive</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {pct(ratings.highly_relevant, total)}%
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-emerald-950/30 p-4 text-sm text-emerald-200">
                  <p className="font-semibold">Highly Relevant</p>
                  <p className="mt-1 text-2xl font-bold">{pct(ratings.highly_relevant, total)}%</p>
                  <p className="text-emerald-300/80">{ratings.highly_relevant} responses</p>
                </div>
                <div className="rounded-lg bg-amber-950/30 p-4 text-sm text-amber-200">
                  <p className="font-semibold">Somewhat Relevant</p>
                  <p className="mt-1 text-2xl font-bold">{pct(ratings.somewhat_relevant, total)}%</p>
                  <p className="text-amber-300/80">{ratings.somewhat_relevant} responses</p>
                </div>
                <div className="rounded-lg bg-rose-950/30 p-4 text-sm text-rose-200">
                  <p className="font-semibold">Not Relevant</p>
                  <p className="mt-1 text-2xl font-bold">{pct(ratings.not_relevant, total)}%</p>
                  <p className="text-rose-300/80">{ratings.not_relevant} responses</p>
                </div>
              </div>

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
                    {ratings.responses.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">{row.subscriber_email}</td>
                        <td className="px-4 py-3">{ratingLabel(row.score, ratings.scale)}</td>
                        <td className="px-4 py-3">{row.newsletter_date}</td>
                        <td className="px-4 py-3">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No rating responses yet.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="feedback-heading" className="mt-10">
        <h2 id="feedback-heading" className="text-lg font-semibold text-white">
          Feedback
        </h2>
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <p className="text-sm leading-6 text-gray-400">
            No free-form feedback questions are active yet. When we add open-ended prompts to the newsletter or
            preference flow, those responses should appear here separately from the rating-system campaign.
          </p>
        </div>
      </section>
    </div>
  );
}

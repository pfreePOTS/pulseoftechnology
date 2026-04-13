"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type PipelineSettings = {
  trend_window_days: number;
  trend_prior_window_days: number;
};

type HotTopicBrief = {
  id: number;
  name: string;
  domain: string;
  subdomain: string;
  urgency_score: number;
};

type HotArticleBrief = {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  ingested_at: string;
  source_name: string | null;
};

type HotOfDay = {
  trend_window_days: number;
  hot_topic: HotTopicBrief | null;
  articles_in_window: number;
  hot_article: HotArticleBrief | null;
};

type PositioningInsight = {
  topic_id: number;
  name: string;
  domain: string;
  urgency_score: number;
  article_count: number;
  articles_primary_window: number;
  articles_prior_window: number;
  primary_window_days: number;
  prior_window_days: number;
  trend: string;
  label: string;
  note: string;
  ai_enriched: boolean;
};

function trendArrow(trend: string): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function trendColor(trend: string): string {
  if (trend === "up") return "text-emerald-400";
  if (trend === "down") return "text-rose-400";
  return "text-gray-400";
}

export default function TrendingDailyPage() {
  const [settings, setSettings] = useState<PipelineSettings | null>(null);
  const [hot, setHot] = useState<HotOfDay | null>(null);
  const [insights, setInsights] = useState<PositioningInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, hRes, iRes] = await Promise.all([
        adminFetch(`${API_BASE}/api/admin/settings`),
        adminFetch(`${API_BASE}/api/admin/trending/hot-of-day`),
        adminFetch(`${API_BASE}/api/admin/topics/positioning-insights`),
      ]);
      if (sRes.ok) setSettings((await sRes.json()) as PipelineSettings);
      else setSettings(null);

      if (!hRes.ok) throw new Error(await hRes.text());
      setHot((await hRes.json()) as HotOfDay);

      if (!iRes.ok) throw new Error(await iRes.text());
      const iData: unknown = await iRes.json();
      setInsights(Array.isArray(iData) ? (iData as PositioningInsight[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setHot(null);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tw = settings?.trend_window_days ?? hot?.trend_window_days ?? 7;
  const pw = settings?.trend_prior_window_days ?? 7;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Daily trends</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          <strong className="text-gray-300">Hot topic</strong> is the on-radar topic with the most articles in the last{" "}
          {tw} days (coverage time: later of publish date or ingest).{" "}
          <strong className="text-gray-300">Hot article</strong> is the most recently ingested story in that topic
          within the same window. The table below compares this window to the prior {pw} days for velocity and
          direction (AI-enriched when configured).
        </p>
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <section className="mb-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Hot topic (today)</h2>
              {hot?.hot_topic ? (
                <>
                  <p className="mt-3 text-2xl font-bold text-white">{hot.hot_topic.name}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {hot.hot_topic.domain}
                    {hot.hot_topic.subdomain?.trim() ? ` · ${hot.hot_topic.subdomain}` : ""}
                  </p>
                  <p className="mt-3 text-sm text-gray-300">
                    <span className="font-semibold text-[#019E7C]">{hot.articles_in_window}</span> articles in the last{" "}
                    {hot.trend_window_days} days
                  </p>
                  <Link
                    href={`/admin/topics/${hot.hot_topic.id}`}
                    className="mt-4 inline-flex text-sm font-medium text-[#019E7C] hover:underline"
                  >
                    Open topic →
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  No on-radar topic has articles in the last {tw} days — or there are no selected topics.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Hot article (today)</h2>
              {hot?.hot_article ? (
                <>
                  <a
                    href={hot.hot_article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-lg font-semibold text-[#019E7C] hover:underline"
                  >
                    {hot.hot_article.title}
                  </a>
                  <p className="mt-2 text-xs text-gray-500">
                    {hot.hot_article.source_name ?? "Source"} · Ingested{" "}
                    {new Date(hot.hot_article.ingested_at).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  {hot?.hot_topic
                    ? "No article found in the window (unusual — try refreshing)."
                    : "Shows when a hot topic is available."}
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">On-radar velocity & direction</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Topic</th>
                    <th className="px-3 py-3">Domain</th>
                    <th className="px-3 py-3 text-right">Last {tw}d</th>
                    <th className="px-3 py-3 text-right">Prior {pw}d</th>
                    <th className="px-3 py-3">Trend</th>
                    <th className="px-3 py-3">Label</th>
                    <th className="min-w-[200px] px-3 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-950">
                  {insights.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                        No positioning data. Add selected (on-radar) topics or check API keys for AI labels.
                      </td>
                    </tr>
                  ) : (
                    insights.map((row) => (
                      <tr key={row.topic_id} className="hover:bg-gray-900/40">
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/topics/${row.topic_id}`}
                            className="font-medium text-white hover:text-[#019E7C]"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-gray-400">{row.domain}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-200">
                          {row.articles_primary_window}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-200">
                          {row.articles_prior_window}
                        </td>
                        <td className={`px-3 py-3 text-lg ${trendColor(row.trend)}`} title={row.trend}>
                          {trendArrow(row.trend)}
                        </td>
                        <td className="px-3 py-3 text-gray-300">{row.label}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{row.note}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

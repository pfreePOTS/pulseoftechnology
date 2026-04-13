"use client";

import { useMemo } from "react";

import { scrollToSubscribe } from "@/lib/subscribeNavigation";

export type TrackedArticle = {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  ingested_at: string;
  domain: string;
  source_name: string | null;
  /** Precomputed on the server so client hydration never re-formats dates. */
  displayDate: string;
};

/** Matches domain badge colours used on the radar. */
const DOMAIN_COLORS: Record<string, string> = {
  AI: "#7C3AED",
  Security: "#E91D24",
  Cloud: "#0284C7",
  Finance: "#019E7C",
  Leadership: "#D97706",
  Other: "#6B7280",
};

const TEASER_COUNT = 3;

export default function TrackedStoriesSection({ articles }: { articles: TrackedArticle[] }) {
  const teaserArticles = useMemo(
    () => articles.slice(0, TEASER_COUNT),
    [articles],
  );

  if (teaserArticles.length === 0) return null;

  return (
    <section
      style={{ backgroundColor: "#E5E5E5" }}
      className="border-t border-gray-300 px-6 py-8"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-1 text-lg font-bold text-pulse-teal">Stories we&apos;re tracking</h2>
        <p className="mb-5 max-w-3xl text-sm text-gray-600">
          Recent articles ingested for published radar topics — the same source material we use when assembling the daily
          email digest.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teaserArticles.map((article) => {
            const color = DOMAIN_COLORS[article.domain] ?? DOMAIN_COLORS.Other;
            const when = article.displayDate;
            return (
              <article
                key={article.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {article.domain}
                  </span>
                  {article.source_name && (
                    <span className="text-xs text-gray-500">{article.source_name}</span>
                  )}
                  {when && <span className="text-xs text-gray-400">{when}</span>}
                </div>
                <h3 className="font-semibold leading-snug text-gray-900 line-clamp-3">{article.title}</h3>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm font-semibold text-pulse-teal underline decoration-pulse-teal/30 underline-offset-2 transition-colors hover:decoration-pulse-teal"
                >
                  Read at source →
                </a>
              </article>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToSubscribe()}
            className="rounded-lg bg-pulse-red px-8 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Subscribe for the daily briefing
          </button>
        </div>
      </div>
    </section>
  );
}

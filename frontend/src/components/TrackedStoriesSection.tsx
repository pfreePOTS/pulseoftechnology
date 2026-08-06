"use client";

import { useMemo } from "react";

import { domainColor } from "@/lib/domains";
import { filterByRadarDomain, normalizeRadarDomain } from "@/lib/radarFilters";
import { scrollToSubscribe } from "@/lib/subscribeNavigation";
import { useIsClient } from "@/lib/useIsClient";

export type TrackedArticle = {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  ingested_at: string;
  domain: string;
  source_name: string | null;
  /** Optional thumbnail URL from the article's source feed. */
  image_url: string | null;
  /** Short AI-extracted teaser ("what is it") — falls back to truncated content. */
  summary: string | null;
  /** Precomputed on the server so client hydration never re-formats dates. */
  displayDate: string;
};

/** Matches domain badge colours used on the radar. */
const DOMAIN_COLORS: Record<string, string> = {
  Other: "#6B7280",
};

const TEASER_COUNT = 3;

export default function TrackedStoriesSection({
  articles,
  lastUpdated,
}: {
  articles: TrackedArticle[];
  /** Pre-formatted "Updated MMM D, YYYY" string from the parent Server
   *  Component — same value the radar header uses, so the daily-tracking
   *  cadence reads consistently across the page. */
  lastUpdated?: string;
}) {
  const isClient = useIsClient();
  const selectedDomain = useMemo(() => {
    if (!isClient) return "";
    return normalizeRadarDomain(new URLSearchParams(window.location.search).get("domain"));
  }, [isClient]);
  const filteredArticles = useMemo(
    () => filterByRadarDomain(articles, selectedDomain),
    [articles, selectedDomain],
  );
  const teaserArticles = useMemo(
    () => filteredArticles.slice(0, TEASER_COUNT),
    [filteredArticles],
  );

  if (teaserArticles.length === 0) return null;

  return (
    <section
      style={{ backgroundColor: "#E5E5E5" }}
      className="border-t border-gray-300 px-6 py-8"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-sans text-2xl leading-tight font-bold tracking-tight text-pulse-teal md:text-[28px] md:leading-snug">
            Stories we&apos;re tracking
          </h2>
          {lastUpdated ? (
            <span className="text-[13px] font-medium text-gray-500">
              Updated {lastUpdated}
            </span>
          ) : null}
        </div>
        <p className="mb-5 max-w-3xl text-sm text-gray-600">
          Recent articles ingested for published radar topics — the same source material we use when assembling the daily
          email digest.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teaserArticles.map((article) => {
            const color = domainColor(article.domain) || DOMAIN_COLORS.Other;
            const when = article.displayDate;
            return (
              <article
                key={article.id}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Thumbnail area — gradient placeholder always renders so the
                    card layout stays uniform; if `image_url` is present, the
                    <img> overlays it. On load failure we fade the image out
                    and the gradient shows through, no extra state needed.
                    Plain <img> (not next/image) so we don't have to maintain
                    `images.remotePatterns` for every news outlet we ingest. */}
                <div
                  className="relative aspect-[16/9] w-full"
                  style={{
                    background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                  }}
                  aria-hidden
                >
                  {article.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary news-source hosts; see comment above */
                    <img
                      src={article.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0";
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-4">
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
                  <h3 className="font-semibold leading-snug text-gray-900 line-clamp-2">
                    {article.title}
                  </h3>
                  {article.summary ? (
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-3">
                      {article.summary}
                    </p>
                  ) : null}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto pt-3 text-sm font-semibold text-pulse-teal underline decoration-pulse-teal/30 underline-offset-2 transition-colors hover:decoration-pulse-teal"
                  >
                    Read at source →
                  </a>
                </div>
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

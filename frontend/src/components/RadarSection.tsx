"use client";

import { useEffect, useMemo, useState } from "react";

import { filterByRadarDomainSlug, normalizeRadarDomainSlug } from "@/lib/domains";
import { useIsClient } from "@/lib/useIsClient";
import { useDomains } from "@/lib/useDomains";
import RadarChart, { type RadarTopic, INDUSTRY_COLORS } from "./RadarChart";

const INDUSTRY_LIST = Object.keys(INDUSTRY_COLORS);

export default function RadarSection({
  topics,
  emptyMessage,
  layout = "default",
  lastUpdated,
}: {
  topics: RadarTopic[];
  emptyMessage?: string;
  /** `compact`: less padding, wider radar (admin preview). */
  layout?: "default" | "compact";
  /** Pre-formatted date string (e.g. "Apr 28, 2026") computed in the parent
   *  Server Component to avoid SSR/CSR Date hydration mismatches. */
  lastUpdated?: string;
}) {
  const compact = layout === "compact";
  const { domains: domainOptions } = useDomains();
  const isClient = useIsClient();
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    if (!isClient) return;
    const params = new URLSearchParams(window.location.search);
    const d = normalizeRadarDomainSlug(params.get("domain"));
    if (d) {
      setSelectedDomain(d);
    }
  }, [isClient]);

  const filteredTopics = useMemo(() => {
    let result = topics;

    if (selectedDomain) {
      result = filterByRadarDomainSlug(result, selectedDomain);
    }

    if (selectedIndustry) {
      // Keep only topics that have a position for this industry,
      // and trim industry_positions to just that industry so the chart
      // renders only those points.
      result = result
        .filter(
          (t) =>
            t.industry_positions && selectedIndustry in t.industry_positions,
        )
        .map((t) => ({
          ...t,
          industry_positions: {
            [selectedIndustry]: t.industry_positions![selectedIndustry],
          },
        }));
    }

    return result;
  }, [topics, selectedIndustry, selectedDomain]);

  return (
    <>
      {/* ── Control Bar ─────────────────────────────────────────────────── */}
      <div
        style={{ backgroundColor: "#E5E5E5" }}
        className={
          "border-b border-gray-300 shrink-0 " +
          (compact ? "px-3 py-1.5 sm:px-4" : "px-6 py-2")
        }
      >
        <div
          className={
            "mx-auto flex flex-wrap items-center justify-between gap-3 " +
            (compact ? "max-w-none gap-x-4 gap-y-2" : "max-w-7xl gap-4")
          }
        >
          {/* Title — adoption-stage explanations live in the hover tooltip on each radar pill */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              className={
                "font-sans font-bold tracking-tight text-pulse-teal " +
                (compact ? "text-xl leading-snug" : "text-3xl")
              }
            >
              Key Trending Topics
            </h1>
            {lastUpdated ? (
              <span className="text-[13px] font-medium text-gray-500">
                Updated {lastUpdated}
              </span>
            ) : null}
          </div>

          {/* Filters — render after mount so password-manager extensions cannot inject fdprocessedid during hydration */}
          {isClient ? (
            <div
              className={
                "flex flex-wrap items-center " + (compact ? "gap-3" : "gap-4")
              }
            >
              {/* Industry filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="industry-filter"
                  className="shrink-0 text-sm font-semibold text-pulse-teal"
                >
                  Industry
                </label>
                <select
                  id="industry-filter"
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-pulse-teal bg-white px-3 py-2 text-sm text-pulse-teal focus:outline-none focus:ring-2 focus:ring-pulse-teal/40"
                >
                  <option value="">All Industries</option>
                  {INDUSTRY_LIST.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              {/* Domain filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="domain-filter"
                  className="shrink-0 text-sm font-semibold text-pulse-teal"
                >
                  Domain
                </label>
                <select
                  id="domain-filter"
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="min-w-[155px] rounded-lg border border-pulse-teal bg-white px-3 py-2 text-sm text-pulse-teal focus:outline-none focus:ring-2 focus:ring-pulse-teal/40"
                >
                  <option value="">All Domains</option>
                  {domainOptions.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.short_label}
                    </option>
                  ))}
                </select>
              </div>

              {(selectedIndustry || selectedDomain) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIndustry("");
                    setSelectedDomain("");
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline"
                >
                  Clear filters
                </button>
              )}

              {/* Label toggle */}
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-pulse-teal">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[var(--color-pulse-teal)]"
                />
                Show topic names
              </label>
            </div>
          ) : (
            <div
              className="flex flex-wrap items-center gap-4"
              aria-hidden
            >
              <div className="h-9 rounded-lg bg-gray-300/70" style={{ minWidth: 268 }} />
              <div className="h-9 rounded-lg bg-gray-300/70" style={{ minWidth: 223 }} />
              <div className="h-4 w-32 rounded bg-gray-300/50" />
            </div>
          )}
        </div>
      </div>

      {/* ── Radar Area ─────────────────────────────────────────────────── */}
      <section
        className={
          "bg-white shrink-0 " +
          (compact ? "px-2 py-0 sm:px-3" : "px-6 pt-2 pb-2")
        }
      >
        <div className={compact ? "mx-auto w-full max-w-none" : "mx-auto max-w-[96rem]"}>
          <RadarChart
            key={`${selectedIndustry}\0${selectedDomain}`}
            topics={filteredTopics}
            showLabels={showLabels}
            emptyMessage={emptyMessage}
            layout={layout}
            industryScope={selectedIndustry}
            domainScope={selectedDomain}
          />
          {filteredTopics.length === 0 && topics.length > 0 && (
            <p className="mt-2 text-center text-sm text-gray-400">
              No topics match the selected filters.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

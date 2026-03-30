"use client";

import { useMemo, useState } from "react";
import RadarChart, { type RadarTopic, INDUSTRY_COLORS } from "./RadarChart";

const DOMAINS = ["AI", "Security", "Cloud", "Finance", "Leadership", "Other"];
const INDUSTRY_LIST = Object.keys(INDUSTRY_COLORS);

export default function RadarSection({ topics }: { topics: RadarTopic[] }) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  const filteredTopics = useMemo(() => {
    let result = topics;

    if (selectedDomain) {
      result = result.filter((t) => t.domain === selectedDomain);
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
        className="border-b border-gray-300 px-6 py-5 shrink-0"
      >
        <div className="mx-auto max-w-7xl flex flex-wrap items-end justify-between gap-4">
          {/* Title block */}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#425B76" }}>
              C-Level Technology Intelligence Radar
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              AI-curated signals scored by urgency · Hover a star to inspect ·
              Updated daily
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Industry filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="industry-filter"
                className="shrink-0 text-sm font-semibold"
                style={{ color: "#425B76" }}
              >
                Industry
              </label>
              <select
                id="industry-filter"
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: "#425B76",
                  color: "#425B76",
                  backgroundColor: "white",
                  minWidth: "200px",
                }}
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
                className="shrink-0 text-sm font-semibold"
                style={{ color: "#425B76" }}
              >
                Domain
              </label>
              <select
                id="domain-filter"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: "#425B76",
                  color: "#425B76",
                  backgroundColor: "white",
                  minWidth: "155px",
                }}
              >
                <option value="">All Domains</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {(selectedIndustry || selectedDomain) && (
              <button
                onClick={() => {
                  setSelectedIndustry("");
                  setSelectedDomain("");
                }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Radar Area ─────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-10 grow">
        <div className="mx-auto max-w-7xl">
          <RadarChart topics={filteredTopics} />
          {filteredTopics.length === 0 && topics.length > 0 && (
            <p className="mt-4 text-center text-sm text-gray-400">
              No topics match the selected filters.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

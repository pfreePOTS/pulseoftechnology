"use client";

import { useState } from "react";
import RadarChart, { type RadarTopic } from "./RadarChart";

export default function RadarSection({ topics }: { topics: RadarTopic[] }) {
  const [selectedDomain, setSelectedDomain] = useState("All");

  const availableDomains = [
    "All",
    ...Array.from(new Set(topics.map((t) => t.domain))).sort(),
  ];

  const filtered =
    selectedDomain === "All"
      ? topics
      : topics.filter((t) => t.domain === selectedDomain);

  return (
    <div>
      {/* Control bar */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label
          htmlFor="domain-filter"
          className="text-sm font-semibold"
          style={{ color: "#425B76" }}
        >
          Choose Domain
        </label>
        <select
          id="domain-filter"
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: "#425B76",
            color: "#425B76",
            backgroundColor: "white",
          }}
        >
          {availableDomains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          {filtered.length} topic{filtered.length !== 1 ? "s" : ""} displayed
        </span>
      </div>

      <RadarChart topics={filtered} />
    </div>
  );
}

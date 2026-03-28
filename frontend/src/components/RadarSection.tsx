"use client";

import { useState } from "react";
import RadarChart, { type RadarTopic } from "./RadarChart";

export default function RadarSection({ topics }: { topics: RadarTopic[] }) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const selectedTopic =
    selectedTopicId !== null
      ? (topics.find((t) => t.id === selectedTopicId) ?? null)
      : null;

  return (
    <>
      {/* ── Light Gray Control Bar ─────────────────────────────────────────── */}
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

          {/* Topic picker */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="topic-picker"
              className="shrink-0 text-sm font-semibold"
              style={{ color: "#425B76" }}
            >
              Choose Topic
            </label>
            <select
              id="topic-picker"
              value={selectedTopicId ?? ""}
              onChange={(e) =>
                setSelectedTopicId(
                  e.target.value !== "" ? Number(e.target.value) : null,
                )
              }
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{
                borderColor: "#425B76",
                color: "#425B76",
                backgroundColor: "white",
                minWidth: "220px",
              }}
            >
              <option value="">— select a topic —</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── White Radar Area ──────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-10 grow">
        <div className="mx-auto max-w-7xl">
          {selectedTopic ? (
            <RadarChart topics={[selectedTopic]} />
          ) : (
            <div
              className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200"
              style={{ minHeight: "440px" }}
            >
              <div className="text-center">
                <p className="text-base font-medium" style={{ color: "#425B76" }}>
                  Select a topic to view its radar position
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {topics.length > 0
                    ? `${topics.length} topic${topics.length !== 1 ? "s" : ""} available`
                    : "No topics published yet"}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

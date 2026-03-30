"use client";

import { useEffect, useState } from "react";
import RadarChart, { type RadarTopic, INDUSTRY_COLORS } from "@/components/RadarChart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeader(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("pulse_admin_token") ?? "")
      : "";
  return { Authorization: `Bearer ${token}` };
}

const INDUSTRY_LEGEND = Object.entries(INDUSTRY_COLORS).map(([name, color]) => ({
  name,
  color,
}));

export default function RadarPreviewPage() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/topics?status=approved`, {
      headers: authHeader(),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTopics(data);
        setLoading(false);
      });
  }, []);

  const selectedTopic =
    selectedTopicId !== null
      ? (topics.find((t) => t.id === selectedTopicId) ?? null)
      : null;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Radar Preview
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            See exactly how approved topics are plotted on the public radar.
          </p>
        </header>

        {/* Control bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
          <label
            htmlFor="topic-picker"
            className="shrink-0 text-sm font-semibold text-gray-300"
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
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            style={{ minWidth: "220px" }}
          >
            <option value="">— select a topic —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {loading && (
            <span className="text-xs text-gray-600">Loading topics…</span>
          )}
        </div>

        {/* Radar */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          {selectedTopic ? (
            <RadarChart topics={[selectedTopic]} />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl border border-dashed border-gray-700"
              style={{ minHeight: "440px" }}
            >
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400">
                  Select a topic to preview its radar placement
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {topics.length > 0
                    ? `${topics.length} approved topic${topics.length !== 1 ? "s" : ""} available`
                    : "No approved topics yet"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {selectedTopic && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Domains
            </span>
            {INDUSTRY_LEGEND.map(({ name, color }) => (
              <span
                key={name}
                className="flex items-center gap-1.5 text-xs text-gray-400"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0"
                  style={{
                    backgroundColor: color,
                    clipPath:
                      "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
                  }}
                />
                {name}
              </span>
            ))}
          </div>
        )}

        {selectedTopic && (
          <p className="mt-4 text-xs text-gray-600">
            Urgency determines distance from centre · Adoption state determines
            which spoke · Industry positions override the defaults per segment
          </p>
        )}
      </div>
    </div>
  );
}

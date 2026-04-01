"use client";

import { useEffect, useState } from "react";
import RadarSection from "@/components/RadarSection";
import { type RadarTopic } from "@/components/RadarChart";

import { adminFetch, API_BASE } from "@/lib/api";

export default function RadarPreviewPage() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminFetch(`${API_BASE}/api/admin/topics?radar_pipeline=true`)
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data) => {
        if (!cancelled) {
          setTopics(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTopics([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col -mt-2">
      <div className="pb-2">
        <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100/90">
          Read-only preview for topics that are watched or selected (pipeline). Stars use adoption stage and
          impact/urgency like the public radar. The live site only shows topics you publish — Step 4: Publishing.
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Radar Preview
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Preview how selected topics will look on the public radar (same layout and filters as the live page). You do
          not need to publish first.
          {loading && (
            <span className="ml-2 text-xs text-gray-600">Loading…</span>
          )}
        </p>
      </div>

      {/* RadarSection owns the control bar + chart — identical to public page */}
      <div className="flex-1 overflow-hidden">
        <RadarSection
          topics={topics}
          emptyMessage="No watched or selected topics yet — approve topics into the pipeline to preview them here."
          layout="compact"
        />
      </div>
    </div>
  );
}

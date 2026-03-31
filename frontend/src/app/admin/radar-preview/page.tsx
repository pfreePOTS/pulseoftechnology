"use client";

import { useEffect, useState } from "react";
import RadarSection from "@/components/RadarSection";
import { type RadarTopic } from "@/components/RadarChart";

import { adminFetch, API_BASE } from "@/lib/api";

export default function RadarPreviewPage() {
  const [topics, setTopics] = useState<RadarTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`${API_BASE}/api/admin/topics?status=selected`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTopics(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <div className="pb-4">
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          This is a read-only preview. To publish topics to the radar, go to
          Step 4: Publishing.
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Radar Preview
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Live preview of selected topics on the public radar — filters and
          label toggle work identically to the public page.
          {loading && (
            <span className="ml-2 text-xs text-gray-600">Loading…</span>
          )}
        </p>
      </div>

      {/* RadarSection owns the control bar + chart — identical to public page */}
      <div className="flex-1 overflow-hidden">
        <RadarSection topics={topics} />
      </div>
    </div>
  );
}

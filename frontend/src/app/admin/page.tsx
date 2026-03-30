"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "pending" | "approved";

interface Topic {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  status: string;
  article_count: number;
}

function authHeader(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("pulse_admin_token") ?? "")
      : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function UrgencyBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-red-500/20 text-red-400 ring-red-500/30"
      : score >= 5
        ? "bg-amber-500/20 text-amber-400 ring-amber-500/30"
        : "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  const palette: Record<string, string> = {
    AI: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
    Security: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    Cloud: "bg-sky-500/20 text-sky-400 ring-sky-500/30",
    Finance: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    Leadership: "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  };
  const cls = palette[domain] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {domain}
    </span>
  );
}

export default function AdminTopicsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-select / merge state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | "">("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  async function fetchTopics(tab: Tab) {
    setLoading(true);
    setSelected(new Set());
    const token = localStorage.getItem("pulse_admin_token") ?? "";
    const data = await fetch(`${API_BASE}/api/admin/topics?status=${tab}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : []));
    setTopics(data);
    setLoading(false);
  }

  useEffect(() => { fetchTopics(activeTab); }, [activeTab]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openMerge() {
    if (selected.size < 2) return;
    const ids = [...selected];
    setMergeTargetId(ids[0]);
    setMergeError("");
    setMergeOpen(true);
  }

  async function handleMerge() {
    if (mergeTargetId === "") return;
    setMerging(true);
    setMergeError("");
    const sources = [...selected].filter((id) => id !== mergeTargetId);
    const r = await fetch(`${API_BASE}/api/admin/topics/merge`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ source_topic_ids: sources, target_topic_id: mergeTargetId }),
    });
    if (r.ok) {
      setMergeOpen(false);
      setSelected(new Set());
      await fetchTopics(activeTab);
    } else {
      const data = await r.json().catch(() => ({}));
      setMergeError(data.detail ?? "Merge failed");
    }
    setMerging(false);
  }

  const selectedTopics = topics.filter((t) => selected.has(t.id));
  const tabs: { key: Tab; label: string }[] = [
    { key: "pending", label: "Trending Topics (AI Discovered)" },
    { key: "approved", label: "Approved" },
  ];

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Curation Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Review AI-generated topic briefings before publishing.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Merge toolbar — shown when ≥2 topics selected */}
        {selected.size >= 2 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
            <span className="text-sm font-medium text-indigo-300">
              {selected.size} topics selected
            </span>
            <button
              onClick={openMerge}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Merge Selected →
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">No {activeTab} topics</p>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === "pending"
                ? "Run RSS ingestion to discover new trending topics."
                : "Approve topics from the Pending tab."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-3 py-3 w-8" />
                  <th className="px-4 py-3 font-medium text-gray-400">Topic</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Domain</th>
                  {activeTab === "pending" && (
                    <th className="px-4 py-3 text-right font-medium text-gray-400">Articles</th>
                  )}
                  <th className="px-4 py-3 text-right font-medium text-gray-400">Urgency</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topics.map((topic) => (
                  <tr
                    key={topic.id}
                    className={`group transition-colors hover:bg-gray-800/50 ${
                      selected.has(topic.id) ? "bg-indigo-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(topic.id)}
                        onChange={() => toggleSelect(topic.id)}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 accent-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{topic.name}</p>
                      {topic.summary && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{topic.summary}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DomainBadge domain={topic.domain} />
                    </td>
                    {activeTab === "pending" && (
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          {topic.article_count} article{topic.article_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <UrgencyBadge score={topic.urgency_score} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/topics/${topic.id}`}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
                          activeTab === "approved"
                            ? "bg-gray-600 hover:bg-gray-500"
                            : "bg-indigo-600 hover:bg-indigo-500"
                        }`}
                      >
                        {activeTab === "approved" ? "Edit" : "Inspect & Promote"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600">
          {topics.length} topic{topics.length !== 1 ? "s" : ""} · {activeTab} tab
        </p>
      </div>

      {/* ── Merge Modal ── */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Merge Topics</h2>
            <p className="mb-4 text-sm text-gray-400">
              All articles from the other topics will be moved into the target. The others will be deleted.
            </p>

            {/* List of selected topics */}
            <div className="mb-4 space-y-1">
              {selectedTopics.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${mergeTargetId === t.id ? "bg-indigo-400" : "bg-gray-600"}`}
                  />
                  <span className={mergeTargetId === t.id ? "text-white font-medium" : "text-gray-400"}>
                    {t.name}
                  </span>
                  <span className="text-xs text-gray-600">({t.article_count} articles)</span>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Keep this topic as the target
              </label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {selectedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {mergeError && (
              <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{mergeError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMergeOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging || mergeTargetId === ""}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {merging ? "Merging…" : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type SubTab = "pending" | "approved";

interface Topic {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  status: string;
  article_count: number;
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

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function IconInspectPromote({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <circle cx="10.5" cy="10.5" r="7.5" />
      <path strokeLinecap="round" d="M16.5 16.5 21 21" />
    </svg>
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

/** Topic title + truncated executive summary; hover shows full summary in a floating panel. */
function TopicExecutiveSummary({
  name,
  summary,
  generating,
  noArticles,
}: {
  name: string;
  summary: string | null;
  generating: boolean;
  noArticles: boolean;
}) {
  if (generating) {
    return (
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="mt-0.5 text-xs italic text-indigo-400/90">Generating executive summary…</p>
      </div>
    );
  }

  if (noArticles) {
    return (
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="mt-0.5 text-xs text-gray-600">No articles linked yet — summary unavailable.</p>
      </div>
    );
  }

  if (!summary?.trim()) {
    return (
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="mt-0.5 text-xs text-gray-600">Executive summary pending.</p>
      </div>
    );
  }

  const full = summary.trim();

  return (
    <div className="group/topic relative max-w-md">
      <p className="font-medium text-white">{name}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-400" title={full}>
        {full}
      </p>
      <div
        className="pointer-events-none absolute left-0 top-full z-[60] mt-1 max-h-[min(24rem,70vh)] w-[min(calc(100vw-3rem),28rem)] overflow-y-auto rounded-lg border border-gray-600 bg-gray-950 p-3 text-left text-xs leading-relaxed text-gray-200 opacity-0 shadow-2xl transition-opacity duration-100 group-hover/topic:pointer-events-auto group-hover/topic:opacity-100"
        role="tooltip"
      >
        <p className="mb-2 border-b border-gray-800 pb-2 font-semibold text-white">{name}</p>
        <p className="whitespace-pre-wrap text-gray-300">{full}</p>
      </div>
    </div>
  );
}

async function backfillExecutiveSummaries(
  data: Topic[],
  setTopics: Dispatch<SetStateAction<Topic[]>>,
  setGeneratingSummaryIds: Dispatch<SetStateAction<Set<number>>>,
  isCancelled?: () => boolean,
) {
  const needSummary = data.filter(
    (t) => (!t.summary || !String(t.summary).trim()) && t.article_count > 0,
  );

  for (const t of needSummary) {
    if (isCancelled?.()) break;
    setGeneratingSummaryIds((prev) => new Set(prev).add(t.id));
    try {
      const gr = await adminFetch(`${API_BASE}/api/admin/topics/${t.id}/generate-summary`, {
        method: "POST",
      });
      if (isCancelled?.()) break;
      if (gr.ok) {
        const updated: Topic = await gr.json();
        setTopics((prev) => prev.map((x) => (x.id === t.id ? { ...x, summary: updated.summary } : x)));
      }
    } finally {
      setGeneratingSummaryIds((prev) => {
        const next = new Set(prev);
        next.delete(t.id);
        return next;
      });
    }
  }
}

export default function CurationDashboard() {
  const [activeTab, setActiveTab] = useState<SubTab>("pending");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  /** Topic ids currently running AI executive-summary generation */
  const [generatingSummaryIds, setGeneratingSummaryIds] = useState<Set<number>>(new Set());

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | "">("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTopicsAndSummaries() {
      setLoading(true);
      setSelected(new Set());
      setGeneratingSummaryIds(new Set());

      const res = await adminFetch(`${API_BASE}/api/admin/topics?status=${activeTab}`);
      const data: Topic[] = res.ok ? await res.json() : [];
      if (cancelled) return;

      setTopics(data);
      setLoading(false);

      await backfillExecutiveSummaries(data, setTopics, setGeneratingSummaryIds, () => cancelled);
    }

    void loadTopicsAndSummaries();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    const r = await adminFetch(`${API_BASE}/api/admin/topics/merge`, {
      method: "POST",
      body: JSON.stringify({ source_topic_ids: sources, target_topic_id: mergeTargetId }),
    });
    if (r.ok) {
      setMergeOpen(false);
      setSelected(new Set());
      const res = await adminFetch(`${API_BASE}/api/admin/topics?status=${activeTab}`);
      const data: Topic[] = res.ok ? await res.json() : [];
      setTopics(data);
      await backfillExecutiveSummaries(data, setTopics, setGeneratingSummaryIds);
    } else {
      const data = await r.json().catch(() => ({}));
      setMergeError(data.detail ?? "Merge failed");
    }
    setMerging(false);
  }

  const selectedTopics = topics.filter((t) => selected.has(t.id));
  const subTabs: { key: SubTab; label: string }[] = [
    { key: "pending", label: "Trending Topics (AI Discovered)" },
    { key: "approved", label: "Approved" },
  ];

  return (
    <>
      <div className="max-w-5xl">
        <h2 className="text-xl font-semibold text-white">Curation</h2>
        <p className="mt-1 text-sm text-gray-400">
          Approve pending topics and merge duplicates before positioning and send.
        </p>

        <div className="mb-5 mt-5 flex w-fit gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
          {subTabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selected.size >= 2 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
            <span className="text-sm font-medium text-indigo-300">{selected.size} topics selected</span>
            <button
              type="button"
              onClick={openMerge}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Merge Selected →
            </button>
            <button
              type="button"
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
                  <th className="w-8 px-3 py-3" />
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
                      <TopicExecutiveSummary
                        name={topic.name}
                        summary={topic.summary}
                        generating={generatingSummaryIds.has(topic.id)}
                        noArticles={topic.article_count === 0}
                      />
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
                        title={activeTab === "approved" ? "Edit" : "Inspect & Promote"}
                        aria-label={
                          activeTab === "approved"
                            ? `Edit topic: ${topic.name}`
                            : `Inspect and promote topic: ${topic.name}`
                        }
                        className={`inline-flex items-center justify-center rounded-md p-2 text-white transition-colors ${
                          activeTab === "approved"
                            ? "bg-gray-600 hover:bg-gray-500"
                            : "bg-indigo-600 hover:bg-indigo-500"
                        }`}
                      >
                        {activeTab === "approved" ? (
                          <IconPencil className="h-5 w-5" />
                        ) : (
                          <IconInspectPromote className="h-5 w-5" />
                        )}
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

      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Merge Topics</h2>
            <p className="mb-4 text-sm text-gray-400">
              All articles from the other topics will be moved into the target. The others will be deleted.
            </p>

            <div className="mb-4 space-y-1">
              {selectedTopics.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${mergeTargetId === t.id ? "bg-indigo-400" : "bg-gray-600"}`}
                  />
                  <span className={mergeTargetId === t.id ? "font-medium text-white" : "text-gray-400"}>
                    {t.name}
                  </span>
                  <span className="text-xs text-gray-600">({t.article_count} articles)</span>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Keep this topic as the target</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {selectedTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {mergeError && (
              <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{mergeError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
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
    </>
  );
}

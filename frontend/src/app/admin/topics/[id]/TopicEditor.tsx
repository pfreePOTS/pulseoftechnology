"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Article {
  id: number;
  title: string;
  url: string;
  content: string | null;
  status: string;
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  status: string;
  articles: Article[];
}

type SaveState = "idle" | "saving" | "saved" | "error";
type ApproveState = "idle" | "approving" | "approved" | "error";

export default function TopicEditor({
  topic,
  apiBase,
}: {
  topic: TopicDetail;
  apiBase: string;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(topic.summary ?? "");
  const [urgency, setUrgency] = useState(String(topic.urgency_score));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [approveState, setApproveState] = useState<ApproveState>(
    topic.status === "approved" ? "approved" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary || null,
          urgency_score: parseFloat(urgency),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  async function handleApprove() {
    setApproveState("approving");
    setErrorMsg("");
    try {
      // Persist any unsaved edits first
      await fetch(`${apiBase}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary || null,
          urgency_score: parseFloat(urgency),
        }),
      });
      const res = await fetch(
        `${apiBase}/api/admin/topics/${topic.id}/approve`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      setApproveState("approved");
      // Return to dashboard after a short delay
      setTimeout(() => router.push("/admin"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Approval failed");
      setApproveState("error");
    }
  }

  const isApproved =
    approveState === "approved" || topic.status === "approved";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {topic.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {topic.domain}
            </span>
            {isApproved && (
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-green-500/30">
                Approved
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Edit Form */}
        <section className="lg:col-span-3 space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Edit Briefing
          </h2>

          <div>
            <label
              htmlFor="summary"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Executive Summary
            </label>
            <textarea
              id="summary"
              rows={8}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isApproved}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="AI-generated executive summary will appear here…"
            />
          </div>

          <div>
            <label
              htmlFor="urgency"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Urgency Score{" "}
              <span className="text-xs text-gray-500">(1 – 10)</span>
            </label>
            <input
              id="urgency"
              type="number"
              min="1"
              max="10"
              step="0.1"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              disabled={isApproved}
              className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {errorMsg}
            </p>
          )}

          {!isApproved && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
              >
                {saveState === "saving" ? "Saving…" : "Save Changes"}
              </button>
              {saveState === "saved" && (
                <span className="text-sm text-green-400">Saved</span>
              )}

              <button
                onClick={handleApprove}
                disabled={approveState === "approving"}
                className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {approveState === "approving"
                  ? "Approving…"
                  : "Approve & Publish"}
              </button>
            </div>
          )}

          {approveState === "approved" && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
              Topic approved. Redirecting to dashboard…
            </p>
          )}
        </section>

        {/* Source Articles */}
        <aside className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Source Articles ({topic.articles.length})
          </h2>
          {topic.articles.length === 0 ? (
            <p className="text-sm text-gray-600">No articles linked.</p>
          ) : (
            <ul className="space-y-3">
              {topic.articles.map((article) => (
                <li
                  key={article.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                >
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {article.title}
                  </a>
                  {article.content && (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-500">
                      {article.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

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

const ADOPTION_STATES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Manufacturing",
  "Education",
  "Retail & E-Commerce",
  "Government & Public Sector",
  "Media & Entertainment",
  "Energy & Utilities",
  "Other",
] as const;

interface IndustryPosition {
  urgency_score: number;
  adoption_state: string;
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  status: string;
  articles: Article[];
}

type SaveState = "idle" | "saving" | "saved" | "error";
type ApproveState = "idle" | "approving" | "approved" | "error";

// ── Shared input styles (dark admin theme)
const inputCls =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50";

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
  const [adoptionState, setAdoptionState] = useState(topic.adoption_state);
  const [industryPositions, setIndustryPositions] = useState<
    Record<string, IndustryPosition>
  >(topic.industry_positions ?? {});

  // New-row form state
  const [newIndustry, setNewIndustry] = useState<string>("");
  const [newUrgency, setNewUrgency] = useState("5.0");
  const [newAdoptionState, setNewAdoptionState] = useState<string>(
    "Learn About",
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [approveState, setApproveState] = useState<ApproveState>(
    topic.status === "approved" ? "approved" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const isApproved =
    approveState === "approved" || topic.status === "approved";

  // ── Industry position helpers
  function addIndustryPosition() {
    if (!newIndustry) return;
    setIndustryPositions((prev) => ({
      ...prev,
      [newIndustry]: {
        urgency_score: parseFloat(newUrgency) || 5.0,
        adoption_state: newAdoptionState,
      },
    }));
    setNewIndustry("");
    setNewUrgency("5.0");
    setNewAdoptionState("Learn About");
  }

  function removeIndustryPosition(industry: string) {
    setIndustryPositions((prev) => {
      const next = { ...prev };
      delete next[industry];
      return next;
    });
  }

  function updateIndustryPosition(
    industry: string,
    field: keyof IndustryPosition,
    value: string,
  ) {
    setIndustryPositions((prev) => ({
      ...prev,
      [industry]: {
        ...prev[industry],
        [field]: field === "urgency_score" ? parseFloat(value) || 0 : value,
      },
    }));
  }

  // ── Build payload (shared between Save and Approve)
  function buildPayload() {
    return {
      summary: summary || null,
      urgency_score: parseFloat(urgency),
      adoption_state: adoptionState,
      industry_positions:
        Object.keys(industryPositions).length > 0 ? industryPositions : null,
    };
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
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
      await fetch(`${apiBase}/api/admin/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const res = await fetch(
        `${apiBase}/api/admin/topics/${topic.id}/approve`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      setApproveState("approved");
      setTimeout(() => router.push("/admin"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Approval failed");
      setApproveState("error");
    }
  }

  const availableIndustries = INDUSTRIES.filter(
    (ind) => !(ind in industryPositions),
  );

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
        {/* ── Edit Form ── */}
        <section className="lg:col-span-3 space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Edit Briefing
          </h2>

          {/* Summary */}
          <div>
            <label
              htmlFor="summary"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Executive Summary
            </label>
            <textarea
              id="summary"
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isApproved}
              className={`w-full ${inputCls}`}
              placeholder="AI-generated executive summary will appear here…"
            />
          </div>

          {/* Default urgency + adoption state */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="urgency"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Default Urgency{" "}
                <span className="text-xs text-gray-500">(1–10)</span>
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
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label
                htmlFor="adoption-state"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Default Adoption State
              </label>
              <select
                id="adoption-state"
                value={adoptionState}
                onChange={(e) => setAdoptionState(e.target.value)}
                disabled={isApproved}
                className={`w-full ${inputCls}`}
              >
                {ADOPTION_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Industry Positions ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">
                Industry Positions
              </h3>
              <span className="text-xs text-gray-600">
                Overrides default for specific industries
              </span>
            </div>

            {/* Existing rows */}
            {Object.entries(industryPositions).length > 0 ? (
              <div className="mb-3 divide-y divide-gray-800 rounded-lg border border-gray-700">
                {Object.entries(industryPositions).map(
                  ([industry, pos]) => (
                    <div
                      key={industry}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <span className="w-36 shrink-0 text-xs font-medium text-gray-300">
                        {industry}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={pos.urgency_score}
                        disabled={isApproved}
                        onChange={(e) =>
                          updateIndustryPosition(
                            industry,
                            "urgency_score",
                            e.target.value,
                          )
                        }
                        className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                        title="Urgency (1–10)"
                      />
                      <select
                        value={pos.adoption_state}
                        disabled={isApproved}
                        onChange={(e) =>
                          updateIndustryPosition(
                            industry,
                            "adoption_state",
                            e.target.value,
                          )
                        }
                        className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                      >
                        {ADOPTION_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => removeIndustryPosition(industry)}
                          className="shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mb-3 text-xs text-gray-600">
                No industry overrides — all industries use the default above.
              </p>
            )}

            {/* Add-row form */}
            {!isApproved && availableIndustries.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">Add industry…</option>
                  {availableIndustries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={newUrgency}
                  onChange={(e) => setNewUrgency(e.target.value)}
                  className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                  placeholder="Urgency"
                />
                <select
                  value={newAdoptionState}
                  onChange={(e) => setNewAdoptionState(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {ADOPTION_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addIndustryPosition}
                  disabled={!newIndustry}
                  className="shrink-0 rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 disabled:opacity-40 transition-colors"
                >
                  + Add
                </button>
              </div>
            )}
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
                className="ml-auto rounded-lg bg-pulse-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

        {/* ── Source Articles ── */}
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

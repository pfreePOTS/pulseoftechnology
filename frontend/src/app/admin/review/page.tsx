"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";
import { FALLBACK_DOMAINS } from "@/lib/domains";

type ArticleRow = {
  id: number;
  source_name: string | null;
  title: string;
  url: string;
  published_at: string | null;
  ingested_at: string;
  status: string;
  subdomain: string;
  review_reason: string | null;
  review_notes: string | null;
  ai_output: Record<string, unknown> | null;
};

const DOMAINS = FALLBACK_DOMAINS.map((d) => ({ slug: d.slug, label: d.short_label }));

function aiString(row: ArticleRow, key: string): string {
  const value = row.ai_output?.[key];
  return typeof value === "string" ? value : "";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function ArticleReviewPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({
      status: "review",
      archive: "active",
      limit: "200",
    });
    const res = await adminFetch(`${API_BASE}/api/admin/articles?${params.toString()}`);
    if (!res.ok) {
      setArticles([]);
      setError(await res.text().catch(() => res.statusText));
      return;
    }
    setArticles((await res.json()) as ArticleRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submitReview(
    id: number,
    payload: { action: "approve" | "skip" | "retry"; domain?: string; subdomain?: string; topic_name?: string; notes?: string },
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/articles/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await res.text().catch(() => res.statusText));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed");
    } finally {
      setBusyId(null);
    }
  }

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    return `${articles.length} article${articles.length === 1 ? "" : "s"} need review`;
  }, [articles.length, loading]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Review Queue</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
          Articles land here when the AI is uncertain, returns malformed JSON after retry, or would otherwise create
          an <span className="text-gray-300">Other: Review Needed</span> trend. Approve only real technology stories;
          skip the rest so they do not enter Trend Discovery.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-sm font-medium text-fuchsia-200">
            {countLabel}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-sm font-medium text-[#019E7C] hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading review articles…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">
          No articles need review right now.
        </p>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <ReviewCard
              key={article.id}
              article={article}
              busy={busyId === article.id}
              onSubmit={(payload) => submitReview(article.id, payload)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  article,
  busy,
  onSubmit,
}: {
  article: ArticleRow;
  busy: boolean;
  onSubmit: (payload: {
    action: "approve" | "skip" | "retry";
    domain?: string;
    subdomain?: string;
    topic_name?: string;
    notes?: string;
  }) => void;
}) {
  const [domain, setDomain] = useState(aiString(article, "domain") || "security");
  const [subdomain, setSubdomain] = useState(aiString(article, "subdomain") || article.subdomain || "");
  const [topicName, setTopicName] = useState(aiString(article, "suggested_topic_name"));
  const [notes, setNotes] = useState("");
  const canApprove = domain.trim() && subdomain.trim() && topicName.trim();

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{article.source_name ?? "Unknown source"}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(article.published_at ?? article.ingested_at)}</span>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white hover:text-indigo-300"
          >
            {article.title}
          </a>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge label={`AI: ${aiString(article, "domain") || "unknown"}`} />
            <Badge label={aiString(article, "subdomain") || "No sub-domain"} />
            <Badge label={aiString(article, "suggested_topic_name") || "No topic"} />
          </div>
          {article.review_reason ? (
            <p className="mt-3 text-sm text-fuchsia-200">{article.review_reason}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit({ action: "skip", notes })}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
          >
            Skip as non-tech
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit({ action: "retry", notes })}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            Retry AI
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[150px_1fr_1fr]">
        <label className="text-xs font-medium text-gray-400">
          Domain
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
          >
            {DOMAINS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-400">
          Sub-domain
          <input
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            placeholder="e.g. Software Supply Chain"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        <label className="text-xs font-medium text-gray-400">
          Topic
          <input
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            placeholder="e.g. Package Registry Credential Theft"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-400">
        Review notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Why this should be approved, skipped, or retried"
          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
      </label>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={busy || !canApprove}
          onClick={() =>
            onSubmit({
              action: "approve",
              domain,
              subdomain,
              topic_name: topicName,
              notes,
            })
          }
          className="rounded-lg bg-[#019E7C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Approve classification"}
        </button>
      </div>
    </article>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded bg-gray-800/90 px-2 py-0.5 text-xs text-gray-400">
      {label}
    </span>
  );
}

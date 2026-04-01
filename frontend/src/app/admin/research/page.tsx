"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface ArticleRow {
  id: number;
  source_id: number;
  source_name: string | null;
  topic_id: number | null;
  topic_name: string | null;
  title: string;
  url: string;
  published_at: string | null;
  ingested_at: string;
  status: string;
  archived_at?: string | null;
}

type StatusFilter = "all" | "raw" | "processed";
type ArchiveView = "active" | "archived";

const PAGE_LIMIT = 200;

function statusQueryParam(filter: StatusFilter): string {
  if (filter === "all") return "raw,processed";
  return filter;
}

function formatPublished(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type JobState = "idle" | "running" | "success" | "error";

export default function ResearchCollectionPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [archiveView, setArchiveView] = useState<ArchiveView>("active");
  const [collectionStats, setCollectionStats] = useState<{
    active: number;
    archived: number;
  } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [ingestJob, setIngestJob] = useState<JobState>("idle");
  const [processJob, setProcessJob] = useState<JobState>("idle");
  const [jobToast, setJobToast] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        status: statusQueryParam(filter),
        archive: archiveView === "active" ? "active" : "archived",
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });
      const res = await adminFetch(
        `${API_BASE}/api/admin/articles?${params.toString()}`,
      );
      if (!res.ok) {
        if (!append) {
          setArticles([]);
          setCanLoadMore(false);
        }
        return;
      }
      const data: ArticleRow[] = await res.json();
      setCanLoadMore(data.length === PAGE_LIMIT);
      setArticles((prev) => (append ? [...prev, ...data] : data));
    },
    [filter, archiveView],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/admin/articles/stats`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { active: number; archived: number };
        if (!cancelled) setCollectionStats(data);
      } catch {
        if (!cancelled) setCollectionStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await fetchPage(0, false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(articles.length, true);
    setLoadingMore(false);
  }

  async function refreshList() {
    setLoading(true);
    await fetchPage(0, false);
    setLoading(false);
  }

  async function runBackgroundJob(
    endpoint: string,
    setState: (s: JobState) => void,
    okHint: string,
  ) {
    setState("running");
    setJobToast(null);
    try {
      const res = await adminFetch(`${API_BASE}${endpoint}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data: { message?: string } = await res.json();
      setState("success");
      setJobToast(data.message ?? okHint);
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setState("error");
      setJobToast(e instanceof Error ? e.message : "Request failed");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const showLoadMore = !loading && canLoadMore;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Collection
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Raw articles from RSS feeds — monitor the ingestion engine&apos;s
          output.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
          The API runs{" "}
          <strong className="font-medium text-gray-400">
            scheduled jobs in-process
          </strong>{" "}
          (APScheduler, not Celery): RSS fetch + AI processing run{" "}
          <strong className="font-medium text-gray-400">every hour</strong>.
          Signal scoring runs daily at 06:00 UTC; newsletter at 07:00 UTC. Use
          the buttons below for manual runs — large batches may take minutes.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              runBackgroundJob(
                "/api/admin/jobs/ingest",
                setIngestJob,
                "RSS ingestion started.",
              )
            }
            disabled={ingestJob === "running" || processJob === "running"}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              ingestJob === "success"
                ? "bg-emerald-700 text-white"
                : ingestJob === "error"
                  ? "bg-red-600 text-white"
                  : "bg-[#019E7C] text-white hover:opacity-90"
            }`}
          >
            {ingestJob === "running" ? "Starting fetch…" : "Fetch RSS now"}
          </button>
          <button
            type="button"
            onClick={() =>
              runBackgroundJob(
                "/api/admin/jobs/process",
                setProcessJob,
                "Processing started.",
              )
            }
            disabled={ingestJob === "running" || processJob === "running"}
            className={`rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-100 transition-colors hover:bg-gray-800 disabled:opacity-50 ${
              processJob === "success"
                ? "border-emerald-600 text-emerald-300"
                : processJob === "error"
                  ? "border-red-500 text-red-300"
                  : ""
            }`}
          >
            {processJob === "running"
              ? "Starting process…"
              : "Process raw articles"}
          </button>
          <button
            type="button"
            onClick={() => void refreshList()}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#019E7C] hover:underline disabled:opacity-50"
          >
            Refresh list
          </button>
        </div>
        {jobToast ? (
          <p className="mt-2 text-sm text-gray-400" role="status">
            {jobToast}
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["raw", "Raw"],
              ["processed", "Processed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-gray-600" aria-hidden>
          |
        </span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["active", "Active pipeline"],
              ["archived", "Archived"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setArchiveView(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                archiveView === value
                  ? "bg-cyan-700 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {collectionStats ? (
          <span className="text-sm text-gray-500">
            {collectionStats.active} active · {collectionStats.archived} archived
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400">
          <span
            className="inline-block size-5 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"
            aria-hidden
          />
          <span>Loading articles…</span>
        </div>
      ) : articles.length === 0 ? (
        <p className="text-sm text-gray-500">No articles found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-300">
                    Source
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-300">
                    Title
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-300">
                    Published
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-300">
                    Archive
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {articles.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-gray-500">
                      {row.source_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:text-indigo-400"
                      >
                        {row.title}
                      </a>
                      {row.topic_name ? (
                        <div className="mt-1">
                          <span className="inline-block rounded bg-gray-800/80 px-2 py-0.5 text-xs text-gray-500">
                            {row.topic_name}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatPublished(row.published_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {row.archived_at ? (
                        <span className="text-xs text-gray-400">
                          {new Date(row.archived_at).toLocaleDateString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showLoadMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "raw") {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        raw
      </span>
    );
  }
  if (s === "processed") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        processed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-300">
      {status}
    </span>
  );
}

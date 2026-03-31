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
}

type StatusFilter = "all" | "raw" | "processed";

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

export default function ResearchCollectionPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        status: statusQueryParam(filter),
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
    [filter],
  );

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
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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

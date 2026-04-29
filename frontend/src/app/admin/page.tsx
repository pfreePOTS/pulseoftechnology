"use client";

import Link from "next/link";
import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch, API_BASE } from "@/lib/api";

export interface TopicRow {
  id: number;
  name: string;
  domain: string;
  subdomain?: string;
  summary: string | null;
  urgency_score: number;
  status: string;
  adoption_state: string;
  article_count: number;
  is_published: boolean;
  velocity_score: number | null;
  acceleration_score: number | null;
  signal_rationale: string | null;
  signal_suggested_action: string | null;
  signal_id: number | null;
  /** ISO datetime: newest linked article (published_at, else ingested_at). */
  latest_article_at?: string | null;
  /** When the topic was promoted to on-radar (selected); drives `days_on_radar`. */
  selected_at?: string | null;
  /** Whole days since `selected_at` (server-computed). */
  days_on_radar?: number | null;
}

interface TopicDetailArticle {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  source_name: string | null;
}

interface TopicDetailResponse {
  id: number;
  name: string;
  domain: string;
  subdomain?: string;
  summary: string | null;
  articles: TopicDetailArticle[];
}

type TabId = "pending" | "watching" | "radar";

const TAB_IDS = new Set<TabId>(["pending", "watching", "radar"]);

function DomainPill({ domain }: { domain: string }) {
  const palette: Record<string, string> = {
    AI: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
    Security: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    Cloud: "bg-sky-500/20 text-sky-400 ring-sky-500/30",
    Finance: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    Leadership: "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  };
  const cls = palette[domain] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {domain}
    </span>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function fmtOneDecimal(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

type PipelineTrendWindows = {
  trend_window_days: number;
  trend_prior_window_days: number;
};

const DEFAULT_TREND_WINDOWS: PipelineTrendWindows = {
  trend_window_days: 7,
  trend_prior_window_days: 7,
};

/** Explains velocity for the native `title` tooltip on table cells and charts. */
function velocityTooltipText(row: TopicRow, w: PipelineTrendWindows): string {
  const tw = w.trend_window_days;
  const v = row.velocity_score;
  const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
  const base = `Velocity is how many linked articles have coverage time in the last ${tw} days. Coverage time is publication date when available, otherwise when Pulse stored the RSS row (UTC). Archived articles are excluded.`;
  if (n === 0) {
    return `${base} This shows 0.0 because nothing falls in that window—stories may be older than ${tw} days, or there are no linked articles yet. Total linked articles on this topic: ${row.article_count}.`;
  }
  return `${base} Current value: ${n.toFixed(1)} article(s) in the last ${tw} days.`;
}

/** Explains acceleration (ratio vs prior window) for the native `title` tooltip. */
function accelerationTooltipText(row: TopicRow, w: PipelineTrendWindows): string {
  const tw = w.trend_window_days;
  const pw = w.trend_prior_window_days;
  const v = row.velocity_score;
  const a = row.acceleration_score;
  const base = `Acceleration is velocity divided by max(prior-window article count, 1). The prior window is the ${pw} days immediately before the last ${tw}-day primary window. Values above 1.0 mean more activity than in that prior period.`;
  if (a === null || Number.isNaN(a)) {
    return "Acceleration is not available for this row.";
  }
  const vn = typeof v === "number" && !Number.isNaN(v) ? v : 0;
  if (vn === 0) {
    return `${base} With velocity 0, acceleration is ${a.toFixed(1)}× (no articles in the primary window, so the ratio is zero).`;
  }
  return `${base} Current value: ${a.toFixed(1)}×.`;
}

function MetricHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span
      className="cursor-help underline decoration-dotted decoration-gray-500/70 underline-offset-2"
      title={title}
    >
      {children}
    </span>
  );
}

function articleSourceLabel(a: TopicDetailArticle): string {
  if (a.source_name?.trim()) return a.source_name;
  try {
    return new URL(a.url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

function fmtPublished(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function IconChevronDown({ className, expanded }: { className?: string; expanded?: boolean }) {
  return (
    <svg
      className={`${className ?? ""} ${expanded ? "rotate-180" : ""} transition-transform duration-200`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

/** Articles shown under an expanded topic row (proof for velocity / acceleration). */
function ArticleProofList({ articles }: { articles: TopicDetailArticle[] }) {
  const sorted = useMemo(() => {
    return [...articles].sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });
  }, [articles]);

  if (sorted.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-gray-500">No active evidence articles in this window.</p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800/90 bg-gray-950/90">
      <p className="border-b border-gray-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Active evidence articles ({sorted.length})
      </p>
      <ul className="max-h-[min(400px,55vh)] divide-y divide-gray-800/80 overflow-y-auto">
        {sorted.map((a) => (
          <li key={a.id} className="px-3 py-2.5">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              {a.title}
            </a>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {articleSourceLabel(a)} · {fmtPublished(a.published_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Primary cluster cell: domain + subdomain on one line, topic title, rationale, subdomain AI. */
function TopicClusterCell({
  row,
  rowBusy,
  onSuggestSubdomain,
  onOpenDetail,
}: {
  row: TopicRow;
  rowBusy: boolean;
  onSuggestSubdomain: (id: number) => void;
  onOpenDetail: (id: number) => void;
}) {
  return (
    <div className="min-w-0 max-w-md">
      <div className="flex flex-wrap items-center gap-2">
        <DomainPill domain={row.domain} />
        <SubdomainPill text={row.subdomain} />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(row.id);
        }}
        className="mt-1.5 block w-full text-left font-semibold text-white hover:text-indigo-200"
      >
        {row.name}
      </button>
      {row.signal_rationale?.trim() ? (
        <p className="mt-1 line-clamp-2 text-xs italic text-gray-500">{row.signal_rationale}</p>
      ) : null}
      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={rowBusy}
          onClick={() => void onSuggestSubdomain(row.id)}
          className="text-[10px] font-medium text-cyan-400/90 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Optional: re-run sub-domain from this topic’s articles if auto-fill after ingest missed it (or to retry after API issues). Normal flow: Process raw articles fills sub-domains when DEEPSEEK_API_KEY is set."
        >
          {rowBusy ? "…" : "Refresh sub-domain"}
        </button>
      </div>
    </div>
  );
}

const topicToolbarBtn =
  "inline-flex items-center justify-center rounded border border-gray-700/90 bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50";

function VelocityMini({
  velocity,
  acceleration,
  velocityTitle,
  accelerationTitle,
}: {
  velocity: number | null;
  acceleration: number | null;
  velocityTitle?: string;
  accelerationTitle?: string;
}) {
  const v = typeof velocity === "number" && !Number.isNaN(velocity) ? velocity : 0;
  const a = typeof acceleration === "number" && !Number.isNaN(acceleration) ? acceleration : 0;
  const vh = Math.min(100, Math.max(8, (v / 12) * 100));
  const ah = Math.min(100, Math.max(8, (a / 4) * 100));
  return (
    <div className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Velocity (coverage window)
        </span>
        <div className="flex h-14 items-end rounded-md bg-gray-800/80 px-2 pt-2">
          <div
            className="w-full min-h-[6px] rounded-sm bg-indigo-500/90 transition-[height]"
            style={{ height: `${vh}%` }}
            title={velocityTitle ?? `${v.toFixed(1)} articles in the primary window`}
          />
        </div>
        <span
          className="cursor-help text-center text-xs tabular-nums text-indigo-300 underline decoration-dotted decoration-indigo-400/50 underline-offset-2"
          title={velocityTitle}
        >
          {fmtOneDecimal(velocity)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Acceleration</span>
        <div className="flex h-14 items-end rounded-md bg-gray-800/80 px-2 pt-2">
          <div
            className="w-full min-h-[6px] rounded-sm bg-amber-500/90 transition-[height]"
            style={{ height: `${ah}%` }}
            title={accelerationTitle ?? `${a.toFixed(2)}× vs prior window`}
          />
        </div>
        <span
          className="cursor-help text-center text-xs tabular-nums text-amber-300 underline decoration-dotted decoration-amber-400/50 underline-offset-2"
          title={accelerationTitle}
        >
          {acceleration === null || Number.isNaN(acceleration) ? "—" : `${acceleration.toFixed(1)}×`}
        </span>
      </div>
    </div>
  );
}

type SortColumn = "velocity" | "acceleration" | "articles" | "latest_article";

function SubdomainPill({ text }: { text: string | null | undefined }) {
  const s = (text || "").trim();
  if (!s) {
    return <span className="text-xs text-gray-600">—</span>;
  }
  return (
    <span
      className="inline-flex max-w-[160px] truncate rounded-md bg-gray-800/80 px-2 py-0.5 text-xs text-gray-300 ring-1 ring-gray-700"
      title={s}
    >
      {s}
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortColumn,
  sortDir,
  onSort,
  headerTitle,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDir: "asc" | "desc";
  onSort: (c: SortColumn) => void;
  /** Optional: longer hint for column meaning (shown on hover over header). */
  headerTitle?: string;
}) {
  const active = sortColumn === column;
  return (
    <th className="px-3 py-3">
      <button
        type="button"
        title={headerTitle}
        onClick={(e) => {
          e.stopPropagation();
          onSort(column);
        }}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-gray-300 ${
          active ? "text-indigo-300" : "text-gray-500"
        }`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function TrendPickBadge({ action }: { action: string | null | undefined }) {
  const a = (action ?? "").toLowerCase();
  const label =
    a === "radar" ? "Radar" : a === "remove" ? "Remove" : a === "watch" ? "Watch" : null;
  if (!label) {
    return <span className="text-gray-600">—</span>;
  }
  const cls =
    a === "radar"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : a === "remove"
        ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
        : "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
      title="Suggestion: Watch (track), Radar (pipeline), or Remove — from Claude Haiku using topic + recent articles"
    >
      {label}
    </span>
  );
}

function TrendDiscoveryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<TabId>("pending");

  useEffect(() => {
    const q = searchParams.get("tab");
    if (q === "approved") {
      setTabState("radar");
      router.replace("/admin?tab=radar", { scroll: false });
      return;
    }
    if (q && TAB_IDS.has(q as TabId)) {
      setTabState(q as TabId);
    }
  }, [searchParams, router]);

  function setTab(next: TabId) {
    setTabState(next);
    router.replace(`/admin?tab=${next}`, { scroll: false });
  }

  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Short-lived confirmation so Analyze / Refresh sub-domain feel responsive (no visible change if data unchanged). */
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [watchingId, setWatchingId] = useState<number | null>(null);
  const [unwatchingId, setUnwatchingId] = useState<number | null>(null);
  const [demotingId, setDemotingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [subdomainSuggestingId, setSubdomainSuggestingId] = useState<number | null>(null);
  const [subdomainBulkBusy, setSubdomainBulkBusy] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [topicDetail, setTopicDetail] = useState<TopicDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterSubdomain, setFilterSubdomain] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("velocity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pipelineWindows, setPipelineWindows] =
    useState<PipelineTrendWindows>(DEFAULT_TREND_WINDOWS);
  /** Expanded topic rows → show active evidence articles */
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [topicArticles, setTopicArticles] = useState<Record<number, TopicDetailArticle[]>>({});
  const [topicArticlesLoadingId, setTopicArticlesLoadingId] = useState<number | null>(null);
  const articleFetchInflight = useRef<Set<number>>(new Set());
  const articlesLoadedRef = useRef<Set<number>>(new Set());
  const loadTopicsRequestRef = useRef(0);
  const selectedTopicIdRef = useRef<number | null>(null);
  selectedTopicIdRef.current = selectedTopicId;

  const statusParam =
    tab === "pending" ? "pending" : tab === "watching" ? "watched" : "selected";

  const loadTopics = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = opts?.quiet === true;
    const requestId = loadTopicsRequestRef.current + 1;
    loadTopicsRequestRef.current = requestId;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics?status=${statusParam}`);
      if (loadTopicsRequestRef.current !== requestId) return;
      if (!res.ok) {
        if (!quiet) {
          setError(await res.text().catch(() => res.statusText));
          setTopics([]);
        }
        return;
      }
      const data = (await res.json()) as TopicRow[];
      if (loadTopicsRequestRef.current !== requestId) return;
      setTopics(Array.isArray(data) ? data : []);
    } catch (e) {
      if (loadTopicsRequestRef.current !== requestId) return;
      if (!quiet) {
        setError(e instanceof Error ? e.message : "Request failed");
        setTopics([]);
      }
    } finally {
      if (loadTopicsRequestRef.current !== requestId) return;
      if (!quiet) setLoading(false);
    }
  }, [statusParam]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/admin/settings`);
        if (!res.ok) return;
        const data = (await res.json()) as Partial<PipelineTrendWindows>;
        setPipelineWindows({
          trend_window_days:
            typeof data.trend_window_days === "number" && data.trend_window_days > 0
              ? data.trend_window_days
              : DEFAULT_TREND_WINDOWS.trend_window_days,
          trend_prior_window_days:
            typeof data.trend_prior_window_days === "number" && data.trend_prior_window_days > 0
              ? data.trend_prior_window_days
              : DEFAULT_TREND_WINDOWS.trend_prior_window_days,
        });
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  useEffect(() => {
    setExpandedRows({});
    setTopicArticles({});
    setTopicArticlesLoadingId(null);
    articleFetchInflight.current.clear();
    articlesLoadedRef.current.clear();
  }, [statusParam]);

  const ensureTopicArticles = useCallback(async (id: number) => {
    if (articlesLoadedRef.current.has(id) || articleFetchInflight.current.has(id)) return;
    articleFetchInflight.current.add(id);
    setTopicArticlesLoadingId(id);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}`);
      if (res.ok) {
        const data = (await res.json()) as TopicDetailResponse;
        const arts = data.articles ?? [];
        setTopicArticles((c) => ({ ...c, [id]: arts }));
      } else {
        setTopicArticles((c) => ({ ...c, [id]: [] }));
      }
      articlesLoadedRef.current.add(id);
    } catch {
      setTopicArticles((c) => ({ ...c, [id]: [] }));
      articlesLoadedRef.current.add(id);
    } finally {
      articleFetchInflight.current.delete(id);
      setTopicArticlesLoadingId((cur) => (cur === id ? null : cur));
    }
  }, []);

  const toggleTopicExpanded = useCallback(
    (id: number) => {
      setExpandedRows((prev) => {
        const nextOpen = !prev[id];
        if (nextOpen) void ensureTopicArticles(id);
        return { ...prev, [id]: nextOpen };
      });
    },
    [ensureTopicArticles],
  );

  useEffect(() => {
    setSelectedIds(new Set());
    setMergeOpen(false);
    setSelectedTopicId(null);
    setTopicDetail(null);
  }, [tab]);

  useEffect(() => {
    if (selectedTopicId === null) {
      setTopicDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/admin/topics/${selectedTopicId}`);
        if (cancelled) return;
        if (!res.ok) {
          setDetailError("Could not load topic detail.");
          setTopicDetail(null);
          return;
        }
        const data = (await res.json()) as TopicDetailResponse;
        if (!cancelled) setTopicDetail(data);
      } catch {
        if (!cancelled) {
          setDetailError("Could not load topic detail.");
          setTopicDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedTopicId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedTopicId === null) {
      setDrawerEntered(false);
      return;
    }
    setDrawerEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [selectedTopicId]);

  const displayedTopics = useMemo(() => {
    const list = topics.filter((t) => {
      if (t.status !== statusParam) return false;
      if (filterDomain && t.domain !== filterDomain) return false;
      const sub = (t.subdomain || "").trim();
      if (filterSubdomain) {
        if (filterSubdomain === "__general__") {
          if (sub.length > 0) return false;
        } else if (sub !== filterSubdomain) return false;
      }
      if (filterAction) {
        const a = (t.signal_suggested_action || "").toLowerCase();
        if (a !== filterAction) return false;
      }
      return true;
    });
    const latestTime = (row: TopicRow): number | null => {
      const iso = row.latest_article_at;
      if (!iso) return null;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? null : t;
    };
    const cmp = (a: TopicRow, b: TopicRow) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let delta = 0;
      if (sortColumn === "velocity") {
        delta = (a.velocity_score ?? -1) - (b.velocity_score ?? -1);
      } else if (sortColumn === "acceleration") {
        delta = (a.acceleration_score ?? -1) - (b.acceleration_score ?? -1);
      } else if (sortColumn === "latest_article") {
        const ta = latestTime(a);
        const tb = latestTime(b);
        if (ta === null && tb === null) delta = 0;
        else if (ta === null) delta = 1;
        else if (tb === null) delta = -1;
        else delta = ta - tb;
      } else {
        delta = a.article_count - b.article_count;
      }
      if (delta !== 0) return delta * dir;
      return a.name.localeCompare(b.name);
    };
    return [...list].sort(cmp);
  }, [topics, statusParam, filterDomain, filterSubdomain, filterAction, sortColumn, sortDir]);

  const domainOptions = useMemo(() => {
    const s = new Set(topics.map((t) => t.domain));
    return [...s].sort();
  }, [topics]);

  const subdomainOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of topics) {
      const u = (t.subdomain || "").trim();
      if (u) s.add(u);
    }
    return [...s].sort();
  }, [topics]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDir("desc");
    }
  }

  const checkedTopics = useMemo(() => {
    return topics.filter((t) => selectedIds.has(t.id));
  }, [topics, selectedIds]);

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllPending(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(displayedTopics.map((t) => t.id)));
  }

  async function approveTopic(id: number) {
    setApprovingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setSelectedTopicId((cur) => (cur === id ? null : cur));
      await loadTopics();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApprovingId(null);
    }
  }

  async function watchTopic(id: number) {
    setWatchingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/watch`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setSelectedTopicId((cur) => (cur === id ? null : cur));
      await loadTopics();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Watch failed");
    } finally {
      setWatchingId(null);
    }
  }

  async function unwatchTopic(id: number) {
    setUnwatchingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/unwatch`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setSelectedTopicId((cur) => (cur === id ? null : cur));
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove from watchlist failed");
    } finally {
      setUnwatchingId(null);
    }
  }

  async function demoteTopic(id: number) {
    const row = topics.find((t) => t.id === id);
    if (row && row.status !== "selected") {
      setError("Only topics that are actually on radar can be demoted. Refreshing the list.");
      await loadTopics();
      return;
    }
    setDemotingId(id);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/deselect`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setSelectedTopicId((cur) => (cur === id ? null : cur));
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demote failed");
    } finally {
      setDemotingId(null);
    }
  }

  async function analyzeTopicTrend(id: number) {
    setAnalyzingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/trend-analysis`, {
        method: "POST",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        setError(t);
        return;
      }
      await loadTopics();
      setActionSuccess(
        "Analyze: updated Watch / Radar / Remove suggestion and rationale (see Suggestion column and italic text under the topic).",
      );
      window.setTimeout(() => setActionSuccess(null), 8000);
      if (selectedTopicIdRef.current === id) {
        const detailRes = await adminFetch(`${API_BASE}/api/admin/topics/${id}`);
        if (detailRes.ok) {
          setTopicDetail((await detailRes.json()) as TopicDetailResponse);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function runBulkTrendAnalysis() {
    setBulkAnalyzing(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/jobs/trend-analysis`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      // Server runs one topic at a time in a background thread; release the button and poll quietly.
      await loadTopics({ quiet: true });
      void (async () => {
        for (let i = 0; i < 36; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          await loadTopics({ quiet: true });
        }
      })();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk analysis failed");
    } finally {
      setBulkAnalyzing(false);
    }
  }

  async function suggestSubdomainForRow(id: number) {
    setSubdomainSuggestingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${id}/suggest-subdomain`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      await loadTopics();
      setActionSuccess("Sub-domain refreshed (grey pill next to the domain badge).");
      window.setTimeout(() => setActionSuccess(null), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sub-domain suggestion failed");
    } finally {
      setSubdomainSuggestingId(null);
    }
  }

  async function runBulkSubdomainClassification() {
    const candidates = (() => {
      if (selectedIds.size > 0) {
        return topics
          .filter((t) => selectedIds.has(t.id) && !(t.subdomain || "").trim())
          .map((t) => t.id);
      }
      return displayedTopics.filter((t) => !(t.subdomain || "").trim()).map((t) => t.id);
    })();
    if (candidates.length === 0) {
      setError(
        selectedIds.size > 0
          ? "No selected topics are missing a sub-domain, or none selected. Clear selection to fill all empty rows in this tab."
          : "No topics in this view are missing a sub-domain.",
      );
      return;
    }
    const capped = candidates.slice(0, 50);
    setSubdomainBulkBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/bulk-suggest-subdomains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_ids: capped }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      const data = (await res.json()) as { errors?: { id: number; detail: string }[] };
      if (data.errors?.length) {
        setError(`${data.errors.length} topic(s) could not get a sub-domain (see server logs).`);
      }
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk sub-domain labelling failed");
    } finally {
      setSubdomainBulkBusy(false);
    }
  }

  async function submitMerge() {
    if (mergeTargetId === null || checkedTopics.length < 2) return;
    const source_topic_ids = checkedTopics.map((t) => t.id).filter((id) => id !== mergeTargetId);
    if (source_topic_ids.length === 0) {
      setError("Choose a target that is not the only selected topic.");
      return;
    }
    setMerging(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/merge`, {
        method: "POST",
        body: JSON.stringify({ source_topic_ids, target_topic_id: mergeTargetId }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => res.statusText));
        return;
      }
      setMergeOpen(false);
      setSelectedIds(new Set());
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  function openMergeModal() {
    const first = checkedTopics[0];
    setMergeTargetId(first?.id ?? null);
    setMergeOpen(true);
  }

  const allPendingSelected =
    tab === "pending" &&
    displayedTopics.length > 0 &&
    displayedTopics.every((t) => selectedIds.has(t.id));

  const selectedRow = useMemo(
    () => (selectedTopicId === null ? undefined : topics.find((t) => t.id === selectedTopicId)),
    [topics, selectedTopicId],
  );

  const sortedDrawerArticles = useMemo(() => {
    const list = topicDetail?.articles ?? [];
    return [...list].sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });
  }, [topicDetail?.articles]);

  const velocityHeaderHint = useMemo(
    () =>
      `Sort by active evidence article count (primary + prior window, coverage time). Hover a cell for details.`,
    [],
  );
  const accelerationHeaderHint = useMemo(
    () =>
      `Sort by acceleration vs the ${pipelineWindows.trend_prior_window_days} days before that. Hover a cell for details.`,
    [pipelineWindows.trend_prior_window_days],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Trend Discovery</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          Each row is one topic cluster: domain and sub-domain on the first line with velocity, acceleration, and active
          evidence count. Use the chevron to expand and see evidence-window articles. Sort the table by velocity,
          acceleration, or evidence count. Sub-domains are{" "}
          <strong className="text-gray-300">filled automatically</strong> when articles are processed (ingestion); use{" "}
          <span className="text-gray-300">Refresh sub-domain</span> or <span className="text-gray-300">AI sub-domains (group)</span>{" "}
          only if you need a manual retry. If rows stay under <span className="text-gray-300">General</span>, run{" "}
          <span className="text-gray-300">System Jobs → Process Raw Articles</span> (or RSS Ingestion); labeling needs{" "}
          <span className="text-gray-300">DEEPSEEK_API_KEY</span>.{" "}
          <strong className="text-gray-300">Velocity</strong> counts articles in the rolling window using{" "}
          <strong className="text-gray-300">coverage time</strong> — publish date when available, otherwise when Pulse
          stored the RSS row (UTC). That keeps old RSS backlog out of current velocity and the{" "}
          <strong className="text-gray-300">Latest article</strong> column better than ingest-only. Window length
          comes from <span className="text-gray-300">Admin → Settings</span> (defaults: 7 + 7 days). Evidence older than
          the active window is archived, not deleted. It can still be{" "}
          <strong className="text-gray-300">0</strong> when no stories fall inside the window.{" "}
          <strong className="text-gray-300">Acceleration</strong> is velocity divided by
          the prior window&apos;s count.{" "}
          <strong className="text-gray-300">Suggestion</strong> is <strong className="text-gray-300">Watch</strong> /{" "}
          <strong className="text-gray-300">Radar</strong> / <strong className="text-gray-300">Remove</strong> from Claude Haiku
          (topic status + recent article blurbs). It auto-fills after RSS ingestion and in the daily signal job for topics
          that do not have one yet; use <span className="text-gray-300">AI analyze</span> to refresh a row. High-velocity
          topics also get scored via a separate threshold job. Per-industry adoption is in Analysis.{" "}
          <span className="text-gray-300">Approve</span> moves candidates toward the radar list.
        </p>
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {actionSuccess && (
        <div
          className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
          role="status"
        >
          {actionSuccess}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-gray-800 pb-4">
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/80 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            onClick={() => setTab("pending")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "pending" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "watching"}
            onClick={() => setTab("watching")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "watching" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            Watching
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "radar"}
            onClick={() => setTab("radar")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "radar" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            On radar
          </button>
        </div>

        {tab === "pending" && checkedTopics.length >= 2 && (
          <button
            type="button"
            onClick={openMergeModal}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Merge selected ({checkedTopics.length})
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {topics.length > 0 && (
            <button
              type="button"
              disabled={subdomainBulkBusy}
              onClick={() => void runBulkSubdomainClassification()}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {subdomainBulkBusy ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Labelling sub-domains…
                </>
              ) : (
                "AI sub-domains (group)"
              )}
            </button>
          )}
          {(tab === "pending" || tab === "watching") && topics.length > 0 && (
            <button
              type="button"
              disabled={bulkAnalyzing}
              onClick={() => void runBulkTrendAnalysis()}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkAnalyzing ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Queueing…
                </>
              ) : (
                "Run AI analysis (pending & watching)"
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Domain
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="min-w-[140px] rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="">All</option>
            {domainOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Sub-domain
          <select
            value={filterSubdomain}
            onChange={(e) => setFilterSubdomain(e.target.value)}
            className="min-w-[180px] rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="">All</option>
            <option value="__general__">General (none)</option>
            {subdomainOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Suggestion
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="min-w-[120px] rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="">All</option>
            <option value="watch">Watch</option>
            <option value="radar">Radar</option>
            <option value="remove">Remove</option>
          </select>
        </label>
        {(filterDomain || filterSubdomain || filterAction) && (
          <button
            type="button"
            onClick={() => {
              setFilterDomain("");
              setFilterSubdomain("");
              setFilterAction("");
            }}
            className="ml-auto text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">Loading topics…</p>
      ) : tab === "pending" ? (
        topics.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No pending topics. New clusters will appear here after signal ingestion.
          </p>
        ) : displayedTopics.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No topics match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-9 px-2 py-3" aria-hidden />
                  <th className="w-10 px-2 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500/40"
                      checked={allPendingSelected}
                      onChange={(e) => toggleAllPending(e.target.checked)}
                      title="Select all"
                    />
                  </th>
                  <th className="min-w-[220px] px-3 py-3">Domain · Sub-domain · Topic</th>
                  <SortHeader
                    label="Latest article"
                    column="latest_article"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Velocity"
                    column="velocity"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    headerTitle={velocityHeaderHint}
                  />
                  <SortHeader
                    label="Acceleration"
                    column="acceleration"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    headerTitle={accelerationHeaderHint}
                  />
                  <SortHeader
                    label="Evidence"
                    column="articles"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-3">Suggestion</th>
                  <th className="w-[140px] px-2 py-3 text-right font-semibold normal-case tracking-normal">
                    Tools
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {displayedTopics.map((row) => {
                  const expanded = !!expandedRows[row.id];
                  const rowBusy =
                    analyzingId === row.id ||
                    approvingId === row.id ||
                    watchingId === row.id ||
                    demotingId === row.id ||
                    subdomainSuggestingId === row.id ||
                    subdomainBulkBusy;
                  const arts = topicArticles[row.id];
                  const artsLoad = topicArticlesLoadingId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-l-2 transition-colors hover:bg-gray-900/40 ${
                          selectedTopicId === row.id
                            ? "border-indigo-500 bg-indigo-500/5"
                            : "border-transparent"
                        }`}
                      >
                        <td className="px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleTopicExpanded(row.id)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Hide evidence articles" : "Show evidence articles"}
                          >
                            <IconChevronDown className="h-4 w-4" expanded={expanded} />
                          </button>
                        </td>
                        <td className="px-2 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500/40"
                            checked={selectedIds.has(row.id)}
                            onChange={(e) => toggleRow(row.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <TopicClusterCell
                            row={row}
                            rowBusy={rowBusy}
                            onSuggestSubdomain={suggestSubdomainForRow}
                            onOpenDetail={setSelectedTopicId}
                          />
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-3 align-top text-xs text-gray-400"
                          title="Publication date of the most recent linked article (or ingest date if unknown)"
                        >
                          {fmtPublished(row.latest_article_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                          <MetricHint title={velocityTooltipText(row, pipelineWindows)}>
                            {fmtOneDecimal(row.velocity_score)}
                          </MetricHint>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                          {row.acceleration_score === null || Number.isNaN(row.acceleration_score) ? (
                            <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>—</MetricHint>
                          ) : (
                            <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>
                              {`${row.acceleration_score.toFixed(1)}x`}
                            </MetricHint>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">{row.article_count}</td>
                        <td className="px-3 py-3 align-top">
                          <TrendPickBadge action={row.signal_suggested_action} />
                        </td>
                        <td className="px-2 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex flex-wrap items-center justify-end gap-0.5">
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Re-run DeepSeek trend pick: fills Suggestion (Watch/Radar/Remove) and italic rationale. Needs DEEPSEEK_API_KEY."
                              onClick={() => void analyzeTopicTrend(row.id)}
                              className={`${topicToolbarBtn} border-indigo-500/40 text-indigo-200 hover:border-indigo-400`}
                            >
                              {analyzingId === row.id ? (
                                <Spinner className="h-3 w-3" />
                              ) : (
                                "Analyze"
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Watch"
                              onClick={() => void watchTopic(row.id)}
                              className={`${topicToolbarBtn} border-amber-500/35 text-amber-200/90`}
                            >
                              {watchingId === row.id ? <Spinner className="h-3 w-3" /> : "Watch"}
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Approve to radar"
                              onClick={() => void approveTopic(row.id)}
                              className={`${topicToolbarBtn} border-emerald-600/50 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/45`}
                            >
                              {approvingId === row.id ? <Spinner className="h-3 w-3" /> : "Radar"}
                            </button>
                            <Link
                              href={`/admin/topics/${row.id}`}
                              title="Edit topic"
                              className={`${topicToolbarBtn} border-gray-600 text-gray-400 hover:text-indigo-300`}
                            >
                              <IconPencil className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-gray-900/40">
                          <td colSpan={9} className="px-3 pb-4 pt-0">
                            <div className="ml-6 border-l border-gray-700 pl-4">
                              {artsLoad ? (
                                <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
                                  <Spinner className="h-4 w-4" />
                                  Loading articles…
                                </div>
                              ) : (
                                <ArticleProofList articles={arts ?? []} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "watching" ? (
        topics.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No watching topics. Use <span className="text-gray-400">Watch</span> from Pending to track candidates without
            adding them to the radar yet.
          </p>
        ) : displayedTopics.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No topics match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-9 px-2 py-3" aria-hidden />
                  <th className="min-w-[220px] px-3 py-3">Domain · Sub-domain · Topic</th>
                  <SortHeader
                    label="Latest article"
                    column="latest_article"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Velocity"
                    column="velocity"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    headerTitle={velocityHeaderHint}
                  />
                  <SortHeader
                    label="Acceleration"
                    column="acceleration"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    headerTitle={accelerationHeaderHint}
                  />
                  <SortHeader
                    label="Evidence"
                    column="articles"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-3">Suggestion</th>
                  <th className="w-[120px] px-2 py-3 text-right font-semibold normal-case tracking-normal">
                    Tools
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {displayedTopics.map((row) => {
                  const expanded = !!expandedRows[row.id];
                  const rowBusy =
                    analyzingId === row.id ||
                    approvingId === row.id ||
                    watchingId === row.id ||
                    unwatchingId === row.id ||
                    demotingId === row.id ||
                    subdomainSuggestingId === row.id ||
                    subdomainBulkBusy;
                  const arts = topicArticles[row.id];
                  const artsLoad = topicArticlesLoadingId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-l-2 transition-colors hover:bg-gray-900/40 ${
                          selectedTopicId === row.id ? "border-indigo-500 bg-indigo-500/5" : "border-transparent"
                        }`}
                      >
                        <td className="px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleTopicExpanded(row.id)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Hide evidence articles" : "Show evidence articles"}
                          >
                            <IconChevronDown className="h-4 w-4" expanded={expanded} />
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <TopicClusterCell
                            row={row}
                            rowBusy={rowBusy}
                            onSuggestSubdomain={suggestSubdomainForRow}
                            onOpenDetail={setSelectedTopicId}
                          />
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-3 align-top text-xs text-gray-400"
                          title="Publication date of the most recent linked article (or ingest date if unknown)"
                        >
                          {fmtPublished(row.latest_article_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                          <MetricHint title={velocityTooltipText(row, pipelineWindows)}>
                            {fmtOneDecimal(row.velocity_score)}
                          </MetricHint>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                          {row.acceleration_score === null || Number.isNaN(row.acceleration_score) ? (
                            <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>—</MetricHint>
                          ) : (
                            <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>
                              {`${row.acceleration_score.toFixed(1)}x`}
                            </MetricHint>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">{row.article_count}</td>
                        <td className="px-3 py-3 align-top">
                          <TrendPickBadge action={row.signal_suggested_action} />
                        </td>
                        <td className="px-2 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex flex-wrap items-center justify-end gap-0.5">
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Re-run DeepSeek trend pick: fills Suggestion (Watch/Radar/Remove) and italic rationale. Needs DEEPSEEK_API_KEY."
                              onClick={() => void analyzeTopicTrend(row.id)}
                              className={`${topicToolbarBtn} border-indigo-500/40 text-indigo-200 hover:border-indigo-400`}
                            >
                              {analyzingId === row.id ? <Spinner className="h-3 w-3" /> : "Analyze"}
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Remove from watchlist (topic returns to Pending)"
                              onClick={() => void unwatchTopic(row.id)}
                              className={`${topicToolbarBtn} border-rose-500/45 text-rose-200/90 hover:border-rose-400`}
                            >
                              {unwatchingId === row.id ? <Spinner className="h-3 w-3" /> : "Unwatch"}
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              title="Approve to radar"
                              onClick={() => void approveTopic(row.id)}
                              className={`${topicToolbarBtn} border-emerald-600/50 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/45`}
                            >
                              {approvingId === row.id ? <Spinner className="h-3 w-3" /> : "Radar"}
                            </button>
                            <Link
                              href={`/admin/topics/${row.id}`}
                              title="Edit topic"
                              className={`${topicToolbarBtn} border-gray-600 text-gray-400 hover:text-indigo-300`}
                            >
                              <IconPencil className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-gray-900/40">
                          <td colSpan={8} className="px-3 pb-4 pt-0">
                            <div className="ml-6 border-l border-gray-700 pl-4">
                              {artsLoad ? (
                                <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
                                  <Spinner className="h-4 w-4" />
                                  Loading articles…
                                </div>
                              ) : (
                                <ArticleProofList articles={arts ?? []} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : topics.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No topics on the radar yet. Approve items from Pending or Watching to add them here.
        </p>
      ) : displayedTopics.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No topics match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-9 px-2 py-3" aria-hidden />
                <th className="min-w-[220px] px-3 py-3">Domain · Sub-domain · Topic</th>
                <SortHeader
                  label="Latest article"
                  column="latest_article"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Velocity"
                  column="velocity"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  headerTitle={velocityHeaderHint}
                />
                <SortHeader
                  label="Acceleration"
                  column="acceleration"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  headerTitle={accelerationHeaderHint}
                />
                <SortHeader
                  label="Evidence"
                  column="articles"
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-3 py-3">Suggestion</th>
                <th className="px-3 py-3">Published</th>
                <th
                  className="whitespace-nowrap px-3 py-3"
                  title="Whole days since this topic was promoted to on-radar (approve / select)"
                >
                  Days on
                </th>
                <th className="w-[120px] px-2 py-3 text-right font-semibold normal-case tracking-normal">
                  Tools
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {displayedTopics.map((row) => {
                const expanded = !!expandedRows[row.id];
                const rowBusy =
                  analyzingId === row.id ||
                  approvingId === row.id ||
                  watchingId === row.id ||
                  unwatchingId === row.id ||
                  demotingId === row.id ||
                  subdomainSuggestingId === row.id ||
                  subdomainBulkBusy;
                const arts = topicArticles[row.id];
                const artsLoad = topicArticlesLoadingId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`border-l-2 transition-colors hover:bg-gray-900/40 ${
                        selectedTopicId === row.id ? "border-indigo-500 bg-indigo-500/5" : "border-transparent"
                      }`}
                    >
                      <td className="px-2 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => toggleTopicExpanded(row.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          aria-expanded={expanded}
                          aria-label={expanded ? "Hide evidence articles" : "Show evidence articles"}
                        >
                          <IconChevronDown className="h-4 w-4" expanded={expanded} />
                        </button>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <TopicClusterCell
                          row={row}
                          rowBusy={rowBusy}
                          onSuggestSubdomain={suggestSubdomainForRow}
                          onOpenDetail={setSelectedTopicId}
                        />
                      </td>
                      <td
                        className="whitespace-nowrap px-3 py-3 align-top text-xs text-gray-400"
                        title="Publication date of the most recent linked article (or ingest date if unknown)"
                      >
                        {fmtPublished(row.latest_article_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                        <MetricHint title={velocityTooltipText(row, pipelineWindows)}>
                          {fmtOneDecimal(row.velocity_score)}
                        </MetricHint>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">
                        {row.acceleration_score === null || Number.isNaN(row.acceleration_score) ? (
                          <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>—</MetricHint>
                        ) : (
                          <MetricHint title={accelerationTooltipText(row, pipelineWindows)}>
                            {`${row.acceleration_score.toFixed(1)}x`}
                          </MetricHint>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-gray-300">{row.article_count}</td>
                      <td className="px-3 py-3 align-top">
                        <TrendPickBadge action={row.signal_suggested_action} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        {row.is_published ? (
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-gray-700">
                            No
                          </span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-gray-300"
                        title={
                          row.selected_at
                            ? `On radar since ${row.selected_at}`
                            : "Legacy row — promote again to start tracking days on radar"
                        }
                      >
                        {typeof row.days_on_radar === "number" ? row.days_on_radar : "—"}
                      </td>
                      <td className="px-2 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex flex-wrap items-center justify-end gap-0.5">
                          <button
                            type="button"
                            disabled={rowBusy}
                            title="Re-run DeepSeek trend pick: fills Suggestion (Watch/Radar/Remove) and italic rationale. Needs DEEPSEEK_API_KEY."
                            onClick={() => void analyzeTopicTrend(row.id)}
                            className={`${topicToolbarBtn} border-indigo-500/40 text-indigo-200 hover:border-indigo-400`}
                          >
                            {analyzingId === row.id ? <Spinner className="h-3 w-3" /> : "Analyze"}
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy}
                            title="Move back to Watching (unpublish)"
                            onClick={() => void demoteTopic(row.id)}
                            className={`${topicToolbarBtn} border-rose-500/40 text-rose-200/90`}
                          >
                            {demotingId === row.id ? <Spinner className="h-3 w-3" /> : "Demote"}
                          </button>
                          <Link
                            href={`/admin/topics/${row.id}`}
                            title="Edit topic"
                            className={`${topicToolbarBtn} border-gray-600 text-gray-400 hover:text-indigo-300`}
                          >
                            <IconPencil className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-gray-900/40">
                        <td colSpan={10} className="px-3 pb-4 pt-0">
                          <div className="ml-6 border-l border-gray-700 pl-4">
                            {artsLoad ? (
                              <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
                                <Spinner className="h-4 w-4" />
                                Loading articles…
                              </div>
                            ) : (
                              <ArticleProofList articles={arts ?? []} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTopicId !== null && (
        <div className="fixed inset-0 z-[45] flex justify-end" role="presentation">
          <button
            type="button"
            className="h-full min-h-0 flex-1 cursor-default bg-black/50"
            aria-label="Close detail panel"
            onClick={() => setSelectedTopicId(null)}
          />
          <aside
            className={`flex h-full w-full max-w-full shrink-0 flex-col border-l border-gray-800 bg-gray-950 shadow-2xl transition-transform duration-300 ease-out sm:w-[400px] sm:max-w-[400px] ${
              drawerEntered ? "translate-x-0" : "translate-x-full"
            }`}
            aria-labelledby="drawer-topic-title"
          >
            <div className="flex items-start justify-between gap-2 border-b border-gray-800 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="drawer-topic-title" className="text-lg font-semibold leading-tight text-white">
                  {selectedRow?.name ?? topicDetail?.name ?? "Topic"}
                </h2>
                {(selectedRow ?? topicDetail) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DomainPill domain={(selectedRow ?? topicDetail)!.domain} />
                    {(selectedRow ?? topicDetail)?.subdomain?.trim() ? (
                      <SubdomainPill text={(selectedRow ?? topicDetail)!.subdomain} />
                    ) : null}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopicId(null)}
                className="shrink-0 rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {detailLoading && <p className="text-sm text-gray-500">Loading details…</p>}
              {detailError && !detailLoading && (
                <p className="text-sm text-red-400" role="alert">
                  {detailError}
                </p>
              )}

              {selectedRow && (
                <>
                  <VelocityMini
                    velocity={selectedRow.velocity_score}
                    acceleration={selectedRow.acceleration_score}
                    velocityTitle={velocityTooltipText(selectedRow, pipelineWindows)}
                    accelerationTitle={accelerationTooltipText(selectedRow, pipelineWindows)}
                  />
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggestion</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TrendPickBadge action={selectedRow.signal_suggested_action} />
                    </div>
                    <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Rationale</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                      {selectedRow.signal_rationale?.trim() ||
                        "No AI rationale yet. Use “AI analyze” in the table to generate one."}
                    </p>
                  </div>
                </>
              )}

              <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Supporting articles
              </h3>
              {!detailLoading && !detailError && sortedDrawerArticles.length === 0 ? (
                <p className="text-sm text-gray-500">No articles linked to this topic.</p>
              ) : (
                <ul className="space-y-3">
                  {sortedDrawerArticles.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        {a.title}
                      </a>
                      <p className="mt-1 text-xs text-gray-500">
                        {articleSourceLabel(a)} · {fmtPublished(a.published_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(selectedRow?.status === "pending" || selectedRow?.status === "watched") && (
              <div className="border-t border-gray-800 px-4 py-3">
                <button
                  type="button"
                  disabled={approvingId === selectedTopicId}
                  onClick={() => selectedTopicId !== null && void approveTopic(selectedTopicId)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approvingId === selectedTopicId ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Approving…
                    </>
                  ) : (
                    "Approve to radar"
                  )}
                </button>
              </div>
            )}
            {selectedRow?.status === "watched" && (
              <div className="border-t border-gray-800 px-4 py-3">
                <button
                  type="button"
                  disabled={unwatchingId === selectedTopicId}
                  onClick={() => selectedTopicId !== null && void unwatchTopic(selectedTopicId)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/45 bg-rose-950/20 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-950/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unwatchingId === selectedTopicId ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Removing…
                    </>
                  ) : (
                    "Remove from watchlist"
                  )}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Merge topics</h2>
            <p className="mt-1 text-sm text-gray-400">Select the topic to keep. Other selected topics will be merged into it.</p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Target topic
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={mergeTargetId ?? ""}
              onChange={(e) => setMergeTargetId(Number(e.target.value))}
            >
              {checkedTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={merging || mergeTargetId === null}
                onClick={() => void submitMerge()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {merging ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Merging…
                  </>
                ) : (
                  "Merge"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendDiscoveryFallback() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-gray-500">Loading topics…</div>
  );
}

export default function TrendDiscoveryPage() {
  return (
    <Suspense fallback={<TrendDiscoveryFallback />}>
      <TrendDiscoveryInner />
    </Suspense>
  );
}

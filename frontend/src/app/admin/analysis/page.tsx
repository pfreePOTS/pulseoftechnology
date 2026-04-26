"use client";

import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { adminFetch, API_BASE } from "@/lib/api";
import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

const DOMAIN_COLORS: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400",
  Security: "bg-rose-500/20 text-rose-400",
  Cloud: "bg-sky-500/20 text-sky-400",
  Finance: "bg-emerald-500/20 text-emerald-400",
  Leadership: "bg-indigo-500/20 text-indigo-400",
};

/** Re-export for callers that imported from this module */
export { INDUSTRY_OPTIONS };

const ADOPTION_STATES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

const ADOPTION_DOT: Record<string, string> = {
  "Learn About": "bg-slate-400",
  "Get Ahead Of": "bg-sky-400",
  "Get Prepared For": "bg-amber-400",
  "Get Your Hands Around": "bg-orange-400",
  "Make the Most Of": "bg-emerald-400",
};

function formatAdminTimestamp(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface IndustryPosition {
  impact_score?: number;
  risk_level?: number;
  adoption_state: string;
  /** @deprecated Prefer industry_impact; still shown as fallback */
  rationale?: string;
  industry_impact?: string;
  scoring_rationale?: string;
  phase_rationale?: string;
  remediation?: string;
  impact_approved?: boolean;
}

interface TopicRow {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  /** Saved topic-level persona copy; when set, overrides article aggregation in this UI. */
  persona_by_role?: Record<string, string> | null;
  article_count: number;
  is_published: boolean;
}

interface ArticleDetail {
  id: number;
  persona_impacts: Record<string, string> | null;
}

interface TopicDetail {
  articles: ArticleDetail[];
}

interface RoleRow {
  id: number;
  name: string;
}

/** Merge lines from each linked article’s `persona_impacts` (set during RSS → AI processing). */
function aggregatePersonaFromArticles(
  articles: ArticleDetail[],
  roleNames: string[],
): Record<string, string> {
  const byRole: Record<string, string> = {};
  for (const role of roleNames) {
    const texts: string[] = [];
    for (const art of articles) {
      const pi = art.persona_impacts;
      if (pi && typeof pi === "object" && role in pi) {
        const s = String((pi as Record<string, string>)[role] ?? "").trim();
        if (s) texts.push(s);
      }
    }
    byRole[role] = texts.length ? [...new Set(texts)].join(" · ") : "";
  }
  return byRole;
}

/** Prefer saved topic-level persona when present; otherwise show article aggregate. */
function buildPersonaDraft(
  topic: TopicRow,
  articles: ArticleDetail[],
  roleNames: string[],
): Record<string, string> {
  const agg = aggregatePersonaFromArticles(articles, roleNames);
  const o = topic.persona_by_role;
  if (o && typeof o === "object" && Object.keys(o).length > 0) {
    const out: Record<string, string> = {};
    for (const r of roleNames) {
      const v = o[r];
      out[r] = typeof v === "string" && v.trim() ? v : (agg[r] ?? "");
    }
    return out;
  }
  return agg;
}

function clonePositions(
  raw: Record<string, IndustryPosition> | null | undefined,
): Record<string, IndustryPosition> {
  if (!raw) return {};
  const out: Record<string, IndustryPosition> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = { ...v };
  }
  return out;
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CollapsibleHelpBlock({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  const panelId = `${id}-panel`;
  return (
    <div>
      <button
        type="button"
        id={headingId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg text-left text-xs font-semibold uppercase tracking-wide text-gray-500 outline-none ring-pulse-teal/40 hover:text-gray-400 focus-visible:ring-2"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ease-out ${
            open ? "rotate-90" : ""
          }`}
        />
        <span>{title}</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className={open ? "mt-3" : "hidden"}
      >
        {children}
      </div>
    </div>
  );
}

function defaultIndustryRow(): IndustryPosition {
  return {
    adoption_state: ADOPTION_STATES[0],
    impact_score: 5,
    risk_level: 5,
    impact_approved: true,
  };
}

function impactHeatClass(impact: number): string {
  if (impact >= 9) return "bg-red-500/10";
  if (impact >= 6) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

/** Legend copy: phase dot colors match ADOPTION_DOT; cell tint matches impactHeatClass. */
const PHASE_DOT_LEGEND: { phase: string; dotClass: string }[] = [
  { phase: "Learn About", dotClass: "bg-slate-400" },
  { phase: "Get Ahead Of", dotClass: "bg-sky-400" },
  { phase: "Get Prepared For", dotClass: "bg-amber-400" },
  { phase: "Get Your Hands Around", dotClass: "bg-orange-400" },
  { phase: "Make the Most Of", dotClass: "bg-emerald-400" },
];

function IndustryDetailPanel({
  row,
  topicUrgency,
}: {
  row: IndustryPosition | undefined;
  topicUrgency: number;
}) {
  const impact = row?.impact_score ?? 5;
  const risk = row?.risk_level ?? 5;
  const phase =
    row?.adoption_state && ADOPTION_STATES.includes(row.adoption_state as (typeof ADOPTION_STATES)[number])
      ? row.adoption_state
      : ADOPTION_STATES[0];
  const industryImpact = row?.industry_impact?.trim() || row?.rationale?.trim() || "";
  const scoring = row?.scoring_rationale?.trim();
  const phaseWhy = row?.phase_rationale?.trim();
  const remediation = row?.remediation?.trim();
  const emptyHint =
    "No text stored for this section yet. Run “AI Suggest (all topics)” to regenerate structured detail from the latest prompt.";

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2.5 text-xs text-gray-400">
        <p className="font-semibold uppercase tracking-wide text-gray-500">Scores and phase (this cell)</p>
        <p className="mt-1.5 leading-relaxed text-gray-300">
          Impact{" "}
          <strong className="tabular-nums text-indigo-200">{impact.toFixed(1)}</strong>
          {" · "}
          Risk{" "}
          <strong className="tabular-nums text-amber-200/90">{risk.toFixed(1)}</strong>
          {" · "}
          Adoption phase <strong className="text-gray-100">{phase}</strong>
        </p>
        <p className="mt-2 text-[11px] leading-snug text-gray-500">
          Topic urgency (left column) is <strong className="text-amber-400/90">{topicUrgency.toFixed(1)}</strong> — a
          single topic-level signal from clustering; per-industry Impact and Risk are set in each cell (AI or manual).
        </p>
      </div>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-pulse-teal">Industry impact</h4>
        <p className="mt-1.5 leading-relaxed text-gray-300">
          {industryImpact || emptyHint}
        </p>
      </section>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-pulse-teal">
          Why these scores
        </h4>
        <p className="mt-1.5 leading-relaxed text-gray-300">{scoring || emptyHint}</p>
      </section>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-pulse-teal">
          Why this adoption phase
        </h4>
        <p className="mt-1.5 leading-relaxed text-gray-300">{phaseWhy || emptyHint}</p>
      </section>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-pulse-teal">
          Recommended remediation
        </h4>
        <p className="mt-1.5 leading-relaxed text-gray-300">{remediation || emptyHint}</p>
      </section>
    </div>
  );
}

const ADOPTION_BORDER: Record<string, string> = {
  "Learn About": "border-l-slate-500",
  "Get Ahead Of": "border-l-sky-500",
  "Get Prepared For": "border-l-amber-500",
  "Get Your Hands Around": "border-l-orange-500",
  "Make the Most Of": "border-l-emerald-500",
};

export default function AnalysisPage() {
  const [gridLegendOpen, setGridLegendOpen] = useState(false);
  const [impactRiskHelpOpen, setImpactRiskHelpOpen] = useState(false);
  const [adoptionHelpOpen, setAdoptionHelpOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"industry" | "persona">("industry");
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Record<string, IndustryPosition>>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [suggestingAll, setSuggestingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rationaleOpen, setRationaleOpen] = useState<{ topicId: number; industry: string } | null>(
    null,
  );

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [personaDrafts, setPersonaDrafts] = useState<Record<number, Record<string, string>>>({});
  const [personaDirtyIds, setPersonaDirtyIds] = useState<Set<number>>(() => new Set());
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaSuggestingAll, setPersonaSuggestingAll] = useState(false);
  const [personaSavingAll, setPersonaSavingAll] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [serverJobHint, setServerJobHint] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/topics?status=selected`);
      if (!res.ok) {
        setLoadError("Could not load approved topics.");
        setTopics([]);
        setDrafts({});
        return;
      }
      const data: TopicRow[] = await res.json();
      setTopics(data);
      const d: Record<number, Record<string, IndustryPosition>> = {};
      for (const t of data) {
        d[t.id] = clonePositions(t.industry_positions);
      }
      setDrafts(d);
      setDirtyIds(new Set());
      setLastLoadedAt(new Date());
    } catch (e) {
      const msg =
        e instanceof TypeError
          ? `Cannot reach the API at ${API_BASE}. Start the backend (e.g. docker compose up from the repo root) or set NEXT_PUBLIC_API_URL.`
          : e instanceof Error
            ? e.message
            : "Network error.";
      setLoadError(msg);
      setTopics([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (mainTab !== "persona" || topics.length === 0) return;
    let cancelled = false;
    async function loadPersona() {
      setPersonaLoading(true);
      try {
        const rr = await adminFetch(`${API_BASE}/api/admin/roles`);
        if (!rr.ok || cancelled) return;
        const roleList: RoleRow[] = await rr.json();
        if (cancelled) return;
        setRoles(roleList);
        const roleNames = roleList.map((r) => r.name);
        const drafts: Record<number, Record<string, string>> = {};
        for (const t of topics) {
          const tr = await adminFetch(`${API_BASE}/api/admin/topics/${t.id}`);
          if (!tr.ok) continue;
          const detail: TopicDetail = await tr.json();
          drafts[t.id] = buildPersonaDraft(t, detail.articles ?? [], roleNames);
        }
        if (!cancelled) {
          setPersonaDrafts(drafts);
          setPersonaDirtyIds(new Set());
        }
      } catch (e) {
        if (!cancelled) {
          setActionError(
            e instanceof TypeError
              ? `Cannot reach the API at ${API_BASE}. Is the backend running?`
              : e instanceof Error
                ? e.message
                : "Failed to load persona data.",
          );
        }
      } finally {
        if (!cancelled) setPersonaLoading(false);
      }
    }
    void loadPersona();
    return () => {
      cancelled = true;
    };
  }, [mainTab, topics]);

  const markDirty = useCallback((topicId: number) => {
    setDirtyIds((prev) => new Set(prev).add(topicId));
  }, []);

  const updateCell = useCallback(
    (topicId: number, industry: string, patch: Partial<IndustryPosition>) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        const row = { ...(cur[industry] ?? defaultIndustryRow()), ...patch };
        cur[industry] = row;
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  const addIndustryCell = useCallback(
    (topicId: number, industry: string) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        if (cur[industry]) return prev;
        cur[industry] = defaultIndustryRow();
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  const removeIndustryCell = useCallback(
    (topicId: number, industry: string) => {
      setDrafts((prev) => {
        const cur = { ...prev[topicId] };
        delete cur[industry];
        return { ...prev, [topicId]: cur };
      });
      markDirty(topicId);
    },
    [markDirty],
  );

  /** Turn Radar (impact_approved) on or off for every filled cell in this topic row. */
  const setRowRadarApproved = useCallback(
    (topicId: number, approved: boolean) => {
      let didChange = false;
      setDrafts((prev) => {
        const row = prev[topicId];
        if (!row || Object.keys(row).length === 0) return prev;
        const next: Record<string, IndustryPosition> = {};
        for (const [ind, pos] of Object.entries(row)) {
          const p = pos!;
          if (p.impact_approved !== approved) {
            next[ind] = { ...p, impact_approved: approved };
            didChange = true;
          } else {
            next[ind] = p;
          }
        }
        if (!didChange) return prev;
        return { ...prev, [topicId]: next };
      });
      if (didChange) markDirty(topicId);
    },
    [markDirty],
  );

  /** Turn Radar on or off for a given industry column across all topics that have that cell. */
  const setColumnRadarApproved = useCallback(
    (industry: string, approved: boolean) => {
      const touched: number[] = [];
      setDrafts((prev) => {
        let any = false;
        const out = { ...prev };
        for (const t of topics) {
          const row = prev[t.id]?.[industry];
          if (!row || row.impact_approved === approved) continue;
          any = true;
          touched.push(t.id);
          out[t.id] = { ...prev[t.id], [industry]: { ...row, impact_approved: approved } };
        }
        if (!any) return prev;
        return out;
      });
      if (touched.length === 0) return;
      setDirtyIds((prev) => {
        const next = new Set(prev);
        for (const id of touched) next.add(id);
        return next;
      });
    },
    [topics],
  );

  const saveTopic = useCallback(async (topicId: number) => {
    const industry_positions = drafts[topicId] ?? {};
    const res = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}`, {
      method: "PUT",
      body: JSON.stringify({ industry_positions }),
    });
    if (!res.ok) return false;
    const updated: TopicRow = await res.json();
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...updated } : t)));
    setDrafts((prev) => ({
      ...prev,
      [topicId]: clonePositions(updated.industry_positions),
    }));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    setLastSavedAt(new Date());
    return true;
  }, [drafts]);

  const saveAllDirty = useCallback(async () => {
    setActionError(null);
    setSavingAll(true);
    try {
      for (const id of dirtyIds) {
        const ok = await saveTopic(id);
        if (!ok) {
          setActionError(`Save failed for topic ${id}.`);
          return;
        }
      }
    } finally {
      setSavingAll(false);
    }
  }, [dirtyIds, saveTopic]);

  const runAiSuggestAll = useCallback(async () => {
    setActionError(null);
    setServerJobHint(null);
    setSuggestingAll(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/analysis/industry-suggest-all-background`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
              : "Could not start background job.";
        throw new Error(msg || "Could not start background job.");
      }
      const data: { message?: string } = await res.json().catch(() => ({}));
      setServerJobHint(
        data.message ??
          "Industry AI is running on the server. You can leave this page; use Refresh after a few minutes to load results.",
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "AI suggest failed.");
    } finally {
      setSuggestingAll(false);
    }
  }, []);

  const updatePersonaCell = useCallback((topicId: number, role: string, value: string) => {
    setPersonaDrafts((prev) => ({
      ...prev,
      [topicId]: { ...(prev[topicId] ?? {}), [role]: value },
    }));
    setPersonaDirtyIds((prev) => new Set(prev).add(topicId));
  }, []);

  const suggestPersonaForTopic = useCallback(async (topicId: number) => {
    const res = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}/suggest-persona-by-role`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
            : "AI persona suggestion failed.";
      throw new Error(msg || "AI persona suggestion failed.");
    }
    const data: { persona_by_role?: Record<string, string> } = await res.json();
    const raw = data.persona_by_role ?? {};
    setPersonaDrafts((prev) => ({
      ...prev,
      [topicId]: { ...(prev[topicId] ?? {}), ...raw },
    }));
    setPersonaDirtyIds((prev) => new Set(prev).add(topicId));
  }, []);

  const runAiSuggestPersonaAll = useCallback(async () => {
    setActionError(null);
    setServerJobHint(null);
    setPersonaSuggestingAll(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/api/admin/topics/analysis/persona-suggest-all-background`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
              : "Could not start background job.";
        throw new Error(msg || "Could not start background job.");
      }
      const data: { message?: string } = await res.json().catch(() => ({}));
      setServerJobHint(
        data.message ??
          "Persona AI is running on the server. You can leave this page; use Refresh after a few minutes to load results.",
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "AI persona suggest failed.");
    } finally {
      setPersonaSuggestingAll(false);
    }
  }, []);

  const savePersonaTopic = useCallback(async (topicId: number) => {
    const row = personaDrafts[topicId];
    if (!row) return false;
    const res = await adminFetch(`${API_BASE}/api/admin/topics/${topicId}`, {
      method: "PUT",
      body: JSON.stringify({ persona_by_role: row }),
    });
    if (!res.ok) return false;
    const updated: TopicRow = await res.json();
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...updated } : t)));
    setPersonaDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    setLastSavedAt(new Date());
    return true;
  }, [personaDrafts]);

  const saveAllPersonaDirty = useCallback(async () => {
    setActionError(null);
    setPersonaSavingAll(true);
    try {
      for (const id of personaDirtyIds) {
        const ok = await savePersonaTopic(id);
        if (!ok) {
          setActionError(`Save failed for topic ${id}.`);
          return;
        }
      }
    } finally {
      setPersonaSavingAll(false);
    }
  }, [personaDirtyIds, savePersonaTopic]);

  const clearAllPersonaOverrides = useCallback(async () => {
    if (
      !confirm(
        "Clear saved topic-level persona overrides for all topics on this page? You will see lines aggregated from articles again until you edit or run AI.",
      )
    ) {
      return;
    }
    setActionError(null);
    for (const t of topics) {
      const res = await adminFetch(`${API_BASE}/api/admin/topics/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ persona_by_role: null }),
      });
      if (!res.ok) {
        setActionError(`Could not clear topic ${t.id}.`);
        return;
      }
    }
    await loadTopics();
  }, [topics, loadTopics]);

  const reloadFromServer = useCallback(async () => {
    setActionError(null);
    await loadTopics();
  }, [loadTopics]);

  const nCols = INDUSTRY_OPTIONS.length;
  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `240px repeat(${nCols}, minmax(140px, 1fr))`,
      minWidth: `${240 + nCols * 160}px`,
    }),
    [nCols],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[min(100%,1920px)] px-4 py-8">
        <p className="text-sm text-gray-500">Loading topics…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[min(100%,1920px)] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analysis</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Industry positions for selected topics — spreadsheet view. Tab through Impact and Risk inputs to edit
            quickly. Use the <span className="text-gray-300">Grid legend</span> below for phase dot colors and impact
            heat; open the (i) on any cell for full scoring, phase, and remediation notes.
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/80 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "industry"}
            onClick={() => setMainTab("industry")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mainTab === "industry" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Industry Positions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "persona"}
            onClick={() => setMainTab("persona")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mainTab === "persona" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Persona Impacts
          </button>
        </div>
      </div>

      <aside
        className="mb-6 rounded-xl border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-300"
        aria-label="How Impact, Risk, and adoption stage work"
      >
        <CollapsibleHelpBlock
          id="analysis-grid-legend"
          title="Grid legend — dots and heat"
          open={gridLegendOpen}
          onToggle={() => setGridLegendOpen((v) => !v)}
        >
          <p className="text-gray-400">
            Two different visuals apply to each topic × industry cell. They are independent:{" "}
            <span className="font-medium text-gray-200">phase</span> is chosen (AI or dropdown) and does not auto-derive
            from Impact in code; <span className="font-medium text-gray-200">Impact</span> is its own 1–10 score.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-medium text-gray-200">Small dot beside the adoption dropdown</p>
              <p className="mt-1 text-gray-400">
                Color encodes the <span className="text-gray-300">adoption phase</span> only (which of the five stages
                this cell uses). It is not a traffic-light for risk or “good/bad.”
              </p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {PHASE_DOT_LEGEND.map(({ phase, dotClass }) => (
                  <li key={phase} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                    <span className="text-gray-300">{phase}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-200">Cell background tint</p>
              <p className="mt-1 text-gray-400">
                <span className="text-gray-300">Impact heat</span> for quick scanning: green-tint = lower impact (under
                6), amber = medium (6–8.9), red-tint = high (9+). This is separate from the phase dot and from Risk
                (shown as a number in the cell).
              </p>
            </div>
          </div>
        </CollapsibleHelpBlock>

        <div className="mt-5 border-t border-gray-800 pt-5">
        <CollapsibleHelpBlock
          id="analysis-impact-risk"
          title="Impact & risk"
          open={impactRiskHelpOpen}
          onToggle={() => setImpactRiskHelpOpen((v) => !v)}
        >
          <ul className="list-inside list-disc space-y-2 marker:text-gray-600">
            <li>
              <span className="font-medium text-gray-200">Impact (1–10)</span> — How strong the business or operational
              effect is for that industry.{" "}
              <span className="text-gray-400">10 = urgent, strategic “must act” importance.</span>
            </li>
            <li>
              <span className="font-medium text-gray-200">Risk (1–10)</span> — Exposure from regulation, compliance,
              cyber, safety, or market disruption for that industry.{" "}
              <span className="text-gray-400">10 = highest exposure.</span>
            </li>
            <li>
              <span className="font-medium text-gray-200">Where the numbers come from</span> — Nothing in the app adds,
              averages, or derives Impact or Risk from other cells (no spreadsheet-style formulas). They are{" "}
              <span className="text-gray-400">
                typed directly or filled by AI Suggest from the topic and linked articles using the rubric above
              </span>
              , each stored as a number from 1–10.
            </li>
            <li>
              <span className="font-medium text-gray-200">Public radar geometry</span> — Stars sit on{" "}
              <span className="text-gray-400">
                discrete rings by impact: ≤5 outer, then one ring inward for each band (5–6, 6–7, 7–8, 8–9), and 9+ in
                the centre zone
              </span>
              . Higher impact is closer to the centre. Risk is displayed in the panel but does not move the star.
            </li>
          </ul>
        </CollapsibleHelpBlock>

        <div className="mt-5 border-t border-gray-800 pt-5">
          <CollapsibleHelpBlock
            id="analysis-adoption-stage"
            title="Adoption stage (Learn About, Get Prepared For, …)"
            open={adoptionHelpOpen}
            onToggle={() => setAdoptionHelpOpen((v) => !v)}
          >
            <p className="text-gray-300">
              Each topic–industry cell uses <span className="font-medium text-gray-200">one of five fixed stages</span>.
              That stage is <span className="text-gray-400">not</span> derived from Impact or Risk in code—it is chosen
              the same way as those scores:{" "}
              <span className="text-gray-400">
                <strong className="font-medium text-gray-200">AI Suggest</strong> picks a stage per industry using the
                definitions below, or you set it with the dropdown
              </span>
              . On the public radar, the stage decides <span className="text-gray-400">which of the five spokes</span> the
              point sits on (how far along the adoption journey that industry is for this topic).
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 marker:text-gray-600 text-gray-400">
              <li>
                <span className="font-medium text-gray-300">Learn About</span> — Early awareness; little action needed
                yet.
              </li>
              <li>
                <span className="font-medium text-gray-300">Get Ahead Of</span> — Proactive positioning before the trend
                hits.
              </li>
              <li>
                <span className="font-medium text-gray-300">Get Prepared For</span> — Immediate planning required.
              </li>
              <li>
                <span className="font-medium text-gray-300">Get Your Hands Around</span> — Active implementation
                underway.
              </li>
              <li>
                <span className="font-medium text-gray-300">Make the Most Of</span> — Fully embraced; optimise for
                advantage.
              </li>
            </ul>
          </CollapsibleHelpBlock>
        </div>
        </div>

        {mainTab === "persona" ? (
          <p className="border-t border-gray-800 pt-4 text-xs text-gray-500">
            Persona tab: lines come from linked articles (ingestion AI) unless you save a topic-level override below.
          </p>
        ) : null}
      </aside>

      {actionError && (
        <div
          className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loadError && <p className="mb-4 text-sm text-red-400">{loadError}</p>}

      {rationaleOpen && (() => {
        const rt = topics.find((t) => t.id === rationaleOpen.topicId);
        const cell = drafts[rationaleOpen.topicId]?.[rationaleOpen.industry];
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rationale-dialog-title"
            onClick={() => setRationaleOpen(null)}
          >
            <div
              className="max-h-[min(85vh,640px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="rationale-dialog-title" className="text-lg font-semibold text-white">
                {rt?.name ?? "Topic"} — {rationaleOpen.industry}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Per-industry analysis for this cell. Populated by the Industry Positioning AI (or your saved edits). The
                (i) button opens this panel; the colored dot next to the phase dropdown shows adoption stage only; cell
                tint reflects Impact heat.
              </p>
              <div className="mt-4">
                <IndustryDetailPanel row={cell} topicUrgency={rt?.urgency_score ?? 0} />
              </div>
              <button
                type="button"
                className="mt-6 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
                onClick={() => setRationaleOpen(null)}
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

      {mainTab === "persona" ? (
        <>
          <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-400">
            <p className="font-medium text-gray-200">How this grid is populated</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 marker:text-gray-600">
              <li>
                <span className="text-gray-300">Default source:</span> Each RSS article runs through the ingestion AI
                pipeline; the summarize step can fill <code className="text-gray-500">persona_impacts</code> per role on
                the article. This page <span className="text-gray-300">merges</span> those lines across all articles
                linked to the topic (duplicates removed, joined with “ · ”).
              </li>
              <li>
                <span className="text-gray-300">Topic override:</span> Use <strong className="font-medium text-gray-200">AI Suggest</strong>{" "}
                to synthesize one line per role from the topic + articles (Haiku), or type directly.{" "}
                <strong className="font-medium text-gray-200">Save</strong> stores editorial copy on the topic and{" "}
                <span className="text-gray-300">replaces the article aggregate</span> for display here until you clear
                overrides.
              </li>
            </ul>
          </div>

          {personaLoading ? (
            <p className="text-sm text-gray-500">Loading persona data…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-gray-500">No selected topics yet.</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-gray-500">No role profiles defined. Add roles under Role Profiles.</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-950">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900">
                    <th className="sticky left-0 z-20 min-w-[220px] bg-gray-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Topic
                    </th>
                    {roles.map((r) => (
                      <th
                        key={r.id}
                        className="min-w-[180px] px-2 py-2 text-xs font-semibold text-gray-400"
                      >
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {topics.map((topic) => (
                    <tr key={topic.id} className="hover:bg-gray-900/50">
                      <td className="sticky left-0 z-10 bg-gray-950 px-3 py-2 align-top">
                        <p className="font-medium text-white">{topic.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              DOMAIN_COLORS[topic.domain] ?? "bg-slate-500/20 text-slate-400"
                            }`}
                          >
                            {topic.domain}
                          </span>
                          {topic.persona_by_role && Object.keys(topic.persona_by_role).length > 0 ? (
                            <span className="rounded bg-teal-950/60 px-2 py-0.5 text-[10px] font-medium text-teal-300">
                              Topic override
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={personaSuggestingAll}
                          onClick={() => {
                            setActionError(null);
                            void suggestPersonaForTopic(topic.id).catch((e) =>
                              setActionError(e instanceof Error ? e.message : "AI failed"),
                            );
                          }}
                          className="mt-2 rounded border border-gray-700 px-2 py-1 text-[10px] font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
                        >
                          AI (this topic)
                        </button>
                      </td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-2 py-2 align-top">
                          <textarea
                            value={personaDrafts[topic.id]?.[r.name] ?? ""}
                            onChange={(e) => updatePersonaCell(topic.id, r.name, e.target.value)}
                            rows={3}
                            className="w-full resize-y rounded border border-gray-700 bg-gray-900/90 px-2 py-1.5 text-xs leading-snug text-gray-300 placeholder:text-gray-600"
                            placeholder="—"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-800 px-3 py-3 text-xs text-gray-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={personaSuggestingAll || topics.length === 0}
                      onClick={() => {
                        setActionError(null);
                        void runAiSuggestPersonaAll().catch((e) =>
                          setActionError(e instanceof Error ? e.message : "AI failed"),
                        );
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {personaSuggestingAll ? "Starting…" : "AI Suggest (all topics)"}
                    </button>
                    <button
                      type="button"
                      disabled={personaSavingAll || personaDirtyIds.size === 0}
                      onClick={() => void saveAllPersonaDirty()}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {personaSavingAll ? "Saving…" : `Save persona${personaDirtyIds.size ? ` (${personaDirtyIds.size})` : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reloadFromServer()}
                      className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800"
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => void clearAllPersonaOverrides()}
                      className="rounded-lg border border-amber-900/60 px-3 py-1.5 text-sm font-medium text-amber-200/90 hover:bg-amber-950/40"
                    >
                      Clear topic overrides
                    </button>
                    {personaDirtyIds.size > 0 ? (
                      <span className="text-amber-400/90">{personaDirtyIds.size} topic(s) unsaved</span>
                    ) : null}
                  </div>
                  <div className="min-w-[min(100%,240px)] text-right text-[11px] leading-relaxed text-gray-500">
                    {lastLoadedAt ? (
                      <div>
                        Last loaded: <span className="text-gray-400">{formatAdminTimestamp(lastLoadedAt)}</span>
                      </div>
                    ) : null}
                    {lastSavedAt ? (
                      <div>
                        Last saved: <span className="text-gray-400">{formatAdminTimestamp(lastSavedAt)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {serverJobHint ? (
                  <p className="mt-2 text-xs leading-snug text-[#019E7C]/90">{serverJobHint}</p>
                ) : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {!loadError && topics.length === 0 && (
            <p className="text-sm text-gray-500">No selected topics yet. Select topics in the pipeline first.</p>
          )}

          {topics.length > 0 && (
            <>
              <div className="mb-4 max-h-[min(70vh,900px)] overflow-auto rounded-xl border border-gray-800 bg-gray-900/40">
                <div className="grid gap-px bg-gray-800 p-px" style={gridStyle}>
                  <div className="sticky top-0 left-0 z-[45] flex items-end border-b border-r border-gray-800 bg-gray-900 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Topic
                  </div>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <div
                      key={ind}
                      className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900 px-1 py-2 text-center text-[10px] font-semibold leading-tight text-gray-400"
                    >
                      {ind}
                    </div>
                  ))}

                  {topics.map((topic) => {
                    const domainClass = DOMAIN_COLORS[topic.domain] ?? "bg-slate-500/20 text-slate-400";
                    return (
                      <Fragment key={topic.id}>
                        <div className="sticky left-0 z-30 flex flex-col justify-center gap-1 border-b border-r border-gray-800 bg-gray-950 px-2 py-2">
                          <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${domainClass}`}>
                            {topic.domain}
                          </span>
                          <span className="line-clamp-2 text-sm font-medium leading-tight text-white">{topic.name}</span>
                          <span className="text-[10px] tabular-nums text-amber-400/90">
                            U {topic.urgency_score.toFixed(1)}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              title="Check Radar for every industry cell in this row that already exists"
                              onClick={() => setRowRadarApproved(topic.id, true)}
                              className="rounded border border-[#019E7C]/50 bg-[#019E7C]/10 px-1.5 py-0.5 text-[9px] font-medium text-teal-200/90 hover:bg-[#019E7C]/20"
                            >
                              All on radar
                            </button>
                            <button
                              type="button"
                              title="Uncheck Radar for every filled cell in this row"
                              onClick={() => setRowRadarApproved(topic.id, false)}
                              className="rounded border border-gray-700 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                            >
                              Clear row
                            </button>
                          </div>
                        </div>
                        {INDUSTRY_OPTIONS.map((industry) => {
                          const row = drafts[topic.id]?.[industry];
                          const has = !!row;
                          const impact = row?.impact_score ?? 5;
                          const risk = row?.risk_level ?? 5;
                          const state =
                            row?.adoption_state && ADOPTION_STATES.includes(row.adoption_state as (typeof ADOPTION_STATES)[number])
                              ? row.adoption_state
                              : ADOPTION_STATES[0];
                          const heat = impactHeatClass(impact);
                          const borderAdopt = ADOPTION_BORDER[state] ?? "border-l-gray-600";

                          if (!has) {
                            return (
                              <div
                                key={`${topic.id}-${industry}`}
                                className="flex min-h-[88px] items-center justify-center border-b border-gray-800 bg-gray-950/80 p-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => addIndustryCell(topic.id, industry)}
                                  className="rounded-md border border-dashed border-gray-700 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-indigo-500/50 hover:text-indigo-300"
                                >
                                  +
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`${topic.id}-${industry}`}
                              className={`relative border-b border-gray-800 p-1.5 ${heat} border-l-2 ${borderAdopt}`}
                            >
                              <button
                                type="button"
                                title="Open detail: scores, phase rationale, industry impact, remediation"
                                aria-label="Open per-industry analysis: scoring, phase, impact, remediation"
                                className="absolute left-0.5 top-0.5 z-10 rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-sky-400"
                                onClick={() => setRationaleOpen({ topicId: topic.id, industry })}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Remove industry"
                                className="absolute right-0.5 top-0.5 z-10 rounded p-0.5 text-[10px] leading-none text-gray-600 hover:bg-gray-800 hover:text-red-400"
                                onClick={() => removeIndustryCell(topic.id, industry)}
                              >
                                ×
                              </button>
                              <div className="mb-1 flex items-center gap-1 pr-4">
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${ADOPTION_DOT[state] ?? "bg-gray-500"}`}
                                  aria-hidden
                                />
                                <select
                                  value={state}
                                  onChange={(e) =>
                                    updateCell(topic.id, industry, { adoption_state: e.target.value })
                                  }
                                  className="w-full min-w-0 max-w-full truncate rounded border border-gray-700 bg-gray-900/90 py-0.5 pl-1 text-[10px] text-gray-200"
                                >
                                  {ADOPTION_STATES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <label className="flex flex-1 flex-col gap-0.5">
                                  <span className="text-[9px] uppercase text-gray-600">Imp</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={impact}
                                    onChange={(e) =>
                                      updateCell(topic.id, industry, {
                                        impact_score: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded border border-gray-700 bg-gray-900/90 px-1 py-0.5 text-[11px] tabular-nums text-indigo-200"
                                  />
                                </label>
                                <label className="flex flex-1 flex-col gap-0.5">
                                  <span className="text-[9px] uppercase text-gray-600">Risk</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={risk}
                                    onChange={(e) =>
                                      updateCell(topic.id, industry, {
                                        risk_level: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded border border-gray-700 bg-gray-900/90 px-1 py-0.5 text-[11px] tabular-nums text-amber-200"
                                  />
                                </label>
                              </div>
                              <label className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={row.impact_approved !== false}
                                  onChange={(e) =>
                                    updateCell(topic.id, industry, { impact_approved: e.target.checked })
                                  }
                                  className="rounded border-gray-600 bg-gray-900 text-indigo-500"
                                />
                                Radar
                              </label>
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}

                  <div className="sticky left-0 z-30 flex flex-col justify-center gap-1 border-t-2 border-gray-700 bg-gray-900 px-2 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Radar</span>
                    <span className="text-[9px] leading-snug text-gray-500">
                      Per column: turn Radar on or off for every topic that has this industry.
                    </span>
                  </div>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <div
                      key={`footer-radar-${industry}`}
                      className="flex flex-col items-stretch justify-center gap-1 border-t-2 border-gray-700 bg-gray-900/90 p-1.5"
                    >
                      <button
                        type="button"
                        title={`Check Radar for “${industry}” on every topic that has this column`}
                        onClick={() => setColumnRadarApproved(industry, true)}
                        className="w-full rounded border border-[#019E7C]/45 bg-[#019E7C]/10 px-1 py-1 text-[9px] font-medium leading-tight text-teal-100 hover:bg-[#019E7C]/20"
                      >
                        All on radar
                      </button>
                      <button
                        type="button"
                        title={`Uncheck Radar for “${industry}” on every topic that has this column`}
                        onClick={() => setColumnRadarApproved(industry, false)}
                        className="w-full rounded border border-gray-700 px-1 py-1 text-[9px] font-medium leading-tight text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                      >
                        Clear column
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-gray-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={suggestingAll || topics.length === 0}
                      onClick={() => {
                        setActionError(null);
                        void runAiSuggestAll().catch((e) =>
                          setActionError(e instanceof Error ? e.message : "AI failed"),
                        );
                      }}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestingAll ? "Starting…" : "AI Suggest (all topics)"}
                    </button>
                    <button
                      type="button"
                      disabled={savingAll || dirtyIds.size === 0}
                      onClick={() => void saveAllDirty()}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingAll ? "Saving…" : `Save all${dirtyIds.size ? ` (${dirtyIds.size})` : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reloadFromServer()}
                      className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
                    >
                      Refresh
                    </button>
                    {dirtyIds.size > 0 && (
                      <span className="text-xs text-amber-400/90">{dirtyIds.size} topic(s) with unsaved changes</span>
                    )}
                  </div>
                  <div className="min-w-[min(100%,240px)] text-right text-[11px] leading-relaxed text-gray-500">
                    {lastLoadedAt ? (
                      <div>
                        Last loaded: <span className="text-gray-400">{formatAdminTimestamp(lastLoadedAt)}</span>
                      </div>
                    ) : null}
                    {lastSavedAt ? (
                      <div>
                        Last saved: <span className="text-gray-400">{formatAdminTimestamp(lastSavedAt)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {serverJobHint ? (
                  <p className="mt-2 text-xs leading-snug text-[#019E7C]/90">{serverJobHint}</p>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

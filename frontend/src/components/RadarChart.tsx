"use client";

import { useMemo, useState } from "react";

import { industryColor, INDUSTRY_COLORS } from "@/lib/industryGrid";
import { scrollToSubscribe } from "@/lib/subscribeNavigation";

export { INDUSTRY_COLORS };

// ── Public types ───────────────────────────────────────────────────────────────

export interface IndustryPosition {
  /** @deprecated use impact_score — kept for older records */
  urgency_score?: number;
  /** 1–10 magnitude of impact for this industry (drives distance from centre) */
  impact_score?: number;
  /** 1–10 regulatory / threat / compliance exposure — higher pulls the star toward the centre */
  risk_level?: number;
  adoption_state: string;
  rationale?: string;
  /** When false, this industry row is hidden on the public radar until approved in Impact workbench */
  impact_approved?: boolean;
}

export interface RadarTopic {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  summary: string | null;
}

// ── Chart geometry ─────────────────────────────────────────────────────────────
/** Base 1.5 × 1.25 = 25% larger radar than previous shipped size */
const SCALE = 1.875;
const SIZE = 680 * SCALE;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 175 * SCALE;
const LABEL_R = MAX_R + 56 * SCALE;
const RADAR_PAD = 8 * SCALE;
const MIN_URGENCY_R = 30 * SCALE;
const STAR_OUTER_R = 14 * SCALE;
const STAR_INNER_R = 6 * SCALE;
const STAR_HALO_R = 24 * SCALE;
/** Hover/click target: tight to the star shape (visual halo stays large; hit area is not the halo). */
const STAR_HIT_R = STAR_OUTER_R * 1.22;
const STAR_HOVER_SCALE = 1.14;
const STAR_STROKE_W = 1.25 * SCALE;
const STAR_STROKE_HOVER_W = STAR_STROKE_W * 1.35;
const PILL_H = 22 * SCALE;
const PILL_RX = 11 * SCALE;
const PILL_FONT = 10.5 * SCALE;
const PILL_PAD_X = 24 * SCALE;
const AXIS_SPREAD_DEG = 30 * SCALE;
const AXIS_SPREAD_STEP = 6 * SCALE;

/** Fraction of viewBox height from top to the 12 o'clock pill top — aligns the side panel with “Learn About”. */
const RADAR_TOP_PILL_OFFSET_RATIO = (CY - LABEL_R - PILL_H / 2) / SIZE;

// Five adoption-state axes, clockwise from 12 o'clock (270°)
const ADOPTION_AXES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

// Domain accent colours (fallback when no industry_positions are set)
const DOMAIN_COLORS: Record<string, string> = {
  AI: "#7C3AED",
  Security: "#E91D24",
  Cloud: "#0284C7",
  Finance: "#019E7C",
  Leadership: "#D97706",
  Other: "#6B7280",
};

// Per-industry colours: `INDUSTRY_COLORS` + `industryColor()` from `@/lib/industryGrid`
const DEFAULT_COLOR = "#6B7280";

// ── Internal plot-point type ───────────────────────────────────────────────────

interface PlotPoint {
  key: string;
  topic: RadarTopic;
  /** Industry name if this is a per-industry star; null = topic-level fallback. */
  industry: string | null;
  color: string;
  urgency: number;
  adoptionState: string;
  rationale?: string;
}

interface PlotPointXY extends PlotPoint {
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Deterministic rounding for SVG attrs — avoids SSR/client float + number/string hydration mismatches. */
function svgCoord(n: number): number {
  return Number(n.toFixed(3));
}

function polarToXY(angleDeg: number, r: number): [number, number] {
  const rad = degToRad(angleDeg);
  const x = CX + r * Math.cos(rad);
  const y = CY + r * Math.sin(rad);
  return [svgCoord(x), svgCoord(y)];
}

const ADOPTION_STATE_INDEX: Record<string, number> = {
  "Learn About": 0,
  "Get Ahead Of": 1,
  "Get Prepared For": 2,
  "Get Your Hands Around": 3,
  "Make the Most Of": 4,
};

function adoptionStateToAxisIndex(state: string): number {
  return ADOPTION_STATE_INDEX[state] ?? 0;
}

/**
 * Discrete impact bands: higher impact sits closer to the centre (priority).
 * ≤5 outer · (5,6] · (6,7] · (7,8] · [8,9) · 9+ centre zone — one step inward per band.
 */
export function impactScoreToRadius(impact: number): number {
  const x = Math.min(10, Math.max(1, impact));
  let fracFromCentre: number;
  if (x >= 9) fracFromCentre = 0.16;
  else if (x >= 8) fracFromCentre = 0.33;
  else if (x >= 7) fracFromCentre = 0.5;
  else if (x >= 6) fracFromCentre = 0.67;
  else if (x > 5) fracFromCentre = 0.84;
  else fracFromCentre = 1.0;
  return Math.max(MIN_URGENCY_R, fracFromCentre * MAX_R);
}

/** Ring guide radii (fractions of MAX_R from centre) — boundaries between impact bands. */
const IMPACT_RING_GUIDE_FRACS = [0.84, 0.67, 0.5, 0.33, 0.16] as const;

function radiusFromIndustryImpact(pos: IndustryPosition, topicFallbackUrgency: number): number {
  const impact =
    typeof pos.impact_score === "number"
      ? pos.impact_score
      : typeof pos.urgency_score === "number"
        ? pos.urgency_score
        : topicFallbackUrgency;
  return impactScoreToRadius(impact);
}

function axisAngleDeg(idx: number): number {
  return (270 + idx * 72) % 360;
}

function starPath(cx: number, cy: number, outerR = STAR_OUTER_R, innerR = STAR_INNER_R): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = degToRad(i * 36 - 90);
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`
    );
  }
  return `M ${pts.join(" L ")} Z`;
}

function approxW(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.58;
}

/**
 * Expand each topic into one PlotPoint per industry (if industry_positions
 * is set), or one fallback PlotPoint using the topic-level values.
 */
function buildPlotPoints(topics: RadarTopic[]): PlotPoint[] {
  const points: PlotPoint[] = [];
  for (const topic of topics) {
    const positions = topic.industry_positions;
    if (positions && Object.keys(positions).length > 0) {
      const visible = Object.entries(positions).filter(([, pos]) => pos.impact_approved !== false);
      if (visible.length === 0) {
        points.push({
          key: String(topic.id),
          topic,
          industry: null,
          color: DOMAIN_COLORS[topic.domain] ?? DEFAULT_COLOR,
          urgency: topic.urgency_score,
          adoptionState: topic.adoption_state,
        });
        continue;
      }
      for (const [industry, pos] of visible) {
        const impact =
          typeof pos.impact_score === "number"
            ? pos.impact_score
            : typeof pos.urgency_score === "number"
              ? pos.urgency_score
              : topic.urgency_score;
        points.push({
          key: `${topic.id}-${industry}`,
          topic,
          industry,
          color: industryColor(industry),
          urgency: impact,
          adoptionState: pos.adoption_state ?? topic.adoption_state,
          rationale: pos.rationale,
        });
      }
    } else {
      points.push({
        key: String(topic.id),
        topic,
        industry: null,
        color: DOMAIN_COLORS[topic.domain] ?? DEFAULT_COLOR,
        urgency: topic.urgency_score,
        adoptionState: topic.adoption_state,
      });
    }
  }
  return points;
}

/** Group plot points by axis, spread within each axis to reduce overlap. */
function computePositions(topics: RadarTopic[]): PlotPointXY[] {
  const plotPoints = buildPlotPoints(topics);

  const groups: Record<number, PlotPoint[]> = {};
  for (const pt of plotPoints) {
    const axis = adoptionStateToAxisIndex(pt.adoptionState);
    (groups[axis] ??= []).push(pt);
  }

  const result: PlotPointXY[] = [];
  for (const [axisStr, group] of Object.entries(groups)) {
    const axisIdx = Number(axisStr);
    const baseAngle = axisAngleDeg(axisIdx);
    const spread = Math.min(AXIS_SPREAD_DEG, group.length * AXIS_SPREAD_STEP);
    group.forEach((pt, i) => {
      const offset =
        group.length === 1 ? 0 : -spread / 2 + (spread / (group.length - 1)) * i;
      let r: number;
      if (pt.industry && pt.topic.industry_positions?.[pt.industry]) {
        r = radiusFromIndustryImpact(pt.topic.industry_positions[pt.industry], pt.topic.urgency_score);
      } else {
        r = impactScoreToRadius(pt.urgency);
      }
      const [x, y] = polarToXY(baseAngle + offset, r);
      result.push({ ...pt, x, y });
    });
  }
  return result;
}

/**
 * Same basis the chart uses for star distance when industry rows exist: max impact (1–10) across
 * approved industries; otherwise topic-level urgency (matches fallback stars).
 */
export function topicRankScore(topic: RadarTopic): number {
  const pos = topic.industry_positions;
  if (!pos || Object.keys(pos).length === 0) {
    return topic.urgency_score;
  }
  let max = 0;
  let anyApproved = false;
  for (const row of Object.values(pos)) {
    if (!row || row.impact_approved === false) continue;
    anyApproved = true;
    const imp =
      typeof row.impact_score === "number"
        ? row.impact_score
        : typeof row.urgency_score === "number"
          ? row.urgency_score
          : 0;
    max = Math.max(max, imp);
  }
  if (!anyApproved) return topic.urgency_score;
  return max > 0 ? max : topic.urgency_score;
}

function topTopicsForSidebar(topics: RadarTopic[], n: number): RadarTopic[] {
  return [...topics].sort((a, b) => topicRankScore(b) - topicRankScore(a)).slice(0, n);
}

/** Label for the score shown next to each topic in the default sidebar. */
function sidebarScoreLabel(topic: RadarTopic): string {
  const pos = topic.industry_positions;
  if (!pos || Object.keys(pos).length === 0) return "topic urgency";
  for (const row of Object.values(pos)) {
    if (row && row.impact_approved !== false) return "max impact";
  }
  return "topic urgency";
}

function legendEntriesForTopics(topics: RadarTopic[]): {
  mode: "industry" | "domain";
  entries: { label: string; color: string }[];
} {
  const industries = new Set<string>();
  for (const t of topics) {
    const pos = t.industry_positions;
    if (!pos) continue;
    for (const [name, row] of Object.entries(pos)) {
      if (row?.impact_approved !== false) industries.add(name);
    }
  }
  if (industries.size > 0) {
    return {
      mode: "industry",
      entries: [...industries]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          label: name,
          color: industryColor(name),
        })),
    };
  }
  const domains = new Set<string>();
  for (const t of topics) domains.add(t.domain);
  return {
    mode: "domain",
    entries: [...domains]
      .sort((a, b) => a.localeCompare(b))
      .map((d) => ({
        label: d,
        color: DOMAIN_COLORS[d] ?? DEFAULT_COLOR,
      })),
  };
}

function RadarColorLegend({
  topics,
  compact,
}: {
  topics: RadarTopic[];
  compact?: boolean;
}) {
  const { mode, entries } = useMemo(() => legendEntriesForTopics(topics), [topics]);
  if (topics.length === 0 || entries.length === 0) return null;

  return (
    <nav
      aria-label="Star color legend"
      className={
        "w-full shrink-0 rounded-xl border border-gray-200 bg-gray-50/90 text-left font-sans shadow-sm lg:sticky lg:top-4 lg:max-h-[min(85vh,720px)] lg:overflow-y-auto lg:self-start " +
        (compact
          ? "px-2 py-2 lg:w-40"
          : "px-3 py-3 lg:w-52")
      }
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Star colors</p>
      <p className="mt-0.5 text-xs text-gray-600">
        {mode === "industry" ? "By industry" : "By topic domain"}
      </p>
      <ul className={compact ? "mt-2 space-y-2" : "mt-3 space-y-2.5"}>
        {entries.map(({ label, color }) => (
          <li key={label} className="flex items-start gap-2.5 text-sm leading-snug text-gray-800">
            <span
              className="mt-0.5 inline-block text-[15px] leading-none"
              style={{ color }}
              aria-hidden
            >
              ★
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadarChart({
  topics,
  showLabels = false,
  emptyMessage = "No published topics yet",
  layout = "default",
}: {
  topics: RadarTopic[];
  showLabels?: boolean;
  /** Shown when there are zero topics (e.g. admin preview vs public). */
  emptyMessage?: string;
  /** Tighter gaps, wider chart column, smaller legend — for admin preview. */
  layout?: "default" | "compact";
}) {
  const compact = layout === "compact";
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const positions = computePositions(topics);

  /** Hover previews another star while locked; otherwise show locked selection. */
  const displayKey = hoveredKey ?? lockedKey;
  const activePoint = useMemo(
    () => (displayKey ? positions.find((p) => p.key === displayKey) ?? null : null),
    [positions, displayKey],
  );

  const topThree = useMemo(() => topTopicsForSidebar(topics, 3), [topics]);

  function handleStarPointerDown(ptKey: string) {
    setLockedKey((prev) => (prev === ptKey ? null : ptKey));
  }

  return (
    <div
      className={
        "mx-auto flex w-full select-none flex-col items-stretch justify-start lg:flex-row lg:items-start " +
        (compact
          ? "max-w-none gap-3 lg:gap-4"
          : "max-w-[min(100%,96rem)] gap-6 lg:gap-5")
      }
      style={
        {
          ["--radar-top-pill-offset" as string]: String(RADAR_TOP_PILL_OFFSET_RATIO),
        } as React.CSSProperties
      }
    >
      <RadarColorLegend topics={topics} compact={compact} />

      <div
        className={
          "mx-auto w-full min-w-0 shrink-0 lg:mx-0 lg:flex-1 " +
          (compact ? "max-w-[min(100%,1520px)]" : "max-w-[1163px]")
        }
      >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto"
        aria-label="PulseOne Industry Radar — wedge shows adoption stage; distance shows impact band (9+ toward centre)"
      >
        <defs>
          <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0fdf9" />
            <stop offset="60%" stopColor="#ccfbf1" />
            <stop offset="100%" stopColor="var(--color-radar-bg)" stopOpacity="0.55" />
          </radialGradient>
          <filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={3.5 * SCALE} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="starGlowHover" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={5.25 * SCALE} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g pointerEvents="none">
        {/* ── Radar background ── */}
        <circle cx={CX} cy={CY} r={MAX_R + RADAR_PAD} fill="url(#radarBg)" />
        <circle cx={CX} cy={CY} r={MAX_R + RADAR_PAD} fill="none" stroke="var(--color-radar-bg)" strokeWidth={1.5 * SCALE} strokeOpacity="0.4" />

        {/* Impact band guides: boundaries between ≤5 · (5,6] · (6,7] · (7,8] · [8,9) · 9+ */}
        {IMPACT_RING_GUIDE_FRACS.map((frac) => (
          <circle
            key={frac}
            cx={CX}
            cy={CY}
            r={frac * MAX_R}
            fill="none"
            stroke="var(--color-radar-bg)"
            strokeWidth={0.75 * SCALE}
            strokeOpacity={0.35}
            strokeDasharray="4 3"
          />
        ))}

        {/* ── Axis spokes and pill labels ── */}
        {ADOPTION_AXES.map((label, i) => {
          const angle = axisAngleDeg(i);
          const [sx, sy] = polarToXY(angle, MAX_R);
          const [lx, ly] = polarToXY(angle, LABEL_R);
          const pillW = svgCoord(approxW(label, PILL_FONT) + PILL_PAD_X);
          const pillH = PILL_H;
          const pillLeft = svgCoord(lx - pillW / 2);
          const pillTop = svgCoord(ly - pillH / 2);
          return (
            <g key={label}>
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="var(--color-radar-bg)" strokeWidth={1 * SCALE} strokeOpacity="0.35" />
              <rect x={pillLeft} y={pillTop} width={pillW} height={pillH} rx={PILL_RX} fill="var(--color-pulse-teal)" />
              <text
                x={lx} y={svgCoord(ly + 1 * SCALE)}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={PILL_FONT} fontWeight="600"
                fontFamily="'IBM Plex Sans',system-ui,sans-serif" letterSpacing="0.01em"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Centre pip ── */}
        <circle cx={CX} cy={CY} r={4 * SCALE} fill="var(--color-pulse-teal)" opacity="0.45" />

        {/* ── Stars (per-industry or domain fallback) — visuals first; see hit-target pass below ── */}
        {positions.map((pt) => {
          const hx = svgCoord(pt.x);
          const hy = svgCoord(pt.y);
          const isHighlighted =
            hoveredKey === pt.key ||
            (lockedKey === pt.key && hoveredKey === null);
          const hoverTf =
            isHighlighted
              ? `translate(${hx},${hy}) scale(${STAR_HOVER_SCALE}) translate(${-hx},${-hy})`
              : undefined;
          return (
            <g key={pt.key} pointerEvents="none">
              <g transform={hoverTf}>
                <g filter={isHighlighted ? "url(#starGlowHover)" : "url(#starGlow)"}>
                  <circle
                    cx={hx}
                    cy={hy}
                    r={STAR_HALO_R}
                    fill={pt.color}
                    opacity={isHighlighted ? 0.22 : 0.1}
                  />
                  <path
                    d={starPath(hx, hy, STAR_OUTER_R, STAR_INNER_R)}
                    fill={pt.color}
                    stroke="white"
                    strokeWidth={isHighlighted ? STAR_STROKE_HOVER_W : STAR_STROKE_W}
                    strokeLinejoin="round"
                  />
                </g>
              </g>
              {showLabels && (
                <text
                  x={svgCoord(pt.x + 12 * SCALE)}
                  y={svgCoord(pt.y + 4 * SCALE)}
                  fontSize={9.5 * SCALE}
                  fill={pt.color}
                  fontWeight="600"
                  fontFamily="'IBM Plex Sans',system-ui,sans-serif"
                  style={{ pointerEvents: "none", opacity: isHighlighted ? 1 : 0.92 }}
                >
                  {pt.topic.name.length > 20
                    ? pt.topic.name.slice(0, 19) + "…"
                    : pt.topic.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Empty state ── */}
        {topics.length === 0 && (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-radar-bg)" fontSize={14 * SCALE} opacity="0.6" fontFamily="'IBM Plex Sans',system-ui,sans-serif">
            {emptyMessage}
          </text>
        )}
        </g>

        {/* Tap/click outside stars clears lock (above background, below hit targets) */}
        <rect
          width={SIZE}
          height={SIZE}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: "default" }}
          onPointerDown={() => setLockedKey(null)}
        />

        {/* Hit targets drawn last so filtered glow layers cannot sit above them (fixes cursor vs hover offset) */}
        {positions.map((pt) => {
          const hx = svgCoord(pt.x);
          const hy = svgCoord(pt.y);
          return (
            <circle
              key={`hit-${pt.key}`}
              cx={hx}
              cy={hy}
              r={STAR_HIT_R}
              fill="transparent"
              stroke="none"
              pointerEvents="all"
              className="cursor-pointer touch-manipulation"
              onMouseEnter={() => setHoveredKey(pt.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleStarPointerDown(pt.key);
              }}
            />
          );
        })}
      </svg>
      </div>

      {/* ── Detail panel: lg top padding matches SVG “Learn About” pill (not the raw SVG box top) ── */}
      <aside
        className={
          "w-full min-w-0 shrink-0 max-lg:pt-0 " +
          (compact ? "lg:max-w-sm " : "lg:max-w-md ") +
          (compact
            ? "lg:pt-[calc(var(--radar-top-pill-offset)*min(1520px,calc(100vw-3rem)))]"
            : "lg:pt-[calc(var(--radar-top-pill-offset)*min(1163px,calc(100vw-3rem)))]")
        }
        aria-live="polite"
      >
        <div
          className={[
            "rounded-2xl border-2 bg-white shadow-lg transition-shadow",
            compact ? "px-4 py-4" : "px-6 py-5",
            activePoint ? "border-pulse-teal ring-1 ring-pulse-teal/20" : "border-gray-200",
          ].join(" ")}
        >
          {activePoint ? (
            <RadarTooltipPanel point={activePoint} />
          ) : (
            <RadarDefaultPanel
              topics={topics}
              topThree={topThree}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function RadarDefaultPanel({
  topics,
  topThree,
}: {
  topics: RadarTopic[];
  topThree: RadarTopic[];
}) {
  return (
    <div className="text-center font-sans lg:text-left">
      <p className="text-base font-semibold text-pulse-teal">PulseOne Technology Radar</p>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        The PulseOne Technology Radar tracks the signals that matter most to your business.
      </p>
      {topics.length > 0 ? (
        <>
          <p className="mt-4 text-left text-xs leading-relaxed text-gray-500">
            <span className="font-semibold text-gray-600">How to read this chart:</span> each{" "}
            <span className="text-gray-700">wedge</span> is an adoption stage for that industry.{" "}
            <span className="text-gray-700">Distance from the center</span> uses discrete impact bands:{" "}
            <span className="text-gray-700">9+</span> sits in the centre zone,{" "}
            <span className="text-gray-700">5 and below</span> on the outer ring, with one ring inward for each band{" "}
            (5–6, 6–7, 7–8, 8–9). Dashed circles mark those bands. Risk is shown in the detail panel only. The list below
            ranks by the same impact score (max across industries when several stars exist).
          </p>
          <div className="mt-5 border-t border-gray-200 pt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Top 3 (chart impact)
            </p>
            <ul className="mt-3 space-y-3 text-left">
              {topThree.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 gap-y-1 text-sm"
                >
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{
                      backgroundColor:
                        DOMAIN_COLORS[t.domain] ?? DEFAULT_COLOR,
                    }}
                  >
                    {t.domain}
                  </span>
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="ml-auto rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
                    {topicRankScore(t).toFixed(1)} {sidebarScoreLabel(t)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => scrollToSubscribe()}
            className="mt-6 w-full rounded-lg border-2 border-pulse-teal bg-white px-4 py-2.5 text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal/5"
          >
            Subscribe for personalized briefings
          </button>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Published topics will appear as stars on the radar.
        </p>
      )}
    </div>
  );
}

function RadarTooltipPanel({ point: pt }: { point: PlotPointXY }) {
  const ind =
    pt.industry && pt.topic.industry_positions
      ? pt.topic.industry_positions[pt.industry]
      : undefined;
  const impactShown =
    ind && typeof ind.impact_score === "number"
      ? ind.impact_score
      : typeof ind?.urgency_score === "number"
        ? ind.urgency_score
        : pt.urgency;
  const riskShown = ind && typeof ind.risk_level === "number" ? ind.risk_level : null;

  return (
    <div className="font-sans text-gray-900">
      <h3 className="text-lg font-bold leading-snug text-[#111827]">{pt.topic.name}</h3>
      <p className="mt-2 text-base font-semibold" style={{ color: pt.color }}>
        {pt.topic.domain}
        {pt.industry ? ` · ${pt.industry}` : ""}
      </p>
      <p className="mt-3 text-sm text-gray-700">
        <span className="font-medium">Impact</span> {impactShown.toFixed(1)} / 10
        {riskShown !== null ? (
          <>
            <span className="mx-2 text-gray-300">·</span>
            <span className="font-medium">Risk</span> {riskShown.toFixed(1)} / 10
          </>
        ) : null}
        <span className="mx-2 text-gray-300">·</span>
        <span className="font-medium">{pt.adoptionState}</span>
      </p>
      {pt.rationale ? (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rationale</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{pt.rationale}</p>
        </div>
      ) : pt.topic.summary ? (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{pt.topic.summary}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => scrollToSubscribe(pt.topic.domain)}
        className="mt-5 w-full rounded-lg border border-pulse-teal/30 bg-pulse-teal/5 px-3 py-2.5 text-left text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal/10"
      >
        Get briefings on {pt.topic.name} →
      </button>
    </div>
  );
}

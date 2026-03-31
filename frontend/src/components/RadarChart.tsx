"use client";

import { useState } from "react";

// ── Public types ───────────────────────────────────────────────────────────────

export interface IndustryPosition {
  urgency_score: number;
  adoption_state: string;
  rationale?: string;
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
/** 1.5 = 50% larger than original 680px canvas / 175px radius design */
const SCALE = 1.5;
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
/** Invisible target so hover is easy to trigger (SVG star path is small). */
const STAR_HIT_R = STAR_HALO_R * 2.35;
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
  Security: "#DC2626",
  Cloud: "#0284C7",
  Finance: "#059669",
  Leadership: "#D97706",
  Other: "#6B7280",
};

// Per-industry colours used when industry_positions are defined
export const INDUSTRY_COLORS: Record<string, string> = {
  "Technology": "#2563EB",
  "Healthcare": "#0891B2",
  "Finance & Banking": "#059669",
  "Manufacturing": "#9333EA",
  "Education": "#D97706",
  "Retail & E-Commerce": "#EA580C",
  "Government & Public Sector": "#475569",
  "Media & Entertainment": "#DB2777",
  "Energy & Utilities": "#CA8A04",
  "Other": "#6B7280",
};

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
      for (const [industry, pos] of Object.entries(positions)) {
        points.push({
          key: `${topic.id}-${industry}`,
          topic,
          industry,
          color: INDUSTRY_COLORS[industry] ?? DEFAULT_COLOR,
          urgency: pos.urgency_score,
          adoptionState: pos.adoption_state,
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
      const r = Math.max(MIN_URGENCY_R, (pt.urgency / 10) * MAX_R);
      const [x, y] = polarToXY(baseAngle + offset, r);
      result.push({ ...pt, x, y });
    });
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadarChart({
  topics,
  showLabels = false,
}: {
  topics: RadarTopic[];
  showLabels?: boolean;
}) {
  const [tooltip, setTooltip] = useState<PlotPointXY | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const positions = computePositions(topics);

  return (
    <div
      className="flex w-full max-w-7xl flex-col items-stretch justify-start gap-5 lg:flex-row lg:items-start lg:gap-6 mx-auto select-none"
      style={
        {
          ["--radar-top-pill-offset" as string]: String(RADAR_TOP_PILL_OFFSET_RATIO),
        } as React.CSSProperties
      }
    >
      <div className="mx-auto w-full max-w-[930px] shrink-0 lg:mx-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto"
        aria-label="PulseOne Industry Radar — topics plotted by adoption state and urgency"
      >
        <defs>
          <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0fdf9" />
            <stop offset="60%" stopColor="#ccfbf1" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.55" />
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

        {/* ── Radar background ── */}
        <circle cx={CX} cy={CY} r={MAX_R + RADAR_PAD} fill="url(#radarBg)" />
        <circle cx={CX} cy={CY} r={MAX_R + RADAR_PAD} fill="none" stroke="#0d9488" strokeWidth={1.5 * SCALE} strokeOpacity="0.4" />

        {/* ── Urgency rings ── */}
        {[2, 4, 6, 8, 10].map((u) => (
          <circle
            key={u}
            cx={CX} cy={CY} r={(u / 10) * MAX_R}
            fill="none" stroke="#0d9488" strokeWidth={0.75 * SCALE}
            strokeOpacity={u === 10 ? 0.5 : 0.25}
            strokeDasharray={u < 10 ? "4 3" : undefined}
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
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="#0d9488" strokeWidth={1 * SCALE} strokeOpacity="0.35" />
              <rect x={pillLeft} y={pillTop} width={pillW} height={pillH} rx={PILL_RX} fill="#425B76" />
              <text
                x={lx} y={svgCoord(ly + 1 * SCALE)}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={PILL_FONT} fontWeight="600"
                fontFamily="Inter,system-ui,sans-serif" letterSpacing="0.01em"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Centre pip ── */}
        <circle cx={CX} cy={CY} r={4 * SCALE} fill="#425B76" opacity="0.45" />

        {/* ── Stars (per-industry or domain fallback) — visuals first; see hit-target pass below ── */}
        {positions.map((pt) => {
          const hx = svgCoord(pt.x);
          const hy = svgCoord(pt.y);
          const isHover = hoveredKey === pt.key;
          const hoverTf =
            isHover
              ? `translate(${hx},${hy}) scale(${STAR_HOVER_SCALE}) translate(${-hx},${-hy})`
              : undefined;
          return (
            <g key={pt.key} pointerEvents="none">
              <g transform={hoverTf}>
                <g filter={isHover ? "url(#starGlowHover)" : "url(#starGlow)"}>
                  <circle
                    cx={hx}
                    cy={hy}
                    r={STAR_HALO_R}
                    fill={pt.color}
                    opacity={isHover ? 0.22 : 0.1}
                  />
                  <path
                    d={starPath(hx, hy, STAR_OUTER_R, STAR_INNER_R)}
                    fill={pt.color}
                    stroke="white"
                    strokeWidth={isHover ? STAR_STROKE_HOVER_W : STAR_STROKE_W}
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
                  fontFamily="Inter,system-ui,sans-serif"
                  style={{ pointerEvents: "none", opacity: isHover ? 1 : 0.92 }}
                >
                  {pt.topic.name.length > 20
                    ? pt.topic.name.slice(0, 19) + "…"
                    : pt.topic.name}
                </text>
              )}
            </g>
          );
        })}

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
              className="cursor-pointer"
              onMouseEnter={() => {
                setTooltip(pt);
                setHoveredKey(pt.key);
              }}
              onMouseLeave={() => {
                setTooltip(null);
                setHoveredKey(null);
              }}
            />
          );
        })}

        {/* ── Empty state ── */}
        {topics.length === 0 && (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fill="#0d9488" fontSize={14 * SCALE} opacity="0.6" fontFamily="Inter,system-ui,sans-serif">
            No published topics yet
          </text>
        )}
      </svg>
      </div>

      {/* ── Detail panel: lg top padding matches SVG “Learn About” pill (not the raw SVG box top) ── */}
      <aside
        className={
          "w-full min-w-0 flex-1 lg:max-w-md max-lg:pt-0 " +
          "lg:pt-[calc(var(--radar-top-pill-offset)*min(930px,calc(100vw-3rem)))]"
        }
        aria-live="polite"
      >
        <div
          className={[
            "rounded-2xl border-2 bg-white px-6 py-5 shadow-lg transition-shadow",
            tooltip ? "border-[#425B76] shadow-[#425B76]/10" : "border-gray-200",
          ].join(" ")}
        >
          {tooltip ? (
            <RadarTooltipPanel point={tooltip} />
          ) : (
            <div className="text-center lg:text-left">
              <p className="text-base font-semibold text-[#425B76]">Topic details</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                {topics.length > 0
                  ? "Hover a star on the radar to read the full briefing, rationale, and urgency for that signal."
                  : "Published topics will appear as stars on the radar."}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function RadarTooltipPanel({ point: pt }: { point: PlotPointXY }) {
  return (
    <div className="font-sans text-gray-900">
      <h3 className="text-lg font-bold leading-snug text-[#111827]">{pt.topic.name}</h3>
      <p className="mt-2 text-base font-semibold" style={{ color: pt.color }}>
        {pt.topic.domain}
        {pt.industry ? ` · ${pt.industry}` : ""}
      </p>
      <p className="mt-3 text-sm text-gray-700">
        <span className="font-medium">Urgency</span> {pt.urgency.toFixed(1)} / 10
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
    </div>
  );
}

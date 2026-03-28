"use client";

import { useState } from "react";

// ── Public types ───────────────────────────────────────────────────────────────

export interface IndustryPosition {
  urgency_score: number;
  adoption_state: string;
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
const SIZE = 680;
const CX = SIZE / 2;  // 340
const CY = SIZE / 2;  // 340
const MAX_R = 175;
const LABEL_R = MAX_R + 56;

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
}

interface PlotPointXY extends PlotPoint {
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polarToXY(angleDeg: number, r: number): [number, number] {
  const rad = degToRad(angleDeg);
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
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

function starPath(cx: number, cy: number, outerR = 8, innerR = 3.4): string {
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
    const spread = Math.min(30, group.length * 6);
    group.forEach((pt, i) => {
      const offset =
        group.length === 1 ? 0 : -spread / 2 + (spread / (group.length - 1)) * i;
      const r = Math.max(18, (pt.urgency / 10) * MAX_R);
      const [x, y] = polarToXY(baseAngle + offset, r);
      result.push({ ...pt, x, y });
    });
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadarChart({ topics }: { topics: RadarTopic[] }) {
  const [tooltip, setTooltip] = useState<PlotPointXY | null>(null);
  const positions = computePositions(topics);

  return (
    <div className="relative w-full max-w-[620px] mx-auto select-none">
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
          <filter id="ttShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#425B76" floodOpacity="0.18" />
          </filter>
          <filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Radar background ── */}
        <circle cx={CX} cy={CY} r={MAX_R + 8} fill="url(#radarBg)" />
        <circle cx={CX} cy={CY} r={MAX_R + 8} fill="none" stroke="#0d9488" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* ── Urgency rings ── */}
        {[2, 4, 6, 8, 10].map((u) => (
          <circle
            key={u}
            cx={CX} cy={CY} r={(u / 10) * MAX_R}
            fill="none" stroke="#0d9488" strokeWidth="0.75"
            strokeOpacity={u === 10 ? 0.5 : 0.25}
            strokeDasharray={u < 10 ? "4 3" : undefined}
          />
        ))}

        {/* ── Axis spokes and pill labels ── */}
        {ADOPTION_AXES.map((label, i) => {
          const angle = axisAngleDeg(i);
          const [sx, sy] = polarToXY(angle, MAX_R);
          const [lx, ly] = polarToXY(angle, LABEL_R);
          const pillW = approxW(label, 10.5) + 24;
          const pillH = 22;
          return (
            <g key={label}>
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="#0d9488" strokeWidth="1" strokeOpacity="0.35" />
              <rect x={lx - pillW / 2} y={ly - pillH / 2} width={pillW} height={pillH} rx="11" fill="#425B76" />
              <text
                x={lx} y={ly + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="10.5" fontWeight="600"
                fontFamily="Inter,system-ui,sans-serif" letterSpacing="0.01em"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Centre pip ── */}
        <circle cx={CX} cy={CY} r={4} fill="#425B76" opacity="0.45" />

        {/* ── Stars (per-industry or domain fallback) ── */}
        {positions.map((pt) => (
          <g key={pt.key} filter="url(#starGlow)">
            <circle cx={pt.x} cy={pt.y} r={14} fill={pt.color} opacity="0.1" />
            <path
              d={starPath(pt.x, pt.y, 8, 3.4)}
              fill={pt.color}
              stroke="white"
              strokeWidth="1.25"
              strokeLinejoin="round"
              className="cursor-pointer"
              onMouseEnter={() => setTooltip(pt)}
              onMouseLeave={() => setTooltip(null)}
            />
          </g>
        ))}

        {/* ── Tooltip ── */}
        {tooltip && (() => {
          const pt = tooltip;
          const BOX_W = 192;
          const BOX_H = 64;
          const PAD = 12;
          let bx = pt.x + PAD;
          let by = pt.y - BOX_H - PAD;
          if (bx + BOX_W > SIZE - 6) bx = pt.x - BOX_W - PAD;
          if (by < 6) by = pt.y + PAD;
          if (by + BOX_H > SIZE - 6) by = SIZE - BOX_H - 6;

          const label = pt.industry ?? pt.topic.domain;
          return (
            <g pointerEvents="none">
              <rect
                x={bx} y={by} width={BOX_W} height={BOX_H} rx="8"
                fill="white" stroke="#425B76" strokeWidth="2"
                filter="url(#ttShadow)"
              />
              <text x={bx + 12} y={by + 20} fill="#111827" fontSize="12" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">
                {pt.topic.name.length > 24 ? pt.topic.name.slice(0, 23) + "…" : pt.topic.name}
              </text>
              <text x={bx + 12} y={by + 37} fill={pt.color} fontSize="10.5" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">
                {label} · Urgency {pt.urgency.toFixed(1)}
              </text>
              <text x={bx + 12} y={by + 53} fill="#6B7280" fontSize="9.5" fontFamily="Inter,system-ui,sans-serif">
                {pt.adoptionState}
              </text>
            </g>
          );
        })()}

        {/* ── Empty state ── */}
        {topics.length === 0 && (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fill="#0d9488" fontSize="14" opacity="0.6" fontFamily="Inter,system-ui,sans-serif">
            No published topics yet
          </text>
        )}
      </svg>
    </div>
  );
}

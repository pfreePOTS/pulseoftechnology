"use client";

import { useState } from "react";

export interface RadarTopic {
  id: number;
  name: string;
  domain: string;
  urgency_score: number;
  summary: string | null;
}

// ── Chart geometry ─────────────────────────────────────────────────────────────
const SIZE = 680;
const CX = SIZE / 2;  // 340
const CY = SIZE / 2;  // 340
const MAX_R = 175;
const LABEL_R = MAX_R + 56; // 231 — distance from center to pill label centre

// Five adoption-state axes, clockwise from 12 o'clock (270°)
const ADOPTION_AXES = [
  "Learn About",
  "Get Ahead Of",
  "Get Prepared For",
  "Get Your Hands Around",
  "Make the Most Of",
] as const;

// Industry/domain accent colours
const DOMAIN_COLORS: Record<string, string> = {
  AI: "#7C3AED",
  Security: "#DC2626",
  Cloud: "#0284C7",
  Finance: "#059669",
  Leadership: "#D97706",
  Other: "#6B7280",
};
const DEFAULT_COLOR = "#6B7280";

// ── Helpers ───────────────────────────────────────────────────────────────────

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polarToXY(angleDeg: number, r: number): [number, number] {
  const rad = degToRad(angleDeg);
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

/** Map urgency 0–10 to adoption-axis index 0–4. */
function urgencyToAxisIndex(urgency: number): number {
  if (urgency < 2) return 0;
  if (urgency < 4) return 1;
  if (urgency < 6) return 2;
  if (urgency < 8) return 3;
  return 4;
}

/** Clockwise angle (deg) of the nth adoption-state axis, from 12 o'clock. */
function axisAngleDeg(idx: number): number {
  return (270 + idx * 72) % 360;
}

/** 5-pointed star path centred at (cx, cy). */
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

/** Approximate rendered text width (px) at given font-size. */
function approxW(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.58;
}

/** Spread topics that share the same adoption axis to avoid overlap. */
function computePositions(topics: RadarTopic[]) {
  const groups: Record<number, RadarTopic[]> = {};
  for (const t of topics) {
    const axis = urgencyToAxisIndex(t.urgency_score);
    (groups[axis] ??= []).push(t);
  }

  const result: Array<{ topic: RadarTopic; x: number; y: number }> = [];
  for (const [axisStr, group] of Object.entries(groups)) {
    const axisIdx = Number(axisStr);
    const baseAngle = axisAngleDeg(axisIdx);
    const spread = Math.min(30, group.length * 6);
    group.forEach((topic, i) => {
      const offset =
        group.length === 1 ? 0 : -spread / 2 + (spread / (group.length - 1)) * i;
      const r = Math.max(18, (topic.urgency_score / 10) * MAX_R);
      const [x, y] = polarToXY(baseAngle + offset, r);
      result.push({ topic, x, y });
    });
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Tooltip {
  topic: RadarTopic;
  svgX: number;
  svgY: number;
}

export default function RadarChart({ topics }: { topics: RadarTopic[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const positions = computePositions(topics);

  return (
    <div className="relative w-full max-w-[620px] mx-auto select-none">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto"
        aria-label="PulseOne Industry Radar — topics plotted by adoption state and urgency"
      >
        <defs>
          {/* Teal-green radial gradient for radar disc */}
          <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0fdf9" />
            <stop offset="60%" stopColor="#ccfbf1" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.55" />
          </radialGradient>
          {/* Drop shadow for tooltips */}
          <filter id="ttShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#425B76" floodOpacity="0.18" />
          </filter>
          {/* Soft glow behind stars */}
          <filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Radar background disc ── */}
        <circle cx={CX} cy={CY} r={MAX_R + 8} fill="url(#radarBg)" />
        <circle
          cx={CX} cy={CY} r={MAX_R + 8}
          fill="none" stroke="#0d9488" strokeWidth="1.5" strokeOpacity="0.4"
        />

        {/* ── Dashed urgency rings ── */}
        {[2, 4, 6, 8, 10].map((u) => {
          const r = (u / 10) * MAX_R;
          return (
            <circle
              key={u}
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke="#0d9488"
              strokeWidth="0.75"
              strokeOpacity={u === 10 ? 0.5 : 0.25}
              strokeDasharray={u < 10 ? "4 3" : undefined}
            />
          );
        })}

        {/* ── Adoption-state axis spokes and pill labels ── */}
        {ADOPTION_AXES.map((label, i) => {
          const angle = axisAngleDeg(i);
          const [sx, sy] = polarToXY(angle, MAX_R);
          const [lx, ly] = polarToXY(angle, LABEL_R);
          const pillW = approxW(label, 10.5) + 24;
          const pillH = 22;
          return (
            <g key={label}>
              <line
                x1={CX} y1={CY} x2={sx} y2={sy}
                stroke="#0d9488" strokeWidth="1" strokeOpacity="0.35"
              />
              <rect
                x={lx - pillW / 2} y={ly - pillH / 2}
                width={pillW} height={pillH} rx="11"
                fill="#425B76"
              />
              <text
                x={lx} y={ly + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="10.5" fontWeight="600"
                fontFamily="Inter,system-ui,sans-serif"
                letterSpacing="0.01em"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Centre pip ── */}
        <circle cx={CX} cy={CY} r={4} fill="#425B76" opacity="0.45" />

        {/* ── Topic stars ── */}
        {positions.map(({ topic, x, y }) => {
          const color = DOMAIN_COLORS[topic.domain] ?? DEFAULT_COLOR;
          return (
            <g key={topic.id} filter="url(#starGlow)">
              <circle cx={x} cy={y} r={14} fill={color} opacity="0.1" />
              <path
                d={starPath(x, y, 8, 3.4)}
                fill={color}
                stroke="white"
                strokeWidth="1.25"
                strokeLinejoin="round"
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ topic, svgX: x, svgY: y })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}

        {/* ── Tooltip ── */}
        {tooltip && (() => {
          const { topic, svgX, svgY } = tooltip;
          const BOX_W = 182;
          const BOX_H = 64;
          const PAD = 12;
          let bx = svgX + PAD;
          let by = svgY - BOX_H - PAD;
          if (bx + BOX_W > SIZE - 6) bx = svgX - BOX_W - PAD;
          if (by < 6) by = svgY + PAD;
          if (by + BOX_H > SIZE - 6) by = SIZE - BOX_H - 6;
          const color = DOMAIN_COLORS[topic.domain] ?? DEFAULT_COLOR;
          const axisLabel = ADOPTION_AXES[urgencyToAxisIndex(topic.urgency_score)];
          return (
            <g pointerEvents="none">
              <rect
                x={bx} y={by} width={BOX_W} height={BOX_H} rx="8"
                fill="white" stroke="#425B76" strokeWidth="2"
                filter="url(#ttShadow)"
              />
              <text
                x={bx + 12} y={by + 20}
                fill="#111827" fontSize="12" fontWeight="700"
                fontFamily="Inter,system-ui,sans-serif"
              >
                {topic.name.length > 23 ? topic.name.slice(0, 22) + "…" : topic.name}
              </text>
              <text
                x={bx + 12} y={by + 37}
                fill={color} fontSize="10.5" fontWeight="600"
                fontFamily="Inter,system-ui,sans-serif"
              >
                {topic.domain} · Urgency {topic.urgency_score.toFixed(1)}
              </text>
              <text
                x={bx + 12} y={by + 53}
                fill="#6B7280" fontSize="9.5"
                fontFamily="Inter,system-ui,sans-serif"
              >
                {axisLabel}
              </text>
            </g>
          );
        })()}

        {/* ── Empty state ── */}
        {topics.length === 0 && (
          <text
            x={CX} y={CY}
            textAnchor="middle" dominantBaseline="middle"
            fill="#0d9488" fontSize="14" opacity="0.6"
            fontFamily="Inter,system-ui,sans-serif"
          >
            No published topics yet
          </text>
        )}
      </svg>
    </div>
  );
}

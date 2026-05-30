/**
 * Full-page (or embedded) loader while `/recommended-path` content is prepared.
 * Animated step list + bar — pure CSS (`globals.css`); works as RSC without client JS.
 */

import type { CSSProperties } from "react";

type Props = {
  /** Omit full-viewport backdrop when rendered inside an overlay shell (progressive loader). */
  embedded?: boolean;
};

type LoadingStep = { label: string; completeAtMs: number; final?: boolean };

const STEPS: LoadingStep[] = [
  { label: "Reviewing your situation", completeAtMs: 600 },
  { label: "Mapping our experience to your industry", completeAtMs: 2400 },
  { label: "Synthesising what we think", completeAtMs: 6200 },
  { label: "Pulling what we're watching", completeAtMs: 8000 },
  { label: "Preparing how to engage", completeAtMs: 9500, final: true },
];

export default function RecommendedPathBuildingScreen({ embedded = false }: Props) {
  return (
    <div
      className={
        embedded
          ? "flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center px-6 py-16"
          : "flex min-h-screen flex-col items-center justify-center bg-dark-bg px-6 py-16"
      }
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">
        Building your personalised path. This usually takes about ten seconds.
      </span>

      <div className="relative mb-10 flex h-32 w-32 items-center justify-center">
        <div className="loading-pulse-ring absolute inset-0 rounded-full bg-pulse-teal/35" />
        <div className="loading-pulse-ring-2 absolute inset-0 rounded-full bg-pulse-teal/35" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-pulse-teal shadow-[0_0_28px_rgba(1,158,124,0.55)]">
          <div className="loading-pulse-dot h-3 w-3 rounded-full bg-white" />
        </div>
      </div>

      <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
        Custom Path
      </span>
      <h1 className="mb-3 text-center font-sans text-[clamp(1.625rem,3.5vw,2.25rem)] leading-tight font-extrabold text-white">
        Building your specific solution.
      </h1>
      <p className="mb-10 max-w-[540px] text-center font-sans text-[15px] leading-relaxed text-white/55">
        We&rsquo;re tailoring radar signals, resources, and a recommendation to your situation. This usually takes
        about ten seconds.
      </p>

      <ol className="w-full max-w-[460px] space-y-2.5">
        {STEPS.map((step) => (
          <li
            key={step.label}
            className={`loading-step flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3${
              step.final ? " is-final" : ""
            }`}
            style={{ "--complete-at": `${step.completeAtMs}ms` } as CSSProperties}
          >
            <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="step-spinner absolute inset-0 flex items-center justify-center">
                <svg className="loading-spinner h-5 w-5 text-pulse-teal" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
                  <path
                    d="M21 12a9 9 0 0 1-9 9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="step-check absolute inset-0 flex items-center justify-center">
                <svg className="h-5 w-5 text-pulse-teal" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
            <span className="font-sans text-[14px] text-white/85">{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 h-1 w-full max-w-[460px] overflow-hidden rounded-full bg-white/10">
        <div className="loading-bar h-full rounded-full bg-gradient-to-r from-pulse-red to-pulse-teal" aria-hidden />
      </div>

      <p className="mt-6 max-w-[460px] text-center font-sans text-[12px] leading-relaxed text-white/35">
        Synthesis is grounded in PulseOne&rsquo;s understanding of your industry, needs and solutions — your specific
        recommendations will be ready in a moment.
      </p>
    </div>
  );
}

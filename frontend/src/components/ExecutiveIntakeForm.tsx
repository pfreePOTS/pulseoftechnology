"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import USAMap from "@/components/USAMap";
import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

/**
 * Use the canonical 20-industry radar grid (single source of truth in
 * `@/lib/industryGrid` — also mirrored in `backend/services/ai_service.py`'s
 * `INDUSTRY_GRID_LABELS`) so the intake form, the radar legend, and the AI
 * recommendation pipeline all speak the same vocabulary. "Other" stays as the
 * trailing escape hatch for write-ins.
 */
const INDUSTRIES = [...INDUSTRY_OPTIONS, "Other"] as const;

const ROLES = [
  "CEO / President / Owner",
  "COO",
  "CFO",
  "CIO / CTO",
  "CISO",
  "IT Manager / Director",
  "Operations",
  "Other / Not Sure",
] as const;

const ISSUES: { value: string; label: string }[] = [
  { value: "Cybersecurity", label: "Cybersecurity & Threats" },
  { value: "AI", label: "AI & Emerging Technology" },
  { value: "Compliance", label: "Compliance & Risk" },
  { value: "Cloud", label: "Cloud & Infrastructure" },
  { value: "IT Management", label: "Day-to-Day IT Management" },
  { value: "Strategy", label: "Long-Term Technology Strategy" },
  { value: "Other", label: "Something Else" },
];

const ADVANCE_DELAY_MS = 280;

// Display-position lookup. When `prefilledIndustry` is set we silently skip
// step 2 (Industry) — the user only sees 4 questions, so the labels and the
// progress bar must reflect that smaller total.
const STEP_DISPLAY: Record<1 | 2 | 3 | 4 | 5, { full: number; skipped: number }> = {
  1: { full: 1, skipped: 1 },
  2: { full: 2, skipped: 1 }, // never visible when skipped — fallback only
  3: { full: 3, skipped: 2 },
  4: { full: 4, skipped: 3 },
  5: { full: 5, skipped: 4 },
};

const optionBase =
  "rounded-md border-2 px-5 py-2.5 font-sans text-[15px] font-normal transition-colors";
const optionIdle =
  "border-white/20 bg-white/[0.08] text-white hover:border-pulse-teal hover:bg-pulse-teal/15";
const optionSelected = "border-pulse-teal bg-pulse-teal/15 text-white";

function optionClass(active: boolean) {
  return `${optionBase} ${active ? optionSelected : optionIdle}`;
}

export type ExecutiveIntakeFormProps = {
  /** When set, step 2 (Industry) is skipped and the value is shown as a
   * confirmed badge in the aside so the user sees we know who they are. */
  prefilledIndustry?: string;
  /** "page" (default) renders the full dark `<section>` with decorative
   * background. "modal" drops the outer chrome so the wizard can sit inside
   * a `<dialog>` without doubled padding/borders. */
  variant?: "page" | "modal";
};

export default function ExecutiveIntakeForm({
  prefilledIndustry,
  variant = "page",
}: ExecutiveIntakeFormProps = {}) {
  const router = useRouter();
  const isModal = variant === "modal";
  const hasPrefill = Boolean(prefilledIndustry && prefilledIndustry.trim());
  const totalVisibleSteps = hasPrefill ? 4 : 5;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [region, setRegion] = useState<string | null>(null);
  const [stateInput, setStateInput] = useState("");

  const [industry, setIndustry] = useState<string | null>(prefilledIndustry ?? null);
  const [industryOtherOpen, setIndustryOtherOpen] = useState(false);
  const [industryOther, setIndustryOther] = useState("");

  const [role, setRole] = useState<string | null>(null);
  const [roleOtherOpen, setRoleOtherOpen] = useState(false);
  const [roleOther, setRoleOther] = useState("");

  const [issue, setIssue] = useState<string | null>(null);
  const [issueOtherOpen, setIssueOtherOpen] = useState(false);
  const [issueOther, setIssueOther] = useState("");

  const [situation, setSituation] = useState("");

  const advance = (next: 1 | 2 | 3 | 4 | 5) => {
    // Skip step 2 entirely when the industry was pre-selected on entry.
    const target = next === 2 && hasPrefill ? 3 : next;
    window.setTimeout(() => setStep(target as 1 | 2 | 3 | 4 | 5), ADVANCE_DELAY_MS);
  };

  const handleRegionSelect = (reg: string) => {
    setRegion(reg);
    advance(2);
  };

  const handleStateInputNext = () => {
    const v = stateInput.trim();
    if (!v) return;
    setRegion(v);
    advance(2);
  };

  const finish = (situationText: string) => {
    const r = (region ?? stateInput.trim()) || "";
    const ind = industry ?? "";
    const rl = role ?? "";
    const iss = issue ?? "";
    const q = new URLSearchParams({
      region: r,
      industry: ind,
      role: rl,
      issue: iss,
      stage: situationText,
    });
    router.push(`/recommended-path?${q.toString()}`, { scroll: true });
  };

  // Visible position (1..N) — used for both labels and progress %.
  const visiblePos = STEP_DISPLAY[step][hasPrefill ? "skipped" : "full"];
  const progressPct = Math.round((visiblePos / totalVisibleSteps) * 100);

  const stepLabel = (visible: number) =>
    `Step ${visible} of ${totalVisibleSteps}`;

  // ─────────── Inner content (shared by page + modal variants) ───────────

  const step1Content = (
    <div className="relative mx-auto max-w-[860px] px-6">
      <header className="mb-6 text-center">
        <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
          How Can We Help?
        </span>
        <h2 className="mb-2.5 font-sans text-[38px] leading-tight font-bold tracking-tight text-white">
          {hasPrefill
            ? `Building your ${prefilledIndustry} path. Let's start with where you are.`
            : "It starts with where you are."}
        </h2>
        <p className="mx-auto font-sans text-lg leading-relaxed text-white/55">
          Click your region on the map below and we&apos;ll tailor everything to your location and
          situation.
        </p>
      </header>

      <USAMap selectedRegion={region} onSelect={handleRegionSelect} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-sans text-[13px] text-white/45">Or type your state:</span>
        <input
          type="text"
          suppressHydrationWarning
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleStateInputNext();
            }
          }}
          placeholder="e.g. New Jersey"
          className="w-[180px] rounded-md border border-white/20 bg-white/[0.08] px-3.5 py-2 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-pulse-red"
        />
        <button
          type="button"
          onClick={handleStateInputNext}
          disabled={!stateInput.trim()}
          className="rounded-md bg-pulse-red px-[18px] py-2 font-sans text-[13px] font-semibold text-white transition-colors hover:bg-[#a81117] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      <div className="mt-9 h-1 rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-gradient-to-r from-pulse-red to-pulse-teal transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {!isModal && (
        <p className="mt-5 text-center font-sans text-[13px]">
          <Link href="/everyone" className="text-white/35 hover:text-white/55">
            Skip: just show me everything
          </Link>
        </p>
      )}
    </div>
  );

  const stepsAfterFirstContent = (
    <div className="relative mx-auto grid max-w-[1200px] gap-14 px-6 lg:grid-cols-[5fr_8fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <span className="block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
          How Can We Help?
        </span>
        <h2 className="mt-3 mb-4 font-sans text-[34px] leading-tight font-bold tracking-tight text-white">
          {hasPrefill
            ? `We're tailoring this for ${prefilledIndustry}.`
            : "Good news: we have you covered."}
        </h2>
        <p className="mb-6 font-sans text-[15px] leading-relaxed text-white/65">
          Answer these quick questions and we&rsquo;ll tailor what you see to your situation.
        </p>

        {hasPrefill && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-pulse-teal/30 bg-pulse-teal/10 px-3 py-2">
            <span className="font-sans text-[10px] font-semibold tracking-[2px] text-pulse-teal uppercase">
              Industry
            </span>
            <span className="font-sans text-[14px] font-semibold text-white">
              {prefilledIndustry}
            </span>
          </div>
        )}

        {!isModal && (
          <div className="overflow-hidden rounded-lg">
            <Image
              src="/images/consultation_meeting.jpg"
              alt="Consultation meeting"
              width={800}
              height={440}
              className="h-[220px] w-full object-cover"
            />
          </div>
        )}
      </aside>

      <div>
        {step === 2 && (
          <div>
            <div className="mb-3.5 font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {stepLabel(STEP_DISPLAY[2].full)} &mdash; Your Industry
            </div>
            <p className="mb-6 font-sans text-[22px] font-bold text-white">
              Which industry best describes your organization?
            </p>
            <div className="flex flex-wrap gap-3">
              {INDUSTRIES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (label === "Other") {
                      setIndustryOtherOpen(true);
                      return;
                    }
                    setIndustry(label);
                    advance(3);
                  }}
                  className={optionClass(industry === label)}
                >
                  {label}
                </button>
              ))}
            </div>
            {industryOtherOpen && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <input
                  type="text"
                  suppressHydrationWarning
                  value={industryOther}
                  onChange={(e) => setIndustryOther(e.target.value)}
                  placeholder="Please describe your industry…"
                  className="min-w-[220px] flex-1 rounded-md border border-white/20 bg-white/[0.08] px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/35 focus:border-pulse-red"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = industryOther.trim();
                    if (!v) return;
                    setIndustry(v);
                    advance(3);
                  }}
                  className="rounded-md bg-pulse-red px-4 py-2 font-sans text-[13px] font-semibold text-white hover:bg-[#a81117]"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-3.5 font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {stepLabel(visiblePos)} &mdash; Your Role
            </div>
            <p className="mb-6 font-sans text-[22px] font-bold text-white">
              What best describes your role?
            </p>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (label === "Other / Not Sure") {
                      setRoleOtherOpen(true);
                      return;
                    }
                    setRole(label);
                    advance(4);
                  }}
                  className={optionClass(role === label)}
                >
                  {label}
                </button>
              ))}
            </div>
            {roleOtherOpen && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <input
                  type="text"
                  suppressHydrationWarning
                  value={roleOther}
                  onChange={(e) => setRoleOther(e.target.value)}
                  placeholder="Please describe your role…"
                  className="min-w-[220px] flex-1 rounded-md border border-white/20 bg-white/[0.08] px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/35 focus:border-pulse-red"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = roleOther.trim();
                    if (!v) return;
                    setRole(v);
                    advance(4);
                  }}
                  className="rounded-md bg-pulse-red px-4 py-2 font-sans text-[13px] font-semibold text-white hover:bg-[#a81117]"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="mb-3.5 font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {stepLabel(visiblePos)} &mdash; Your Challenge
            </div>
            <p className="mb-6 font-sans text-[22px] font-bold text-white">
              What&rsquo;s your biggest technology concern right now?
            </p>
            <div className="flex flex-wrap gap-3">
              {ISSUES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (value === "Other") {
                      setIssueOtherOpen(true);
                      return;
                    }
                    setIssue(value);
                    advance(5);
                  }}
                  className={optionClass(issue === value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {issueOtherOpen && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <input
                  type="text"
                  suppressHydrationWarning
                  value={issueOther}
                  onChange={(e) => setIssueOther(e.target.value)}
                  placeholder="Briefly describe your concern…"
                  className="min-w-[220px] flex-1 rounded-md border border-white/20 bg-white/[0.08] px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/35 focus:border-pulse-red"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = issueOther.trim();
                    if (!v) return;
                    setIssue(v);
                    advance(5);
                  }}
                  className="rounded-md bg-pulse-red px-4 py-2 font-sans text-[13px] font-semibold text-white hover:bg-[#a81117]"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="mb-3.5 font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {stepLabel(visiblePos)} &mdash; Your Situation
            </div>
            <p className="mb-3 font-sans text-[22px] font-bold text-white">
              In one sentence, describe where things stand.
            </p>
            <p className="mb-4 font-sans text-sm text-white/50">
              No need for technical detail &mdash; just tell us what&rsquo;s on your mind.
            </p>
            <textarea
              suppressHydrationWarning
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              rows={3}
              placeholder="e.g. We're a healthcare company that recently had a security scare and we're not sure if we're protected…"
              className="w-full resize-y rounded-lg border border-white/20 bg-white/[0.08] px-4 py-3.5 font-sans text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/35 focus:border-pulse-red"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => finish(situation.trim())}
                className="rounded-md bg-pulse-red px-8 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Show Me What You Can Do →
              </button>
              <button
                type="button"
                onClick={() => finish("")}
                className="font-sans text-[13px] text-white/40 underline hover:text-white/60"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        <div className="mt-9 h-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-pulse-red to-pulse-teal transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {!isModal && (
          <p className="mt-5 text-center font-sans text-[13px]">
            <Link href="/everyone" className="text-white/35 hover:text-white/55">
              Skip: just show me everything
            </Link>
          </p>
        )}
      </div>
    </div>
  );

  const inner = step === 1 ? step1Content : stepsAfterFirstContent;

  // ─────────── Outer chrome ───────────
  // Modal variant returns just the inner wizard so the dialog frame supplies
  // its own background, padding, and close affordance.
  if (isModal) {
    return <div className="py-8">{inner}</div>;
  }

  return (
    <section
      id="how-can-we-help"
      className="relative overflow-hidden border-t-4 border-pulse-red bg-dark-bg py-20"
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(213,23,30,0.1)_0%,transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(213,23,30,0.07)_0%,transparent_70%)]"
        aria-hidden
      />
      {inner}
    </section>
  );
}

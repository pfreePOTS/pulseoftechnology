"use client";

import { CaseStudyHeroIcon, caseStudyHeroPanelClass } from "@/components/CaseStudyHeroIcon";

import { useEffect, useRef, useState } from "react";

import type { RecommendedCaseStudy } from "@/lib/recommendedPathCaseStudies";
import { recommendedCaseStudiesForIndustry } from "@/lib/recommendedPathCaseStudies";

function cardProblem(cs: RecommendedCaseStudy): string {
  return cs.problem?.trim() || cs.title;
}

function cardWho(cs: RecommendedCaseStudy): string {
  if (cs.who?.trim()) return cs.who.trim();
  const t = cs.teaser?.replace(/\s*[—–-]\s*illustrative.*$/i, "").trim();
  return t || "Leadership and technology stakeholders";
}

function cardProvided(cs: RecommendedCaseStudy): string {
  if (cs.provided?.trim()) return cs.provided.trim();
  const sol = cs.solution?.trim();
  if (sol) {
    const first = sol.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (first && first.length > 24) {
      return first.length > 220 ? `${first.slice(0, 217).trimEnd()}…` : first;
    }
  }
  const t = cs.teaser?.replace(/\s*[—–-]\s*illustrative.*$/i, "").trim();
  return t?.length ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : "Advisory delivery, disciplined execution, and steady-state support.";
}

export default function RecommendedPathCaseStudies({
  industry,
}: {
  industry?: string;
}) {
  const studies = recommendedCaseStudiesForIndustry(industry);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<RecommendedCaseStudy | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (active) el.showModal();
    else if (el.open) el.close();
  }, [active]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      setActive(null);
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, []);

  const backdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) setActive(null);
  };

  const industryName = industry?.trim();
  const body = industryName
    ? `This is the kind of work we do in ${industryName}.`
    : "This is the kind of work we do for organisations like yours.";

  return (
    <section className="border-b border-[#e0e0e0] bg-[#f4f8fa] px-8 py-16 md:py-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
            Engagements
          </span>
          <h2 className="font-sans text-[38px] font-bold tracking-tight text-[#1a1a1a]">PulseOne in Action</h2>
          <p className="mx-auto mt-2 max-w-[640px] font-sans text-base leading-relaxed text-[#646464]">{body}</p>
        </div>

        <ul className="mx-auto grid max-w-[1040px] gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {studies.map((cs) => (
            <li key={cs.id} className="flex min-h-[100%]">
              <button
                type="button"
                onClick={() => setActive(cs)}
                className="group flex w-full flex-col overflow-hidden rounded-xl border border-[#e2e8ec] bg-white text-left shadow-sm ring-2 ring-transparent transition-all hover:border-pulse-teal/40 hover:shadow-md hover:ring-pulse-teal/[0.12]"
              >
                <div
                  className={`relative flex min-h-[100px] w-full shrink-0 flex-col justify-center gap-3 overflow-hidden bg-gradient-to-br px-6 py-5 ring-1 ring-black/[0.04] transition-colors ${caseStudyHeroPanelClass(cs.id)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <CaseStudyHeroIcon
                      caseStudyId={cs.id}
                      className="h-14 w-14 shrink-0 text-[#019E7C] transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/92 font-sans text-base font-bold text-pulse-red shadow-sm ring-1 ring-black/[0.06]"
                    >
                      +
                    </span>
                  </div>
                </div>
                <span className="flex flex-1 flex-col px-5 py-4">
                  <span className="font-sans text-[16px] font-bold leading-snug text-[#111]">{cardProblem(cs)}</span>
                  <span className="mt-3 block font-sans text-[12px] font-semibold uppercase tracking-[1.5px] text-pulse-teal">
                    Who we helped
                  </span>
                  <span className="mt-1 block font-sans text-[14px] leading-relaxed text-[#555]">{cardWho(cs)}</span>
                  <span className="mt-3 block font-sans text-[12px] font-semibold uppercase tracking-[1.5px] text-pulse-teal">
                    What we provided
                  </span>
                  <span className="mt-1 block flex-1 font-sans text-[14px] leading-relaxed text-[#555]">
                    {cardProvided(cs)}
                  </span>
                  <span className="mt-4 font-sans text-[13px] font-semibold text-pulse-teal">View detail</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <dialog
        ref={dialogRef}
        onClick={backdropClick}
        aria-labelledby="case-study-modal-title"
        className="m-0 max-h-[92vh] w-[min(560px,96vw)] overflow-hidden rounded-xl border border-[#e0e0e0] bg-white p-0 text-[#111] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col open:fixed open:inset-0 open:m-auto"
      >
        {active ?
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[#e8e8e8] bg-[#fafcfc] px-6 py-4">
              <h3 id="case-study-modal-title" className="font-sans text-lg font-bold leading-snug text-[#111]">
                {active.title}
              </h3>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close"
                className="shrink-0 rounded-md p-2 font-sans text-xl leading-none text-[#777] transition-colors hover:bg-black/[0.05] hover:text-[#111]"
              >
                ×
              </button>
            </div>
            <div className="max-h-[calc(92vh-4.5rem)] overflow-y-auto px-6 py-5">
              <ModalBlock label="Problem" text={cardProblem(active)} />
              <ModalBlock label="Who we helped" text={cardWho(active)} />
              <ModalBlock label="What we provided" text={cardProvided(active)} />
              <ModalBlock label="How we approached it" text={active.approach} />
              <ModalBlock label="Solution shape" text={active.solution} />
              <ModalBlock label="How PulseOne plugged in" text={active.howWeHelped} isLast />
            </div>
          </>
        : null}
      </dialog>
    </section>
  );
}

function ModalBlock({ label, text, isLast }: { label: string; text: string; isLast?: boolean }) {
  return (
    <div className={isLast ? "" : "mb-6"}>
      <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[2px] text-pulse-teal">{label}</p>
      <div className="rounded-lg border-l-4 border-l-pulse-red bg-[#f7fafb] px-4 py-3">
        <p className="font-sans text-[15px] leading-relaxed text-[#434343]">{text}</p>
      </div>
    </div>
  );
}

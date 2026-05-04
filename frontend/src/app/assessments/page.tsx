"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import BookingCalendar from "@/components/BookingCalendar";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";

type ConcernSlug =
  | "cybersecurity"
  | "ai"
  | "compliance"
  | "cloud"
  | "strategy"
  | "disaster";
type IndustrySlug = "healthcare" | "legal" | "manufacturing" | "financial" | "nonprofit";
type RoleSlug = "ceo" | "cio" | "ciso" | "coo";

type AssessmentCardModel = {
  id: string;
  title: string;
  description: string;
  primaryConcernTag: string;
  concern: ConcernSlug;
  industriesMatchAll: boolean;
  industries: IndustrySlug[];
  roles: RoleSlug[];
};

const CONCERN_FILTERS: { label: string; value: "all" | ConcernSlug }[] = [
  { label: "All", value: "all" },
  { label: "Cybersecurity", value: "cybersecurity" },
  { label: "AI & Emerging Tech", value: "ai" },
  { label: "Compliance & Risk", value: "compliance" },
  { label: "Cloud & Infrastructure", value: "cloud" },
  { label: "Strategy & Leadership", value: "strategy" },
  { label: "Disaster Recovery", value: "disaster" },
];

const INDUSTRY_FILTERS: { label: string; value: "all" | IndustrySlug }[] = [
  { label: "All", value: "all" },
  { label: "Healthcare", value: "healthcare" },
  { label: "Legal", value: "legal" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Financial Services", value: "financial" },
  { label: "Nonprofit", value: "nonprofit" },
];

const ROLE_FILTERS: { label: string; value: "all" | RoleSlug }[] = [
  { label: "All", value: "all" },
  { label: "CEO / Owner", value: "ceo" },
  { label: "CIO / CTO", value: "cio" },
  { label: "CISO", value: "ciso" },
  { label: "COO / Operations", value: "coo" },
];

const ASSESSMENT_GROUPS: Array<{
  groupKey: string;
  title: string;
  subtitle: string;
  icon: "red" | "teal" | "navy";
  cards: AssessmentCardModel[];
}> = [
  {
    groupKey: "cybersecurity",
    title: "Cybersecurity",
    subtitle: "Evaluate your readiness before an incident forces the conversation.",
    icon: "red",
    cards: [
      {
        id: "cyber-insurance-readiness",
        title: "Cyber Insurance Readiness Assessment",
        primaryConcernTag: "Cybersecurity",
        concern: "cybersecurity",
        industriesMatchAll: true,
        industries: [],
        roles: ["ciso", "coo"],
        description:
          "Elevate your cybersecurity posture with our free online Cyber Insurance Readiness assessment. Reveal hidden vulnerabilities within your network, systems, and applications, and take proactive measures to secure your valuable assets. This assessment guides you in evaluating your readiness for essential Cyber Insurance requirements, while uncovering potential discounts based on the robustness of your security framework.",
      },
    ],
  },
  {
    groupKey: "ai",
    title: "AI & Emerging Tech",
    subtitle: "Determine where AI creates real value for your organization and where it creates risk.",
    icon: "teal",
    cards: [
      {
        id: "microsoft-copilot-ai-readiness",
        title: "Microsoft Copilot AI Readiness Assessment",
        primaryConcernTag: "AI & Emerging Tech",
        concern: "ai",
        industriesMatchAll: true,
        industries: [],
        roles: ["cio", "ceo"],
        description:
          "At PulseOne, we understand the rapid pace of AI technology brings both opportunities and challenges. Our free online AI readiness assessment helps you pinpoint growth areas and guides you toward effectively and ethically leveraging AI. By employing advanced tools and proven methods, we enable you to assess your current capabilities while preparing for AI integration.",
      },
    ],
  },
  {
    groupKey: "disaster",
    title: "Disaster Recovery",
    subtitle: "Identify gaps in your resilience strategy before disruptions strike.",
    icon: "navy",
    cards: [
      {
        id: "disaster-recovery-readiness",
        title: "Disaster Recovery Readiness Assessment",
        primaryConcernTag: "Disaster Recovery",
        concern: "disaster",
        industriesMatchAll: true,
        industries: [],
        roles: ["cio", "ciso"],
        description:
          "Our online disaster recovery assessment helps business leaders enhance IT resilience by identifying gaps in their strategies and preparing for disruptions. This user-friendly tool guides you through tailored questions, allowing you to assess your readiness to respond to disasters while protecting essential assets. With a focus on proactive planning and actionable insights, our assessment aids in developing a strong disaster recovery strategy to ensure swift recovery and continuity during challenges.",
      },
    ],
  },
];

function roleMatches(selection: RoleSlug, tokens: RoleSlug[]) {
  return tokens.includes(selection);
}

function assessmentVisible(
  card: AssessmentCardModel,
  concern: "all" | ConcernSlug,
  industry: "all" | IndustrySlug,
  role: "all" | RoleSlug,
  q: string,
) {
  const concernOk = concern === "all" || card.concern === concern;
  const industryOk =
    industry === "all" || card.industriesMatchAll || card.industries.includes(industry);
  const roleOk = role === "all" || roleMatches(role, card.roles);

  const hay = `${card.title} ${card.description}`.toLowerCase();
  const searchOk = !q.trim() || hay.includes(q.trim().toLowerCase());

  return concernOk && industryOk && roleOk && searchOk;
}

function FilterPills<T extends string>(props: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { options, value, onChange } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            className={`cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 font-sans text-[13px] font-medium transition-colors ${
              active
                ? "border-pulse-teal bg-pulse-teal text-black"
                : "border-white/[0.18] bg-white/[0.06] text-white/70 hover:border-pulse-teal hover:bg-pulse-teal/10 hover:text-pulse-teal"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function GroupHeroIcon({ variant }: { variant: "red" | "teal" | "navy" }) {
  const bg =
    variant === "red"
      ? "bg-pulse-red"
      : variant === "teal"
        ? "bg-pulse-teal"
        : "bg-[#1a3a5c]";
  return (
    <div className={`${bg} flex size-10 shrink-0 items-center justify-center rounded-lg text-white`}>
      {variant === "red" ? (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth={2.2} />
        </svg>
      ) : variant === "teal" ? (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2.2} />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx="17" cy="7" r="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="currentColor"
            strokeWidth={2.2}
          />
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth={2.2} />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth={2.2} />
        </svg>
      )}
    </div>
  );
}

export default function AssessmentsPage() {
  const [concern, setConcern] = useState<(typeof CONCERN_FILTERS)[number]["value"]>("all");
  const [industry, setIndustry] = useState<(typeof INDUSTRY_FILTERS)[number]["value"]>("all");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");

  const { visibleIds, visibleCount } = useMemo(() => {
    const ids = new Set<string>();
    let n = 0;
    ASSESSMENT_GROUPS.forEach((g) => {
      g.cards.forEach((c) => {
        if (assessmentVisible(c, concern, industry, role, search)) {
          ids.add(c.id);
          n += 1;
        }
      });
    });
    return { visibleIds: ids, visibleCount: n };
  }, [concern, industry, role, search]);

  function clearAll() {
    setConcern("all");
    setIndustry("all");
    setRole("all");
    setSearch("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f4]">
      <GlobalHeader />

      <main className="flex flex-1 flex-col bg-white">
        {/* Hero shell — min-height + padding aligned with HeroSection / /radar */}
        <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden border-b-[3px] border-pulse-teal text-center">
          <Image
            src="/images/hero_assessments.png"
            alt=""
            fill
            priority
            className="object-cover object-[center_20%]"
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.55)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto w-full max-w-[1100px] px-6 py-16">
            <div className="mx-auto max-w-[760px]">
              <span className="mx-auto mb-4 inline-block rounded-full border border-pulse-teal/35 bg-pulse-teal/12 px-3.5 py-1.5 font-sans text-[13px] font-semibold tracking-[4px] text-pulse-teal uppercase">
                IT Assessments
              </span>
              <h1 className="mb-5 font-sans text-[clamp(2.125rem,5vw,58px)] leading-[1.1] font-bold tracking-tight text-white">
                Find Your{" "}
                <span className="text-pulse-red [text-shadow:0_0_40px_rgba(213,23,30,0.4)]">
                  Starting Point
                </span>
              </h1>
              <p className="mx-auto max-w-[600px] font-sans text-lg leading-relaxed text-white/78">
                Our assessments give you a clear picture of your technology environment and a prioritized path
                forward.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e8e8e8] px-6 py-14">
          <div className="mx-auto max-w-[1200px]">
            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              About Our Assessments
            </span>
            <h2 className="mb-3 max-w-[700px] font-sans text-[30px] font-bold text-[#1a1a1a]">
              How do our IT assessments work?
            </h2>
            <p className="mb-10 max-w-[700px] font-sans text-base leading-relaxed text-[#646464]">
              Each assessment follows a consistent three-section structure designed to give you a clear, scored
              picture of where your organization stands. Browse our collection of pre-made online IT assessments
              below.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="overflow-hidden rounded-lg border border-[#e4e4e4] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
                <div className="relative">
                  <Image
                    src="/images/card_team_table.jpg"
                    alt="Team working through assessment together"
                    width={400}
                    height={160}
                    className="h-[160px] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(213,23,30,0.38)] via-[rgba(10,10,10,0.15)] to-transparent" />
                </div>
                <div className="border-t-[3px] border-pulse-teal px-5 pb-6 pt-5">
                  <p className="mb-3 font-sans text-2xl font-bold leading-none text-pulse-teal/35">01</p>
                  <h3 className="mb-3 font-sans text-[15px] font-bold text-[#1a1a1a]">Three-Section Structure</h3>
                  <p className="font-sans text-[13.5px] leading-relaxed text-[#646464]">
                    Every assessment is organized into three scored sections. Each section targets a distinct
                    dimension of your technology environment, so you can see exactly where you&apos;re strong and where
                    gaps exist.
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#e4e4e4] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
                <div className="relative">
                  <Image
                    src="/images/card_three_sections.jpg"
                    alt="Scored results per section"
                    width={400}
                    height={160}
                    className="h-[160px] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(213,23,30,0.38)] via-[rgba(10,10,10,0.15)] to-transparent" />
                </div>
                <div className="border-t-[3px] border-pulse-teal px-5 pb-6 pt-5">
                  <p className="mb-3 font-sans text-2xl font-bold leading-none text-pulse-teal/35">02</p>
                  <h3 className="mb-3 font-sans text-[15px] font-bold text-[#1a1a1a]">Scored Results Per Section</h3>
                  <p className="font-sans text-[13.5px] leading-relaxed text-[#646464]">
                    Questions are scored, and you receive a result for each section individually. A low score in any
                    area suggests further exploration may be needed. High scores across all dimensions suggest strong
                    alignment.
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#e4e4e4] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
                <div className="relative">
                  <Image
                    src="/images/assess_team.jpg"
                    alt="Team or guided session"
                    width={400}
                    height={160}
                    className="h-[160px] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(213,23,30,0.38)] via-[rgba(10,10,10,0.15)] to-transparent" />
                </div>
                <div className="border-t-[3px] border-pulse-teal px-5 pb-6 pt-5">
                  <p className="mb-3 font-sans text-2xl font-bold leading-none text-pulse-teal/35">03</p>
                  <h3 className="mb-3 font-sans text-[15px] font-bold text-[#1a1a1a]">Solo, Team, or Guided</h3>
                  <p className="font-sans text-[13.5px] leading-relaxed text-[#646464]">
                    Assessments can be completed on your own or with your team. We recommend scheduling a session with
                    your team <strong className="font-bold text-[#1a1a1a]">and</strong> one of our business development
                    managers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-b border-white/10 bg-dark-bg px-6 py-7 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
            <p className="w-full font-sans text-[15px] font-semibold tracking-wide text-white/75">
              Search through our online IT assessments by concern, industry, and/or role.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <svg
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  placeholder="Search assessments…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border-2 border-white/15 bg-white/[0.07] py-2.5 pr-4 pl-10 font-sans text-sm text-white outline-none placeholder:text-white/35 focus:border-pulse-teal"
                  aria-label="Search assessments"
                />
              </div>
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer font-sans text-[13px] text-white/35 underline hover:text-pulse-red"
              >
                Clear all
              </button>
              <span className="ml-auto whitespace-nowrap rounded-xl border border-pulse-teal/30 bg-pulse-teal/12 px-2.5 py-1 font-sans text-[12px] font-semibold text-pulse-teal">
                {visibleCount} assessment{visibleCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[11px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Concern
                </span>
                <FilterPills options={CONCERN_FILTERS} value={concern} onChange={setConcern} />
              </div>
              <div className="hidden h-8 w-px shrink-0 self-center bg-white/15 sm:block" aria-hidden />
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[11px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Industry
                </span>
                <FilterPills options={INDUSTRY_FILTERS} value={industry} onChange={setIndustry} />
              </div>
              <div className="hidden h-8 w-px shrink-0 self-center bg-white/15 sm:block" aria-hidden />
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[11px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Role
                </span>
                <FilterPills options={ROLE_FILTERS} value={role} onChange={setRole} />
              </div>
            </div>
          </div>
        </div>

        <section className="scroll-mt-[76px] bg-[#f4f4f4] px-6 py-14 pb-[72px]">
          <div className="mx-auto max-w-[1200px]">
            {ASSESSMENT_GROUPS.map((group) => {
              const visibleInGroup = group.cards.filter((c) => visibleIds.has(c.id));
              if (!visibleInGroup.length) return null;
              return (
                <div key={group.groupKey} className="mb-14 last:mb-0">
                  <div className="mb-8 flex flex-wrap items-start gap-[14px]">
                    <GroupHeroIcon variant={group.icon} />
                    <div>
                      <h2 className="font-sans text-[22px] font-bold text-[#1a1a1a]">{group.title}</h2>
                      <p className="mt-1 font-sans text-sm leading-relaxed text-[#646464]">{group.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-3">
                    {visibleInGroup.map((c) => (
                      <article
                        key={c.id}
                        className="flex cursor-pointer flex-col overflow-hidden rounded-[10px] border border-[#e4e4e4] bg-white transition-colors hover:border-pulse-teal hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] hover:-translate-y-0.5"
                      >
                        <div className="flex flex-1 flex-col px-[22px] pt-[22px] pb-4">
                          <div className="mb-[14px] flex flex-wrap gap-1.5">
                            <span className="inline-block rounded-[10px] border border-pulse-teal/30 bg-pulse-teal/12 px-2 py-1 font-sans text-[10px] font-semibold uppercase tracking-[1.5px] text-[#0fa09b]">
                              {c.primaryConcernTag}
                            </span>
                          </div>
                          <h3 className="mb-2 font-sans text-[17px] font-bold leading-snug text-[#1a1a1a]">
                            {c.title}
                          </h3>
                          <p className="font-sans text-sm leading-relaxed text-[#646464]">{c.description}</p>
                        </div>
                        <div className="flex items-center justify-end border-t border-[#f0f0f0] px-[22px] py-3.5">
                          <Link
                            href="/contact"
                            className="inline-flex items-center gap-1 font-sans text-[13px] font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
                          >
                            View Assessment <span>→</span>
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}

            {visibleCount === 0 ? (
              <div className="rounded-lg border border-[#e0e0e0] bg-white px-6 py-[60px] text-center shadow-sm">
                <h3 className="mb-4 font-sans text-[22px] font-bold text-[#1a1a1a]">
                  No assessments match your filters.
                </h3>
                <p className="mx-auto max-w-lg font-sans text-[15px] text-[#646464]">
                  Try adjusting your filters, or{" "}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="cursor-pointer font-sans font-medium text-pulse-teal underline"
                  >
                    clear all filters
                  </button>{" "}
                  to see everything.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="schedule"
          className="relative overflow-hidden scroll-mt-[96px] border-t-[3px] border-pulse-red bg-dark-bg px-8 pt-[80px]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(213,23,30,0.10)_0%,transparent_70%)]" />
          <div className="relative mx-auto flex max-w-[760px] flex-col items-center text-center pb-24">
            <span className="mb-4 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Schedule an Assessment
            </span>
            <h2 className="mb-6 font-sans text-4xl leading-tight font-extrabold text-white">
              Ready to see where you stand?
              <br />
              Or don&apos;t see what you&apos;re looking for?
            </h2>
            <p className="mx-auto mb-14 max-w-[560px] font-sans text-[17px] leading-relaxed text-white/55">
              Pick a date and time below to complete an assessment with one of our team members or request a custom
              assessment for your situation.
            </p>
            <BookingCalendar
              introductoryCallLabel="45-minute meeting"
              slotDurationBadge="45 min"
              confirmAlertPhrase="Your 45-minute meeting has been requested"
              footerLine="All times shown in PST · 45-minute meeting"
            />
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}

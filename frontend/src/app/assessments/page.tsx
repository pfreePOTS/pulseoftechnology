"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import ContactCtaBand from "@/components/ContactCtaBand";
import FaqSection from "@/components/FaqSection";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import type { FaqItem } from "@/lib/schema";

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
  href: string;
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
        href: "https://getcyberready.info/pulseonecyber",
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
        href: "https://getcyberready.info/pulseoneai",
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
        href: "https://getcyberready.info/pulseonedr",
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

const ASSESSMENT_FAQ: FaqItem[] = [
  {
    question: "Are the assessments really free?",
    answer:
      "Yes. Each assessment is a free online self-assessment you complete on your own, with no cost and no obligation to engage PulseOne afterwards. You receive scored results by section whether or not you ever speak to us.",
  },
  {
    question: "How long does an assessment take?",
    answer:
      "Most people finish in one sitting. Each assessment is organised into three sections, and you can complete it alone or walk through it with your team if the answers span several people. Scored results are produced per section as soon as you finish.",
  },
  {
    question: "What is a cyber insurance readiness assessment?",
    answer:
      "It checks your technology environment against the controls cyber insurance carriers now ask about before quoting or renewing: sign-in protection, backups, patching, access management, and incident response. Organisations typically use it to find gaps before the renewal questionnaire arrives rather than during it.",
  },
  {
    question: "Do I have to become a client to get the results?",
    answer:
      "No. Results are yours to keep and act on however you choose, including handing them to your existing IT provider. If you want help closing the gaps, PulseOne can do that work, but nothing in the assessment depends on it.",
  },
  {
    question: "What if I need an assessment that is not listed?",
    answer:
      "PulseOne runs custom technology assessments covering infrastructure, security posture, platforms, and integration when the standard self-assessments do not fit the question you are asking. Those are scoped in a conversation rather than completed online.",
  },
];

export default function AssessmentsPage() {
  const [concern, setConcern] = useState<(typeof CONCERN_FILTERS)[number]["value"]>("all");
  const [industry, setIndustry] = useState<(typeof INDUSTRY_FILTERS)[number]["value"]>("all");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");

  const { visibleCount, visibleCards } = useMemo(() => {
    const cards: AssessmentCardModel[] = [];
    ASSESSMENT_GROUPS.forEach((g) => {
      g.cards.forEach((c) => {
        if (assessmentVisible(c, concern, industry, role, search)) {
          cards.push(c);
        }
      });
    });
    return { visibleCount: cards.length, visibleCards: cards };
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
            {visibleCount > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
                {visibleCards.map((c) => (
                  <a
                    key={c.id}
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-[10px] border border-[#e4e4e4] bg-white transition-colors hover:border-pulse-teal hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] hover:-translate-y-0.5"
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
                      <span className="inline-flex items-center gap-1 font-sans text-[13px] font-semibold text-pulse-red transition-[gap] duration-200 group-hover:gap-1.5">
                        View Assessment <span aria-hidden>→</span>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}

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

        <ContactCtaBand
          id="schedule"
          eyebrow="Request an Assessment"
          title={
            <>
              Ready to see where you stand?
              <br />
              Or don&apos;t see what you&apos;re looking for?
            </>
          }
          description="Tell us what you need — complete an assessment with our team or request a custom assessment for your situation."
          buttonLabel="Contact us"
        />

        <FaqSection items={ASSESSMENT_FAQ} heading="Assessment questions" />
      </main>

      <GlobalFooter />
    </div>
  );
}

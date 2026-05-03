import Image from "next/image";
import Link from "next/link";
import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import { APPROACH_PARTNERS } from "@/lib/approachPartners";

/** First three insights (“All Roles”) from `docs/frontend-redesign/source/our-approach.html`. */
const INSIGHT_CARDS_DEFAULT = [
  {
    tagClass: "bg-pulse-red/10 text-pulse-red",
    tagLabel: "Cybersecurity",
    title: "The Authentication Gap Most CISOs Don't Know Their Organizations Have",
    body: "Most organizations believe they're protected because they've deployed MFA. But there's a growing gap between MFA adoption and phishing-resistant authentication architecture that leaves critical systems exposed.",
    href: "https://blog.pulseone.com/the-authentication-gap-most-cisos-dont-know-their-organizations-have",
  },
  {
    tagClass: "bg-pulse-red/8 text-pulse-red",
    tagLabel: "Leadership",
    title: "The COO's Guide to Mitigating the Cost of Operational Downtime",
    body: "Ransomware and unplanned outages cost organizations an average of $5,600 per minute. This guide walks COOs through the continuity planning decisions that separate organizations that recover quickly from those that don't.",
    href: "https://blog.pulseone.com/the-coos-guide-to-mitigating-the-cost-of-operational-downtime",
  },
  {
    tagClass: "bg-pulse-teal/12 text-[#0fa09b]",
    tagLabel: "AI & Emerging Tech",
    title: "CCOs: Get Ready for AI Regulation Before It Arrives at Your Door",
    body: "AI governance frameworks are moving from voluntary guidelines to enforceable requirements. Chief Compliance Officers who wait for final rules will find themselves behind. Here's how to get ahead of it.",
    href: "https://blog.pulseone.com/ccos-get-ready-for-ai-regulation-before-it-arrives-at-your-door",
  },
];

const TIMELINE = [
  {
    year: "2002",
    title: "Founded in Ventura, CA",
    body: "We started as a regional IT services company focused on strategic and day-to-day technology needs for small and mid-sized businesses.",
    dotBorder: "border-pulse-red" as const,
    yearTint: "text-pulse-red" as const,
    icon: (
      <svg viewBox="0 0 24 24" width={24} height={24} className="fill-pulse-red" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
      </svg>
    ),
  },
  {
    year: "2016",
    title: "Acquired ICS",
    body: "We acquired a business services company, ICS, and added nation-wide project management and service management capabilities to our existing service offerings.",
    dotBorder: "border-[#13c3bd]" as const,
    yearTint: "text-[#13c3bd]" as const,
    icon: (
      <svg viewBox="0 0 24 24" width={24} height={24} className="fill-[#13c3bd]" aria-hidden>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
      </svg>
    ),
  },
  {
    year: "2020",
    title: "National Expansion",
    body: "We launched a growth initiative to open offices in local communities close to our existing team members, adding locations in Montana, New Jersey, Tennessee and expanded locations in Southern California.",
    dotBorder: "border-[#13c3bd]" as const,
    yearTint: "text-[#13c3bd]" as const,
    icon: (
      <svg viewBox="0 0 24 24" width={24} height={24} className="fill-[#13c3bd]" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    ),
  },
  {
    year: "Now & Future",
    title: "National Reach, Local Heart",
    body: "As a global IT services company, we prioritize supporting local businesses and business owners with the same dedication to customer service and relationships that have been our cornerstone.",
    dotBorder: "border-[#13c3bd]" as const,
    yearTint: "text-[#13c3bd]" as const,
    accentBg: true,
    icon: (
      <svg viewBox="0 0 24 24" width={24} height={24} className="fill-[#13c3bd]" aria-hidden>
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    ),
  },
];

const ENGAGE_STEPS = [
  {
    title: "Start with a Conversation",
    body: "Tell us about your organization, your challenges, and your goals. We listen before we recommend.",
  },
  {
    title: "We Assess Your Situation",
    body: "Our advisors conduct a structured review of your technology environment, risks, and opportunities.",
  },
  {
    title: "We Design, Plan, and Implement",
    body: "We create a custom technology roadmap and follow it according to your prioritized needs.",
  },
  {
    title: "We Work Alongside You",
    body: "Our team becomes an extension of yours.",
  },
];

export default function ApproachPage() {
  return (
    <>
      <GlobalHeader />
      <div className="h-[5px] w-full bg-gradient-to-r from-pulse-red to-pulse-teal" aria-hidden />

      <main className="flex flex-1 flex-col bg-white">
        {/* Hero shell — min-height + padding aligned with HeroSection / /radar */}
        <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden border-b-[3px] border-pulse-teal text-center">
          <Image
            src="/images/team_highfive.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_30%]"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.55)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-[60px] -left-[60px] size-[300px] rounded-full bg-[radial-gradient(circle,rgba(19,195,189,0.08)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto w-full max-w-[1100px] px-6 py-16">
            <div className="mx-auto max-w-[760px]">
              <div className="mx-auto mb-4 inline-block rounded-full border border-pulse-teal/35 bg-pulse-teal/12 px-3.5 py-1.5 font-sans text-[13px] font-semibold tracking-[4px] text-pulse-teal uppercase">
                People · Technology · Progress
              </div>
              <h1 className="mb-5 font-sans text-[clamp(2.125rem,5vw,58px)] leading-[1.1] font-bold tracking-tight text-white">
                Our Approach
              </h1>
              <p className="mx-auto max-w-[580px] font-sans text-lg leading-relaxed text-white/78">
                Your success is our success. PulseOne is your &quot;get IT done&quot; people.
              </p>
            </div>
          </div>
        </section>

        <section className="scroll-mt-[76px] px-6 py-[90px]" id="about">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
              <div>
                <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                  About PulseOne
                </span>
                <h2 className="mb-5 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[30px] font-bold leading-tight text-[#1a1a1a]">
                  Our Team is Your Team
                </h2>
                <div className="space-y-[14px] font-sans text-[15px] leading-[1.75] text-[#646464]">
                  <p>
                    PulseOne is a strategic technology advisory and IT integration firm. Since 2002, we&apos;ve
                    helped small and mid-sized organizations navigate the technology decisions that matter.
                  </p>
                  <p>
                    We are passionate about the power of people and technology to transform a company. We are
                    confident we can significantly enhance your business objectives and profitability.
                  </p>
                  <p>
                    With team members across the United States and internationally, we combine the responsiveness
                    of a local partner with the depth of an enterprise-level back office.
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.10)]">
                <div className="relative overflow-hidden">
                  <Image
                    src="/images/team_consulting.jpg"
                    alt="Our team"
                    width={800}
                    height={600}
                    className="block h-[300px] w-full object-cover"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(213,23,30,0.35)] via-[rgba(10,10,10,0.15)] to-transparent"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t-4 border-pulse-red bg-dark-bg px-6 py-[90px]">
          <div
            className="pointer-events-none absolute -top-20 -right-20 size-[400px] rounded-full bg-[radial-gradient(circle,rgba(213,23,30,0.1)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1100px]">
            <div className="mb-14 text-center">
              <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Our History
              </span>
              <h2 className="mt-3 font-sans text-4xl font-bold text-white">
                Two Decades of Doing It Right
              </h2>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute top-[28px] right-[18%] left-[14%] z-0 hidden h-0.5 bg-gradient-to-r from-pulse-red to-pulse-teal lg:block"
                aria-hidden
              />
              <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                {TIMELINE.map((t) => (
                  <article key={t.year} className="relative z-[1] px-4 text-center">
                    <div
                      className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-full border-[3px] bg-dark-bg ${t.dotBorder} ${
                        t.accentBg ? "border-[#13c3bd] bg-[rgba(19,195,189,0.15)]" : ""
                      }`}
                    >
                      {t.icon}
                    </div>
                    <p className={`mb-3 font-sans text-[15px] font-bold ${t.yearTint}`}>{t.year}</p>
                    <h3 className="mb-3 font-sans text-base font-bold text-white">{t.title}</h3>
                    <p className="font-sans text-[13.5px] leading-relaxed text-white/55">{t.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-4 border-pulse-teal bg-[#f4f4f4] px-6 py-[90px]" id="partners">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-14 text-center">
              <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Our Partners
              </span>
              <h2 className="mb-4 mt-3 font-sans text-4xl font-bold text-[#1a1a1a]">
                Our Services + Our Partners = Business Solutions
              </h2>
              <p className="mx-auto max-w-[600px] font-sans text-base leading-relaxed text-[#646464]">
                We work with best-in-class technology partners to deliver integrated solutions.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {APPROACH_PARTNERS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-[10px] border border-[#e0e0e0] bg-white px-6 py-7 transition-colors hover:border-pulse-teal hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                >
                  <div className="mb-4 flex h-[48px] items-center justify-center rounded-md border border-[#e8e8e8] bg-white px-2">
                    <Image
                      src={p.logoSrc}
                      alt={p.logoAlt}
                      width={180}
                      height={44}
                      className="max-h-[44px] w-auto max-w-full object-contain"
                      unoptimized={p.logoSrc.endsWith(".svg")}
                    />
                  </div>
                  <h3 className="mb-3 font-sans text-lg font-bold text-[#1a1a1a]">{p.name}</h3>
                  <p className="font-sans text-sm leading-relaxed text-[#646464]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#e8e8e8] px-6 py-[90px]" id="insights">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                  Our Insights
                </span>
                <h2 className="mb-2 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[34px] font-bold text-[#1a1a1a]">
                  What Leaders Are Reading
                </h2>
                <p className="max-w-xl pl-[23px] font-sans text-[15px] text-[#646464]">
                  Perspectives on the technology decisions that matter most right now.
                </p>
              </div>
              <Link
                href="https://blog.pulseone.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-sans text-sm font-semibold text-pulse-teal hover:underline"
              >
                View All Articles →
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {INSIGHT_CARDS_DEFAULT.map((c) => (
                <article
                  key={c.href}
                  className="flex flex-col overflow-hidden rounded-lg border border-[#e0e0e0] bg-[#f4f4f4] transition-colors hover:border-pulse-teal hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex flex-1 flex-col p-[22px] pb-[18px] pt-[22px]">
                    <span
                      className={`mb-2.5 inline-flex self-start rounded px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[2px] ${c.tagClass}`}
                    >
                      {c.tagLabel}
                    </span>
                    <h3 className="mb-4 flex-1 font-sans text-[17px] font-bold leading-snug text-[#1a1a1a]">
                      {c.title}
                    </h3>
                    <p className="mb-6 font-sans text-sm leading-relaxed text-[#646464]">{c.body}</p>
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sans text-[12.5px] font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
                    >
                      Read Article →
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://blog.pulseone.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded border-2 border-pulse-teal px-8 py-[11px] font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal hover:text-white"
              >
                Browse All Insights
              </Link>
              <Link
                href="/radar#subscribe"
                className="inline-block rounded bg-pulse-red px-8 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Get Daily Briefing
              </Link>
            </div>
          </div>
        </section>

        <ExecutiveIntakeForm />

        <section className="border-x-0 border-b border-t border-[#e8e8e8] border-t-[3px] border-t-pulse-teal bg-white px-6 py-12">
          <div className="mx-auto grid max-w-[1100px] md:grid-cols-4">
            <div className="border-[#e0e0e0] px-6 py-2 text-center md:border-r md:last:border-r-0">
              <p className="font-sans text-[38px] font-bold leading-none text-[#1a1a1a]">
                20<span className="text-pulse-teal">+</span>
              </p>
              <p className="mt-1.5 font-sans text-[13px] leading-snug text-[#646464]">Years in Business</p>
            </div>
            <div className="border-[#e0e0e0] px-6 py-2 text-center md:border-r md:last:border-r-0">
              <p className="font-sans text-[22px] font-bold leading-snug text-[#1a1a1a]">All U.S. Regions</p>
              <p className="mt-1.5 font-sans text-[13px] leading-snug text-[#646464]">We got you covered</p>
            </div>
            <div className="border-[#e0e0e0] px-6 py-2 text-center md:border-r md:last:border-r-0">
              <p className="font-sans text-[38px] font-bold leading-none text-[#1a1a1a]">
                30<span className="text-pulse-teal">+</span>
              </p>
              <p className="mt-1.5 font-sans text-[13px] leading-snug text-[#646464]">Industries Served</p>
            </div>
            <div className="border-[#e0e0e0] px-6 py-2 text-center">
              <p className="font-sans text-[38px] font-bold leading-none text-[#1a1a1a]">
                4.3 <span className="inline-block text-[22px] translate-y-[-1px] align-middle text-[#1a1a1a]">★</span>
              </p>
              <p className="mt-1.5 font-sans text-[13px] leading-snug text-[#646464]">On Google</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-6 py-[90px]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(213,23,30,0.12)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-[1100px] gap-14 lg:grid-cols-2 lg:items-start lg:gap-20">
            <div>
              <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                How to Engage Us
              </span>
              <h2 className="mb-5 font-sans text-[42px] font-bold leading-tight text-white">
                How to Engage PulseOne
              </h2>
              <p className="mb-9 font-sans text-[17px] leading-relaxed text-white/65">
                We make it easy to get started and discover where you are and where you want to go.
              </p>
              <div className="flex flex-col gap-7">
                {ENGAGE_STEPS.map((s, i) => (
                  <div key={s.title} className="flex gap-5">
                    <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-pulse-red font-sans text-sm font-bold text-white">
                      {i + 1}
                    </div>
                    <div>
                      <p className="mb-1 font-sans text-base font-semibold text-white">{s.title}</p>
                      <p className="font-sans text-[15px] leading-relaxed text-white/55">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center lg:p-10">
              <div className="-mx-8 mb-7 -mt-8 overflow-hidden rounded-t-xl lg:-mx-10 lg:-mt-10 lg:mb-8">
                <div className="relative">
                  <Image
                    src="/images/engage_cta.jpg"
                    alt="Start the conversation"
                    width={760}
                    height={240}
                    className="h-[240px] w-full object-cover"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(213,23,30,0.35)] via-[rgba(10,10,10,0.15)] to-transparent"
                    aria-hidden
                  />
                </div>
              </div>
              <h3 className="mb-8 font-sans text-[26px] font-bold text-white">Ready to start the conversation?</h3>
              <Link
                href="/contact"
                className="block w-full rounded bg-pulse-red py-[13px] font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Schedule a Meeting
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

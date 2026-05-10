import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";

import BookingCalendar from "@/components/BookingCalendar";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import { ssrFetchJson } from "@/lib/ssrPublicApi";

// Server-formatted date so SSR/CSR markup matches and we never hydration-mismatch.
const OVERVIEW_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

type OverviewTopic = {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
};

type OverviewContent = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  type: string;
  tags: string[];
};

type OverviewStats = {
  published_topics: number;
  distinct_domains: number;
  stories_last_24h: number;
  last_ingested_at: string | null;
};

type OverviewPayload = {
  headline: string;
  synthesis: string;
  synthesis_html: string;
  topics: OverviewTopic[];
  content_items: OverviewContent[];
  stats: OverviewStats;
};

const ENGAGEMENT_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Introductory Call",
    body: "A 30-minute no-pressure conversation with one of our advisors. We listen first — no pitch, no agenda. Just an honest conversation about where you are.",
  },
  {
    title: "Situation Review",
    body: "We take the time to understand your organization, your team, and the specific technology challenges you're navigating — including AI exposure and governance readiness.",
  },
  {
    title: "Recommended Path",
    body: "We present a clear, tailored recommendation — whether that's a single assessment, an advisory engagement, or a longer-term partnership. You decide what fits.",
  },
  {
    title: "We Work Alongside You",
    body: "Our team becomes an extension of yours — available, accountable, and always aligned with your business objectives, not just your technology stack.",
  },
];

async function fetchOverview(): Promise<OverviewPayload | null> {
  return ssrFetchJson<OverviewPayload>("/api/everyone-overview");
}

export default async function EveryonePage() {
  const data = await fetchOverview();
  const today = OVERVIEW_DATE_FORMAT.format(new Date());

  const stats = data?.stats;
  const synthesisHtml = data?.synthesis_html ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        {/* HERO — min-height + padding aligned with HeroSection / /radar */}
        <section className="relative flex min-h-[560px] items-center overflow-hidden border-b-4 border-pulse-teal bg-[#111]">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.65)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto w-full max-w-[1100px] px-6 py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                The Pulse of Technology — {today}
              </span>
            </div>
            <h1 className="mb-4 max-w-[820px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              {data?.headline ?? "Where C-suite attention is concentrated on the radar right now"}
            </h1>
            <p className="mb-8 max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              A broad, vendor-neutral overview of what every executive should be tracking this week.
              Generated from the live PulseOne radar — no profile required.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <StatBadge label="Live Topics" value={stats?.published_topics ?? "—"} />
              <StatBadge label="Domains" value={stats?.distinct_domains ?? "—"} />
              <StatBadge label="Stories / 24h" value={stats?.stories_last_24h ?? "—"} />
              <StatBadge label="Updated" value={today} />
            </div>
          </div>
        </section>

        {/* CONTEXT — AI synthesis (broad, no profile). */}
        <section className="border-b border-[#e0e0e0] bg-light-bg px-8 py-16">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-8 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                What Most Boards Are Re-Checking
              </span>
              <h2 className="mx-auto max-w-[680px] font-sans text-[38px] leading-tight font-bold tracking-tight text-[#111]">
                A C-suite overview of the current radar
              </h2>
            </div>
            {synthesisHtml ? (
              <div className="mx-auto max-w-[820px] rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-white px-7 py-6">
                <div
                  className="font-sans text-[15px] leading-relaxed text-[#555] [&>p]:mb-4 [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(synthesisHtml) }}
                />
              </div>
            ) : (
              <p className="mx-auto max-w-[680px] text-center font-sans text-sm text-[#555]">
                Live overview is briefly unavailable. Refresh in a moment, or explore the radar directly.
              </p>
            )}

            {/* Inline nudge: still personal-friendly without forcing the survey. */}
            <p className="mx-auto mt-8 max-w-[680px] text-center font-sans text-[13px] leading-relaxed text-[#555]">
              Want this tuned to your region, industry, role and current focus?{" "}
              <Link
                href="/#intake"
                className="font-semibold text-pulse-teal underline-offset-2 hover:underline"
              >
                Take the 60-second intake
              </Link>{" "}
              to generate your personalised path.
            </p>
          </div>
        </section>

        {/* RADAR SNAPSHOT — top topics across ALL domains (6, not 3). */}
        <section className="border-b border-[#e8e8e8] bg-dark-bg px-8 py-16 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-white/45 uppercase">
              Radar Snapshot
            </span>
            <h2 className="mb-8 font-sans text-[38px] font-bold tracking-tight text-white">
              Top signals across the radar right now
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(data?.topics ?? []).map((t) => (
                <div
                  key={t.id}
                  className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-6 py-7 transition-colors hover:border-pulse-teal/40 hover:bg-pulse-teal/[0.04]"
                >
                  <span className="mb-3 inline-block rounded px-2 py-0.5 font-sans text-[10px] font-bold tracking-wider text-pulse-teal uppercase">
                    {t.domain}
                  </span>
                  <h3 className="mb-2 font-sans text-base font-bold text-white">{t.name}</h3>
                  <p className="font-sans text-sm leading-relaxed text-white/50">
                    {t.summary ?? "Published radar topic — open the full radar for more context."}
                  </p>
                  <p className="mt-3 font-sans text-xs text-white/35">
                    Urgency {t.urgency_score.toFixed(1)}
                  </p>
                </div>
              ))}
              {(!data?.topics || data.topics.length === 0) && (
                <p className="font-sans text-sm text-white/45 md:col-span-2 lg:col-span-3">
                  No published topics yet — explore the full radar for live signals.
                </p>
              )}
            </div>
            <div className="mt-10">
              <Link
                href="/radar#radar"
                className="inline-flex items-center gap-2 rounded-md border border-pulse-teal/40 bg-pulse-teal/10 px-5 py-2.5 font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal/20"
              >
                Open the full radar →
              </Link>
            </div>
          </div>
        </section>

        {/* RESOURCES — most recent published items, broad. */}
        <section className="bg-white px-6 py-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Recent Resources
              </span>
              <h2 className="font-sans text-[38px] font-bold tracking-tight text-[#111]">
                Latest curated reading for executives
              </h2>
            </div>
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.content_items ?? []).map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col rounded-lg border border-[#e0e0e0] bg-[#f7f7f7] p-5 transition-all hover:border-pulse-teal hover:shadow-md"
                >
                  <span className="mb-2 inline-block rounded bg-pulse-teal/12 px-2 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-[#0e9490] uppercase">
                    {c.type}
                  </span>
                  <h3 className="mb-2 flex-1 font-sans text-[17px] leading-snug font-bold text-[#111]">
                    {c.title}
                  </h3>
                  <p className="mb-4 font-sans text-sm leading-relaxed text-[#555]">
                    {c.summary ?? ""}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 font-sans text-[12.5px] font-semibold text-pulse-red">
                    Open resource →
                  </span>
                </a>
              ))}
              {(!data?.content_items || data.content_items.length === 0) && (
                <p className="col-span-full text-center font-sans text-sm text-[#555]">
                  No curated items published yet.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* HOW WE WORK — same 4-step content as /recommended-path. */}
        <section className="border-t border-[#e0e0e0] bg-light-bg px-8 py-20">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-12 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                How We Work
              </span>
              <h2 className="mb-2.5 font-sans text-[38px] font-bold tracking-tight text-[#111]">
                What Engaging PulseOne Looks Like
              </h2>
              <p className="mx-auto max-w-[560px] font-sans text-base leading-relaxed text-[#555]">
                Every relationship starts with a conversation. Here&rsquo;s what the first 30 days
                typically look like.
              </p>
            </div>
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {ENGAGEMENT_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-[10px] border border-[#e0e0e0] bg-white px-5 py-7 text-center"
                >
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-pulse-red font-sans text-base font-extrabold text-white">
                    {i + 1}
                  </div>
                  <h3 className="mb-2 font-sans text-sm font-bold text-[#111]">{step.title}</h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#555]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* BOOKING CALENDAR CTA — same component as /recommended-path. */}
        <section className="relative overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-8 pt-20 pb-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(213,23,30,0.10)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-[760px] text-center">
            <span className="mb-2.5 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Ready When You Are
            </span>
            <h2 className="mb-4 font-sans text-4xl leading-tight font-extrabold text-white">
              Let&rsquo;s talk about what this looks like for{" "}
              <em className="text-pulse-teal not-italic">your</em> organization.
            </h2>
            <p className="mx-auto mb-2 max-w-[560px] font-sans text-[17px] leading-relaxed text-white/55">
              Schedule a conversation about where you are and where you want to go.
            </p>
            <BookingCalendar />
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.05] px-3.5 py-1.5">
      <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
        {label}
      </span>
      <span className="font-sans text-[15px] font-semibold text-white">{value}</span>
    </div>
  );
}

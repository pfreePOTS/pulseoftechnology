import Image from "next/image";

import BookingCalendar from "@/components/BookingCalendar";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import RecommendedPathCaseStudies from "@/components/RecommendedPathCaseStudies";
import { resolveRecommendedPathHeroBackground } from "@/lib/recommendedPathHero";
import { SSR_PUBLIC_API_BASE, ssrFetchJson } from "@/lib/ssrPublicApi";

function hasAnyRecommendedIntake(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  return ["region", "industry", "role", "issue", "stage"].some(
    (k) => firstParam(sp, k).trim().length > 0,
  );
}

export type RecommendedTopicPayload = {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
};

export type RecommendedContentPayload = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  type: string;
  tags: string[];
};

export type ExperienceItemPayload = {
  title: string;
  description: string;
};

export type RecommendedWatchStoryPayload = {
  title: string;
  url: string;
  hook: string;
  radar_topic_name: string;
  domain: string;
};

export type SynthesisCardPayload = {
  title: string;
  bullets: string[];
};

export type RecommendedPathPayload = {
  headline: string;
  synthesis: string;
  /** Server-escaped HTML (paragraph wrap) — safe for dangerouslySetInnerHTML. */
  synthesis_html: string;
  synthesis_cards?: SynthesisCardPayload[];
  experience_items: ExperienceItemPayload[];
  topics: RecommendedTopicPayload[];
  content_items: RecommendedContentPayload[];
  watch_brief: string;
  watch_posture: string;
  watch_stories: RecommendedWatchStoryPayload[];
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

function firstParam(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

async function fetchRecommended(
  sp: Record<string, string | string[] | undefined>,
): Promise<RecommendedPathPayload | null> {
  if (!hasAnyRecommendedIntake(sp)) return null;

  const u = new URL(`${SSR_PUBLIC_API_BASE}/api/recommended-path`);
  const keys = ["region", "industry", "role", "issue", "stage"] as const;
  for (const k of keys) {
    u.searchParams.set(k, firstParam(sp, k).trim());
  }

  return ssrFetchJson<RecommendedPathPayload>(u.toString());
}

export default async function RecommendedPathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await fetchRecommended(sp);

  const region = firstParam(sp, "region");
  const industry = firstParam(sp, "industry");
  const role = firstParam(sp, "role");
  const issue = firstParam(sp, "issue");
  const stageForDisplay = firstParam(sp, "stage").trim();

  const synthesisHtml = data?.synthesis_html ?? "";
  const synthesisCards = data?.synthesis_cards ?? [];
  const experienceItems = data?.experience_items ?? [];
  const watchBrief = data?.watch_brief ?? "";
  const watchPosture = data?.watch_posture ?? "";
  const watchStories = data?.watch_stories ?? [];
  const contentItems = data?.content_items ?? [];

  const heroBg = resolveRecommendedPathHeroBackground(industry, issue, stageForDisplay);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        {/* HERO — thematic image (AI / sector) + Pulse red–teal wash aligned with radar/home */}
        <section className="relative min-h-[520px] overflow-hidden border-b-4 border-pulse-teal px-8 py-16">
          <Image
            src={heroBg.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: heroBg.objectPosition }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/76 via-black/62 to-black/76"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-pulse-red/32 via-transparent to-pulse-teal/18"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/45 via-transparent to-black/55"
            aria-hidden
          />
          <div className="relative z-[2] mx-auto max-w-[1100px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                Your Recommended Path
              </span>
            </div>
            <h1 className="mb-4 max-w-[760px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              {data?.headline ?? "Your personalized path at PulseOne"}
            </h1>
            <p className="mb-8 max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              Based on what you shared, we&rsquo;ve pulled together the experience, insights, and
              next steps most relevant to your role, your region, and your focus area.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {(
                [
                  ["Region", region],
                  ["Industry", industry],
                  ["Role", role],
                  ["Focus", issue],
                  ["Stage", stageForDisplay],
                ] as const
              )
                .filter(([, val]) => Boolean(val))
                .map(([label, val]) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.05] px-3.5 py-1.5"
                  >
                    <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
                      {label}
                    </span>
                    <span className="font-sans text-[15px] font-semibold text-white">{val}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* TALK-WITH-AN-EXPERT BANNER — early CTA for the "I'd rather just talk"
            visitor. Anchor-jumps to the booking calendar at the bottom. */}
        <section className="border-b border-[#e0e0e0] bg-white px-8 py-7">
          <div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div className="flex items-start gap-3 md:items-center">
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-pulse-red md:mt-0"
                aria-hidden
              />
              <p className="font-sans text-[15px] leading-relaxed text-[#333]">
                <span className="font-bold text-[#111]">Prefer to skip the read?</span>{" "}
                <span className="text-[#555]">
                  Talk with one of our advisors directly — no pitch, just a conversation about
                  where you are.
                </span>
              </p>
            </div>
            <a
              href="#schedule"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-pulse-red bg-pulse-red px-5 py-2.5 font-sans text-[13.5px] font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Talk with an expert →
            </a>
          </div>
        </section>

        {/* OUR EXPERIENCE — capability cards tailored to the reader's industry+issue. */}
        <section className="border-b border-[#e0e0e0] bg-light-bg px-8 py-16 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-10 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Our Experience
              </span>
              <h2 className="mx-auto max-w-[720px] font-sans text-[38px] leading-tight font-bold tracking-tight text-[#111]">
                What we do for {industry || "companies"} leaders facing this
              </h2>
            </div>
            {experienceItems.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                {experienceItems.map((e) => (
                  <article
                    key={e.title}
                    className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-red bg-white px-6 py-6 transition-shadow hover:shadow-md"
                  >
                    <h3 className="mb-2 font-sans text-[17px] font-bold text-[#111]">{e.title}</h3>
                    <p className="font-sans text-[14.5px] leading-relaxed text-[#555]">
                      {e.description}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mx-auto max-w-[680px] text-center font-sans text-sm text-[#555]">
                Our capability cards are briefly unavailable. Refresh in a moment, or jump straight
                to a conversation below.
              </p>
            )}
          </div>
        </section>

        {/* WHAT WE THINK — AI executive synthesis (was "Strategic context"). */}
        <section className="border-b border-[#e0e0e0] bg-white px-8 py-16">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-8 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                What We Think
              </span>
              <h2 className="mx-auto max-w-[720px] font-sans text-[38px] leading-tight font-bold tracking-tight text-[#111]">
                Strategic context for your leadership team
              </h2>
            </div>
            {synthesisCards.length > 0 ? (
              <div
                className={
                  synthesisCards.length >= 3
                    ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    : "mx-auto grid max-w-[940px] gap-6 md:grid-cols-2"
                }
              >
                {synthesisCards.map((card, idx) => (
                  <article
                    key={`${card.title}-${idx}`}
                    className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-light-bg px-6 py-5"
                  >
                    <h3 className="mb-3 font-sans text-[16px] font-bold leading-snug text-[#111]">
                      {card.title}
                    </h3>
                    <ul className="space-y-2.5">
                      {(card.bullets ?? []).map((bullet, bi) => (
                        <li
                          key={`${idx}-${bi}`}
                          className="flex gap-3 font-sans text-[14.5px] leading-relaxed text-[#555]"
                        >
                          <span
                            className="mt-[0.42em] h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-teal"
                            aria-hidden
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : synthesisHtml ? (
              <div className="mx-auto max-w-[820px] rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-light-bg px-7 py-6">
                <div
                  className="font-sans text-[15px] leading-relaxed text-[#555] [&>p]:mb-4 [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: synthesisHtml }}
                />
              </div>
            ) : (
              <p className="mx-auto max-w-[680px] text-center font-sans text-sm text-[#555]">
                Add intake parameters to the URL or complete the survey on the homepage to load
                your personalized synthesis.
              </p>
            )}
          </div>
        </section>

        <RecommendedPathCaseStudies industry={industry || undefined} />

        {/* WHAT WE'RE WATCHING — intake-grounded radar analysis, posture line, and ingested stories. */}
        <section className="border-b border-[#e8e8e8] bg-dark-bg px-8 py-16 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-10">
              <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                What We&rsquo;re Watching
              </span>
              <h2 className="font-sans text-[38px] font-bold tracking-tight text-white">
                Radar signal tuned to what you shared
              </h2>
              <p className="mt-3 max-w-[720px] font-sans text-[15px] leading-relaxed text-white/55">
                A short analysis and posture read based on your profile, anchored to themes and ingested briefing
                lines from the Pulse — not an abstract technology laundry list.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
              <div className="lg:col-span-3 space-y-5">
                {watchBrief.trim() ? (
                  <p className="font-sans text-[15px] leading-relaxed text-white/82">{watchBrief}</p>
                ) : (
                  <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 font-sans text-sm text-white/45">
                    We don&rsquo;t have enough personalised narrative yet — widen your intake answers or revisit in a moment
                    while the radar refreshes.
                  </p>
                )}

                {watchPosture.trim() ? (
                  <div className="rounded-xl border border-pulse-teal/35 bg-pulse-teal/[0.07] px-5 py-4">
                    <p className="mb-2 font-sans text-[11px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                      Your posture snapshot
                    </p>
                    <p className="font-sans text-[15px] leading-relaxed text-white/88">{watchPosture}</p>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 font-sans text-[12px] font-semibold tracking-[2px] text-white/45 uppercase">
                    Stories tied to those themes on the Pulse
                  </h3>
                  {watchStories.length > 0 ? (
                    <ul className="space-y-3">
                      {watchStories.map((s) => (
                        <li key={`${s.url}-${s.title}`}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-pulse-teal/40 hover:bg-white/[0.05]"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-block rounded bg-pulse-teal/15 px-2 py-0.5 font-sans text-[10px] font-bold tracking-wider text-pulse-teal uppercase">
                                {s.domain}
                              </span>
                              <span className="font-sans text-[12px] text-white/40">
                                Radar: {s.radar_topic_name}
                              </span>
                            </div>
                            <p className="mb-1.5 font-sans text-[15px] font-semibold leading-snug text-white underline-offset-4 group-hover:text-pulse-teal group-hover:underline">
                              {s.title}
                            </p>
                            <p className="font-sans text-[13px] leading-relaxed text-white/62">{s.hook}</p>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-sans text-sm text-white/45">
                      Fresh ingested briefing lines are syncing for these radar themes — open the explorer for everything
                      that&rsquo;s live right now.
                    </p>
                  )}
                </div>

                <a
                  href="/radar#radar"
                  className="inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-pulse-teal hover:underline"
                >
                  See the full radar →
                </a>
              </div>

              <aside className="lg:col-span-2">
                <div className="relative overflow-hidden rounded-[14px] border border-pulse-teal/40 bg-gradient-to-b from-pulse-teal/[0.12] to-pulse-teal/[0.04] p-7 shadow-[0_8px_28px_rgba(1,158,124,0.18)]">
                  <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                    Daily Briefing
                  </span>
                  <h3 className="mb-3 font-sans text-[20px] leading-tight font-bold text-white">
                    Get this in your inbox every morning.
                  </h3>
                  <p className="mb-5 font-sans text-[14px] leading-relaxed text-white/65">
                    PulseOne&rsquo;s daily C-level briefing surfaces the radar themes &mdash; and
                    the stories driving them &mdash; in a 3-minute read.
                  </p>

                  {contentItems.length > 0 && (
                    <div className="mb-6 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                      <span className="mb-2 block font-sans text-[10px] font-semibold tracking-[2px] text-white/45 uppercase">
                        In today&rsquo;s briefing
                      </span>
                      <ul className="space-y-1.5">
                        {contentItems.slice(0, 3).map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start gap-2 font-sans text-[13px] leading-snug text-white/75"
                          >
                            <span
                              className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-pulse-teal"
                              aria-hidden
                            />
                            <span className="line-clamp-2">{c.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href="/radar#subscribe"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-pulse-red px-5 py-3 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-[#a81117]"
                  >
                    Subscribe to the daily briefing →
                  </a>
                  <p className="mt-3 text-center font-sans text-[12px] text-white/45">
                    Free. One email a day. Unsubscribe in one click.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* HOW TO ENGAGE — 4-step process (was "What Engaging PulseOne Looks Like"). */}
        <section className="border-t border-[#e0e0e0] bg-light-bg px-8 py-20">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-12 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                How to Engage
              </span>
              <h2 className="mb-2.5 font-sans text-[38px] font-bold tracking-tight text-[#111]">
                What working with PulseOne looks like
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

        {/* SCHEDULE A CALL — booking calendar. Anchor target for the early CTA. */}
        <section
          id="schedule"
          className="relative scroll-mt-[72px] overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-8 pt-20 pb-16"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(213,23,30,0.10)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-[760px] text-center">
            <span className="mb-2.5 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Schedule a Call
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

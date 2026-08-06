import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import RadarSection from "@/components/RadarSection";
import TrackedStoriesSection, {
  type TrackedArticle,
} from "@/components/TrackedStoriesSection";
import SubscribeWizard from "@/components/SubscribeWizard";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import { type RadarTopic } from "@/components/RadarChart";
import { formatStoryDateUtc } from "@/lib/formatStoryDateUtc";
import { ssrFetchJson } from "@/lib/ssrPublicApi";
import { API_BASE } from "@/lib/api";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import { breadcrumbSchema, type FaqItem } from "@/lib/schema";

const DESCRIPTION =
  "Track which technology domains are moving and what they mean for your organization. A curated radar and daily briefing written for C-suite readers.";

export const metadata: Metadata = {
  title: "Technology Radar and Daily Briefing",
  description: DESCRIPTION,
  alternates: { canonical: "/radar" },
  openGraph: {
    type: "website",
    url: "/radar",
    title: "Technology Radar and Daily Briefing",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Technology Radar and Daily Briefing",
    description: DESCRIPTION,
  },
};

const FAQ: FaqItem[] = [
  {
    question: "What is the Pulse of Technology radar?",
    answer:
      "The radar is a curated view of the technology domains moving fastest right now, scored by how urgently they warrant executive attention. It is maintained by PulseOne and written for leaders who need to know what changed and why it matters, not for specialists tracking product releases.",
  },
  {
    question: "How often is the radar updated?",
    answer:
      "Topics and tracked stories update continuously as signals are reviewed, and the daily briefing summarises what moved. The page shows when the radar was last updated so you can see how current the view is.",
  },
  {
    question: "What does the daily briefing include?",
    answer:
      "The briefing summarises the signals that moved on the radar, filtered to the domains and industry you select when subscribing. It is written for scanning in a few minutes and links through to the underlying stories when you want the detail.",
  },
  {
    question: "Do I need to be a PulseOne client to use the radar?",
    answer:
      "No. The radar and the briefing are open to any executive who wants them, with no sign-in and no client relationship required. Subscribing asks only for the details needed to tailor which signals you receive.",
  },
];

type TrackedArticleApi = Omit<TrackedArticle, "displayDate">;

async function getPublishedTopics(): Promise<RadarTopic[]> {
  const data = await ssrFetchJson<RadarTopic[]>("/api/topics/published");
  return data ?? [];
}

async function getTrackedArticles(): Promise<TrackedArticle[]> {
  const data = await ssrFetchJson<TrackedArticleApi[]>(
    "/api/articles/tracked?limit=12",
  );
  if (!data) return [];
  return data.map((row) => ({
    ...row,
    displayDate: formatStoryDateUtc(row.published_at ?? row.ingested_at),
  }));
}

/** Server-formatted "Updated" date for the radar title. Computed once per
 *  request (page is `cache: "no-store"` upstream) and passed to the client
 *  RadarSection as a string so SSR/CSR rendering stays identical. */
const RADAR_UPDATED_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function RadarPage() {
  const [topics, trackedArticles] = await Promise.all([
    getPublishedTopics(),
    getTrackedArticles(),
  ]);
  const lastUpdated = RADAR_UPDATED_FORMAT.format(new Date());

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <GlobalHeader />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Radar" }])} />
      <main className="flex-1">
        {/* HERO — sizing/padding/gradient match HeroSection.tsx so the homepage
            and /radar heroes feel like one design system, but each owns its
            own background asset (radar → /pulse_of_technology_hero.png;
            homepage → /FrontPage_SecurityImage.png). Update layout/gradient
            together. */}
        <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden text-center">
          <Image
            src="/pulse_of_technology_hero.png"
            alt=""
            fill
            priority
            className="object-cover object-[center_12%]"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-[rgba(10,10,10,0.72)] via-[rgba(10,10,10,0.55)] to-[rgba(10,10,10,0.75)]"
            aria-hidden
          />
          <div className="relative z-[2] mx-auto w-full max-w-[1320px] px-6 py-16">
            <div className="mb-4 inline-block rounded-full border border-pulse-teal/35 bg-pulse-teal/12 px-3.5 py-1.5 font-sans text-[13px] font-semibold tracking-[4px] text-pulse-teal uppercase">
              Pulse of Technology Radar
            </div>
            <h1 className="mb-5 font-sans text-[clamp(2.125rem,5vw,58px)] leading-[1.1] font-bold tracking-tight text-white xl:whitespace-nowrap">
              Technology Intelligence for{" "}
              <span className="text-pulse-red [text-shadow:0_0_40px_rgba(213,23,30,0.4)]">
                C-Suite Leaders
              </span>
            </h1>
            <p className="mx-auto mb-7 max-w-[660px] font-sans text-lg leading-relaxed text-white/78">
              The Pulse of Technology Radar is PulseOne&rsquo;s live view of the technology
              landscape: which emerging technologies matter to your industry, what your
              posture should be, and when to act.
            </p>
            <div className="flex flex-wrap justify-center gap-3.5">
              <a
                href="#radar"
                className="inline-block rounded bg-pulse-red px-[26px] py-[13px] font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Explore the Radar
              </a>
              <a
                href="#subscribe"
                className="inline-block rounded border-2 border-white/50 bg-transparent px-[26px] py-[11px] font-sans text-sm font-semibold text-white transition-colors hover:border-white"
              >
                Get Our Daily Briefing
              </a>
            </div>
          </div>
        </section>
        {/* `#radar` wraps the red→teal accent strip AND the radar so the
            "Explore the Radar" CTA scrolls to a clean, framed view (gradient
            strip just below the sticky header, "Key Trending Topics" control
            bar + full radar visible below) instead of jumping past the
            gradient and clipping it.

            `scroll-mt-[96px]` approximates stacked logo + tagline in `GlobalHeader`
            (`min-h-[80px]` + vertical padding); update together if header height changes. */}
        <div id="radar" className="scroll-mt-[96px]">
          <div
            className="h-[5px] w-full bg-gradient-to-r from-pulse-red to-pulse-teal"
            aria-hidden
          />
          <RadarSection topics={topics} lastUpdated={lastUpdated} />
        </div>

        {trackedArticles.length > 0 && (
          <TrackedStoriesSection
            articles={trackedArticles}
            lastUpdated={lastUpdated}
          />
        )}

        {/* Credibility bridge: the radar reads as a newsletter unless the page
            says the same people also do the work. Sends warm readers to the
            services hub without interrupting the subscribe flow below. */}
        <section className="border-t-[3px] border-pulse-teal bg-dark-bg px-6 py-12">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:gap-8 sm:text-left">
            <div>
              <h2 className="mb-1.5 font-sans text-[22px] font-bold leading-snug text-white">
                When a signal turns into work, the same team does the work.
              </h2>
              <p className="font-sans text-[15px] leading-relaxed text-white/60">
                The radar is run by the advisors and engineers who manage business technology
                for our clients every day, not by a research desk.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-block shrink-0 rounded border-2 border-pulse-teal px-7 py-[11px] font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal hover:text-white"
            >
              See Our Services
            </Link>
          </div>
        </section>

        <section id="subscribe" className="scroll-mt-4 bg-white px-6 py-14">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-2 text-center font-sans text-[38px] leading-tight font-bold tracking-tight text-pulse-teal">
              Get Personalised Intelligence
            </h2>
            <p className="mb-8 text-center text-gray-600">
              Curated radar briefings for your industry and domains, in your inbox every
              morning.
            </p>
            <SubscribeWizard apiBase={API_BASE} />
          </div>
        </section>

        <FaqSection items={FAQ} heading="About the radar" tone="surface" />
      </main>
      <GlobalFooter />
    </div>
  );
}

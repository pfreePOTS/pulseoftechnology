import Image from "next/image";
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
              .
            </h1>
            <p className="mx-auto mb-7 max-w-[640px] font-sans text-lg leading-relaxed text-white/78">
              Cut through the noise. Know exactly which emerging technologies matter to your
              industry, what your posture should be, and when to act.
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

        <section id="subscribe" className="scroll-mt-4 bg-white px-6 py-14">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-2 text-center font-sans text-[38px] leading-tight font-bold tracking-tight text-pulse-teal">
              Get Personalised Intelligence
            </h2>
            <p className="mb-8 text-center text-gray-600">
              Receive curated radar briefings tailored to your industry and domains — delivered
              daily to your inbox.
            </p>
            <SubscribeWizard apiBase={API_BASE} />
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import ExperienceItemIcon from "@/components/ExperienceItemIcon";
import RecommendedPathBuildingScreen from "@/components/RecommendedPathBuildingScreen";
import RecommendedPathCaseStudies from "@/components/RecommendedPathCaseStudies";
import {
  fetchRecommendedPathTwoStage,
  fetchRecommendedPathWatchStories,
} from "@/lib/recommendedPathClientApi";
import { resolveExperienceItemIcon } from "@/lib/experienceItemInference";
import type { RecommendedHeroImage } from "@/lib/recommendedPathHero";
import { fallbackHeadlineFromIntake } from "@/lib/recommendedPathIntakeCopy";
import { synthesisCardHeroAbsoluteSrc } from "@/lib/recommendedPathSynthesisHero";
import SynthesisCardBandImages from "@/components/SynthesisCardBandImages";
import { engagementExamplesToCaseStudies } from "@/lib/recommendedPathEngagements";
import type { RecommendedPathIntake, RecommendedPathPayload } from "@/lib/recommendedPathTypes";
import { distinctTopicSlugsForCards, type SynthesisFocusBannerSlug } from "@/lib/synthesisFocusBanner";

type Props = {
  intake: RecommendedPathIntake;
  hasIntake: boolean;
  heroBg: RecommendedHeroImage;
};

type RecommendedPathOurProcessCardProps = {
  card: NonNullable<RecommendedPathPayload["synthesis_cards"]>[number];
  idx: number;
  industry: string;
  topicSlug: SynthesisFocusBannerSlug;
};

function RecommendedPathOurProcessCard({
  card,
  idx,
  industry,
  topicSlug,
}: RecommendedPathOurProcessCardProps) {
  const heroSrc = synthesisCardHeroAbsoluteSrc(card.hero_image_url);

  return (
    <article className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-light-bg">
      {/*
        Fixed pixel height triple-locked per breakpoint — min/h/max — so bands stay identical across
        all four cards; pair with native `<img>` + object-cover in SynthesisCardBandImages (avoid
        next/image fill wrapper quirks).
      */}
      <div className="relative isolate w-full shrink-0 flex-none overflow-hidden min-h-[148px] h-[148px] max-h-[148px] sm:min-h-[156px] sm:h-[156px] sm:max-h-[156px] lg:min-h-[172px] lg:h-[172px] lg:max-h-[172px]">
        {heroSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc}
              alt=""
              className="absolute inset-0 z-[1] block h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </>
        ) : (
          <SynthesisCardBandImages
            key={`${card.title}-${idx}-${topicSlug}`}
            industry={industry}
            topicSlug={topicSlug}
            variationIndex={idx}
          />
        )}
        {/*
          Light scrim to blend tile into ``light-bg`` body — kept subtle so JPG bands stay legible.
          A full-opacity ``from-light-bg`` wiped ~½ the strip and reads as “everything is blurred”.
        */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(to_top,rgba(244,248,250,0.58)_0%,rgba(244,248,250,0.12)_42%,transparent_72%)]"
          aria-hidden
        />
      </div>
      <div className="flex flex-1 flex-col px-6 pb-5 pt-4">
        <h3 className="mb-3 font-sans text-[16px] font-bold leading-snug text-[#111]">{card.title}</h3>
        <ul className="space-y-2.5">
          {(card.bullets ?? []).map((bullet, bi) => (
            <li
              key={`${idx}-${bi}`}
              className="flex gap-3 font-sans text-[14.5px] leading-relaxed text-[#555]"
            >
              <span className="mt-[0.42em] h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-teal" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function scrollRecommendedPathViewportTop(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export default function RecommendedPathProgressiveBody({ intake, hasIntake, heroBg }: Props) {
  const { region, industry, role, issue, stage: stageForDisplay } = intake;

  // Re-fetch only when the intake VALUES change. A re-render that passes a new
  // object with identical values must not abort and restart the request cycle
  // (each restart abandons a long-running backend build).
  const stableIntake = useMemo<RecommendedPathIntake>(
    () => ({ region, industry, role, issue, stage: stageForDisplay }),
    [region, industry, role, issue, stageForDisplay],
  );

  const [data, setData] = useState<RecommendedPathPayload | null>(null);
  const [buildingOverlay, setBuildingOverlay] = useState(hasIntake);
  const [watchStoriesLoading, setWatchStoriesLoading] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const overlayScrollRef = useRef<HTMLDivElement>(null);
  const prevBuildingOverlay = useRef(buildingOverlay);

  const intakeFingerprint = [region, industry, role, issue, stageForDisplay].join("\u0001");

  useLayoutEffect(() => {
    scrollRecommendedPathViewportTop();
  }, [intakeFingerprint]);

  useLayoutEffect(() => {
    if (buildingOverlay) overlayScrollRef.current?.scrollTo(0, 0);
  }, [buildingOverlay]);

  useLayoutEffect(() => {
    if (prevBuildingOverlay.current && !buildingOverlay) {
      scrollRecommendedPathViewportTop();
    }
    prevBuildingOverlay.current = buildingOverlay;
  }, [buildingOverlay]);

  useEffect(() => {
    if (!hasIntake) {
      setBuildingOverlay(false);
      setData(null);
      setFetchFailed(false);
      setWatchStoriesLoading(false);
      return;
    }

    setBuildingOverlay(true);
    setFetchFailed(false);
    setWatchStoriesLoading(false);
    setData(null);

    let cancelled = false;
    let watchStoriesStarted = false;
    const ac = new AbortController();

    const loadWatchStoriesOnce = async (): Promise<void> => {
      if (watchStoriesStarted) return;
      watchStoriesStarted = true;
      setWatchStoriesLoading(true);
      try {
        const stories = await fetchRecommendedPathWatchStories(stableIntake, ac.signal);
        if (cancelled || ac.signal.aborted) return;
        if (stories !== null) setData((prev) => (prev ? { ...prev, watch_stories: stories } : prev));
      } finally {
        setWatchStoriesLoading(false);
      }
    };

    const { promise } = fetchRecommendedPathTwoStage(
      stableIntake,
      {
        onShell: (payload) => {
          if (cancelled || ac.signal.aborted) return;
          setData((prev) => prev ?? payload);
          setBuildingOverlay(false);
          void loadWatchStoriesOnce();
        },
        onAi: (payload) => {
          if (cancelled || ac.signal.aborted) return;
          setData((prev) => {
            const merged: RecommendedPathPayload = { ...payload };
            const prevStories = prev?.watch_stories;
            if (Array.isArray(prevStories) && prevStories.length > 0) {
              merged.watch_stories = prevStories;
            }
            return merged;
          });
          setBuildingOverlay(false);
          void loadWatchStoriesOnce();
        },
        onError: () => {
          if (cancelled || ac.signal.aborted) return;
          setFetchFailed(true);
          setBuildingOverlay(false);
        },
      },
      ac.signal,
    );
    void promise;

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [hasIntake, stableIntake]);

  useEffect(() => {
    if (!(hasIntake && buildingOverlay)) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [buildingOverlay, hasIntake]);

  const headlineResolved =
    (data?.headline?.trim() && data.headline) ||
    fallbackHeadlineFromIntake(region, industry, role, issue, stageForDisplay) ||
    "Your personalized path at PulseOne";

  const synthesisHtml = data?.synthesis_html ?? "";
  const synthesisCards = data?.synthesis_cards ?? [];
  const synthesisCardTopicSlugs = useMemo(() => {
    const cards = data?.synthesis_cards;
    if (!cards?.length) return [];
    return distinctTopicSlugsForCards(
      cards.map((c) => c.title),
      issue,
    );
  }, [data?.synthesis_cards, issue]);
  const experienceItems = data?.experience_items ?? [];
  const watchBrief = data?.watch_brief ?? "";
  const watchPosture = data?.watch_posture ?? "";
  const watchStories = data?.watch_stories ?? [];
  const contentItems = data?.content_items ?? [];
  const engagementCaseStudies = useMemo(
    () => engagementExamplesToCaseStudies(data?.engagement_examples),
    [data?.engagement_examples],
  );

  let heroSubtext: ReactNode;
  if (!hasIntake) {
    heroSubtext = (
      <>
        Share a bit about your situation from the homepage survey or intake links to get a tailored path, radar tie-ins,
        and next steps.
      </>
    );
  } else if ((fetchFailed || !data) && !buildingOverlay) {
    heroSubtext = (
      <>
        We couldn&rsquo;t finish loading your briefing. Your answers are still in the URL. Try{" "}
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="font-semibold text-white underline decoration-white/45 underline-offset-2 transition-colors hover:decoration-white"
        >
          reload this page
        </button>{" "}
        in a moment, or use &ldquo;Talk with an expert&rdquo; below.
      </>
    );
  } else if (!data || buildingOverlay) {
    heroSubtext = (
      <>
        We&rsquo;re tailoring your briefing from your intake and the live Pulse radar. This usually takes a moment.
      </>
    );
  } else {
    heroSubtext = (
      <>
        Based on what you shared, we&rsquo;ve pulled together the experience, insights, and next steps most relevant to
        your role, your region, and your focus area.
      </>
    );
  }

  return (
    <>
      {hasIntake && buildingOverlay ? (
        <div
          ref={overlayScrollRef}
          className="fixed inset-x-0 top-[96px] bottom-0 z-[95] overflow-y-auto bg-dark-bg shadow-[inset_0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <RecommendedPathBuildingScreen embedded />
        </div>
      ) : null}

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
        <div className="relative z-[2] mx-auto max-w-[1200px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
            <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
              Your Recommended Path
            </span>
          </div>
          <h1 className="mb-4 max-w-[760px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
            {headlineResolved}
          </h1>
          <p className="mb-8 max-w-[680px] font-sans text-lg leading-relaxed text-white/60">{heroSubtext}</p>
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

      <section className="border-b border-[#e0e0e0] bg-light-bg px-8 py-16 md:py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10 text-center">
            <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Our Solutions
            </span>
            <h2 className="mx-auto max-w-[720px] font-sans text-[38px] leading-tight font-bold tracking-tight text-[#111]">
              What we can do to help
            </h2>
          </div>
          {experienceItems.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {experienceItems.map((e) => (
                <article
                  key={e.title}
                  className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-red bg-white px-6 py-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex gap-5">
                    <div
                      className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-pulse-teal/12 text-pulse-teal"
                      aria-hidden
                    >
                      <ExperienceItemIcon variant={resolveExperienceItemIcon(e)} className="size-[26px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 font-sans text-[17px] font-bold text-[#111]">{e.title}</h3>
                      <p className="font-sans text-[14.5px] leading-relaxed text-[#555]">{e.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mx-auto max-w-[680px] text-center font-sans text-sm text-[#555]">
              {hasIntake
                ? "Our capability cards are briefly unavailable. Refresh in a moment, or jump straight to a conversation below."
                : "Add intake parameters to the URL or complete the survey on the homepage to see how we typically help leaders like you."}
            </p>
          )}
        </div>
      </section>

      <section className="border-b border-[#e0e0e0] bg-white px-8 py-7">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-start gap-3 md:items-center">
            <span
              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-pulse-red md:mt-0"
              aria-hidden
            />
            <p className="font-sans text-[15px] leading-relaxed text-[#333]">
              <span className="font-bold text-[#111]">Prefer to skip the read?</span>{" "}
              <span className="text-[#555]">
                Talk with one of our advisors directly. No pitch, just a conversation about where you are.
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

      <section className="border-b border-[#e0e0e0] bg-white px-8 py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-8 text-center">
            <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Our Process
            </span>
            <h2 className="mx-auto max-w-[720px] font-sans text-[38px] leading-tight font-bold tracking-tight text-[#111]">
              How we work with you
            </h2>
            {hasIntake && (stageForDisplay.trim() || issue.trim()) ?
              <p className="mx-auto mt-4 max-w-[720px] font-sans text-[16px] leading-relaxed text-[#555]">
                {issue.trim() ?
                  <>
                    <span className="font-semibold text-[#333]">What you prioritised:</span> {issue.trim()}
                    {stageForDisplay.trim() ? " · " : ""}
                  </>
                : null}
                {stageForDisplay.trim() ?
                  <>
                    <span className={issue.trim() ? "" : "font-semibold text-[#333]"}>
                      {issue.trim() ? "Your situation: " : <>What you&apos;re looking for: </>}
                    </span>
                    <span className="italic text-[#444]">&ldquo;{stageForDisplay.trim()}&rdquo;</span>
                  </>
                : null}
              </p>
            : null}
          </div>
          {synthesisCards.length > 0 ? (
            <div
              className={
                synthesisCards.length >= 4
                  ? "grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4"
                  : synthesisCards.length === 3
                    ? "grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    : "mx-auto grid max-w-[940px] items-stretch gap-6 md:grid-cols-2"
              }
            >
              {synthesisCards.map((card, idx) => (
                <RecommendedPathOurProcessCard
                  key={`${card.title}-${idx}`}
                  card={card}
                  idx={idx}
                  industry={industry}
                  topicSlug={synthesisCardTopicSlugs[idx]!}
                />
              ))}
            </div>
          ) : synthesisHtml ? (
            <div className="mx-auto max-w-[820px] rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-light-bg px-7 py-6">
              <div
                className="font-sans text-[15px] leading-relaxed text-[#555] [&>p]:mb-4 [&>p:last-child]:mb-0"
                // synthesis_html is built by backend `_paragraphs_to_html`, which HTML-escapes
                // each paragraph before wrapping it in <p>; nothing reaches this surface unsanitized.
                dangerouslySetInnerHTML={{ __html: synthesisHtml }}
              />
            </div>
          ) : (
            <p className="mx-auto max-w-[680px] text-center font-sans text-sm text-[#555]">
              {hasIntake
                ? "Your personalized synthesis will appear here once loaded."
                : "Add intake parameters to the URL or complete the survey on the homepage to load your personalized synthesis."}
            </p>
          )}
        </div>
      </section>

      <RecommendedPathCaseStudies
        intake={{
          industry: industry || undefined,
          issue: issue || undefined,
          stage: stageForDisplay || undefined,
        }}
        studiesFromApi={engagementCaseStudies}
      />

      <section className="border-b border-[#e8e8e8] bg-dark-bg px-8 py-16 md:py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10">
            <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              What We&rsquo;re Watching
            </span>
            <h2 className="font-sans text-[38px] font-bold tracking-tight text-white">Radar signal tuned to what you shared</h2>
            <p className="mt-3 max-w-[720px] font-sans text-[15px] leading-relaxed text-white/55">
              Stories and themes from the live Pulse, matched to your
              profile.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
            <div className="lg:col-span-3 space-y-5">
              {watchBrief.trim() ? (
                <p className="font-sans text-[15px] leading-relaxed text-white/82">{watchBrief}</p>
              ) : (
                <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 font-sans text-sm text-white/45">
                  We don&rsquo;t have enough personalised narrative yet. Widen your intake answers or revisit in a moment
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
                  Stories on the Pulse for these themes
                </h3>
                {watchStories.length > 0 ? (
                  <ul className="space-y-3">
                    {watchStories.map((s) => (
                      <li key={`${s.url}-${s.title}`}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex gap-3 rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-3 py-3 transition-colors hover:border-pulse-teal/40 hover:bg-white/[0.05] sm:px-4 sm:py-3.5"
                        >
                          {s.image_url ?
                            <div className="relative h-[72px] w-[104px] shrink-0 overflow-hidden rounded-lg bg-white/[0.06] sm:h-20 sm:w-[120px]">
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote article thumbnails from many domains */}
                              <img
                                src={s.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          : null}
                          <div className="min-w-0 flex-1 py-0.5">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-block rounded bg-pulse-teal/15 px-2 py-0.5 font-sans text-[10px] font-bold tracking-wider text-pulse-teal uppercase">
                                {s.domain}
                              </span>
                              <span className="font-sans text-[12px] text-white/40">Radar: {s.radar_topic_name}</span>
                            </div>
                            <p className="mb-1.5 font-sans text-[15px] font-semibold leading-snug text-white underline-offset-4 group-hover:text-pulse-teal group-hover:underline">
                              {s.title}
                            </p>
                            <p className="font-sans text-[13px] leading-relaxed text-white/62">{s.hook}</p>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : watchStoriesLoading ? (
                  <div className="space-y-2.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <div className="h-4 w-[55%] max-w-[240px] animate-pulse rounded bg-white/[0.12]" />
                    <div className="h-4 w-[90%] max-w-[340px] animate-pulse rounded bg-white/[0.08]" />
                    <p className="pt-1 font-sans text-sm text-white/45">Loading Pulse stories from the radar pool…</p>
                  </div>
                ) : (
                  <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-sans text-sm text-white/45">
                    No recent Pulse stories matched these themes yet. Try the live radar for the full feed.
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
                  PulseOne&rsquo;s daily C-level briefing surfaces the radar themes &mdash; and the stories driving them
                  &mdash; in a 3-minute read.
                </p>

                {contentItems.length > 0 ? (
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
                ) : null}

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
    </>
  );
}

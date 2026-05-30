import ContactCtaBand from "@/components/ContactCtaBand";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import RecommendedPathProgressiveBody from "@/components/RecommendedPathProgressiveBody";
import { intakePlainText } from "@/lib/intakePlainText";
import { resolveRecommendedPathHeroBackground } from "@/lib/recommendedPathHero";
import type { RecommendedPathIntake } from "@/lib/recommendedPathTypes";

export type {
  ExperienceItemPayload,
  RecommendedContentPayload,
  RecommendedPathPayload,
  RecommendedPathIntake,
  RecommendedTopicPayload,
  RecommendedWatchStoryPayload,
  SynthesisCardPayload,
} from "@/lib/recommendedPathTypes";

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

function hasAnyRecommendedIntake(intake: RecommendedPathIntake): boolean {
  return (
    intake.region.trim().length > 0 ||
    intake.industry.trim().length > 0 ||
    intake.role.trim().length > 0 ||
    intake.issue.length > 0 ||
    intake.stage.length > 0
  );
}

export default async function RecommendedPathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const intake: RecommendedPathIntake = {
    region: firstParam(sp, "region").trim(),
    industry: firstParam(sp, "industry").trim(),
    role: firstParam(sp, "role").trim(),
    issue: intakePlainText(firstParam(sp, "issue")),
    stage: intakePlainText(firstParam(sp, "stage")),
  };
  const hasIntake = hasAnyRecommendedIntake(intake);
  const heroBg = resolveRecommendedPathHeroBackground(intake.industry, intake.issue, intake.stage);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        <RecommendedPathProgressiveBody intake={intake} hasIntake={hasIntake} heroBg={heroBg} />

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
                Every relationship starts with a conversation. Here&rsquo;s what the first 30 days typically look
                like.
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

        <ContactCtaBand
          id="schedule"
          eyebrow="Get in Touch"
          title={
            <>
              Let&rsquo;s talk about what this looks like for{" "}
              <em className="text-pulse-teal not-italic">your</em> organization.
            </>
          }
          description="Send us a message about where you are and where you want to go — an advisor will follow up within one business day."
        />
      </main>
      <GlobalFooter />
    </div>
  );
}

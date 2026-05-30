import Image from "next/image";
import Link from "next/link";
import ContactCtaBand from "@/components/ContactCtaBand";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";

const CONTEXT_CARDS = [
  {
    title: "What we're seeing in Western healthcare right now",
    body: "Hospitals and health systems in California, Oregon, and Washington are facing increased scrutiny on AI-assisted clinical decision tools. CEOs who lack a formal AI governance policy are being caught off guard during accreditation reviews.",
  },
  {
    title: "The CEO's blind spot on AI",
    body: "Most healthcare CEOs we speak with are aware AI is a priority — but have delegated it entirely to IT or clinical leadership. That gap between awareness and ownership is where risk accumulates quietly.",
  },
  {
    title: 'What "good" looks like at your level',
    body: 'A healthcare CEO who\'s ahead of this issue has a clear AI policy framework, knows which vendors in their stack are using AI, and has had a direct conversation with their board about AI risk and opportunity.',
  },
];

const ARTICLES = [
  {
    tagClass: "bg-pulse-teal/15 text-[#0e9490]",
    tag: "AI & Emerging Tech · Healthcare",
    title: "When Your Staff Adopts AI Before Your Policy Does: A CEO's Guide to Getting Ahead of It",
    body: "Shadow AI adoption in healthcare is accelerating. Here's how executive leaders can build a governance framework that doesn't stifle innovation — but does protect the organization.",
  },
  {
    tagClass: "bg-pulse-teal/15 text-[#0e9490]",
    tag: "Strategic Leadership · AI",
    title: "The Board Conversation Every Healthcare CEO Needs to Have About AI in 2025",
    body: "Boards are asking about AI. Most CEOs aren't ready to answer with confidence. This piece walks through the three questions your board will ask — and how to prepare for them.",
  },
  {
    tagClass: "bg-[rgba(100,100,100,0.15)] text-[#646464]",
    tag: "Compliance & Risk · Healthcare",
    title: "AI Vendor Claims vs. Reality: What Healthcare CEOs Should Be Asking Before Signing",
    body: 'Every healthcare technology vendor now claims their platform is "AI-powered." Here\'s a practical framework for evaluating those claims — and the questions your legal and IT teams should be asking.',
  },
];

const SERVICES: Array<{
  icon: string;
  title: string;
  body: string;
  featured?: boolean;
}> = [
  {
    icon: "🧠",
    title: "AI Readiness Assessment",
    body: "A structured executive briefing that maps your current AI exposure, identifies governance gaps, and gives you a clear picture of where your organization stands — and what to do next.",
    featured: true,
  },
  {
    icon: "🛡️",
    title: "Strategic Technology Advisory",
    body: "Ongoing advisory support for healthcare executives navigating complex technology decisions — from vendor selection to board-level reporting on technology risk and investment.",
    featured: true,
  },
  {
    icon: "📋",
    title: "Executive Technology Assessment",
    body: "A comprehensive review of your technology environment from a business leadership perspective — not an IT audit, but a strategic snapshot designed for the C-suite.",
  },
  {
    icon: "🔒",
    title: "Cybersecurity & Compliance Review",
    body: "Healthcare organizations face unique compliance requirements — HIPAA, HITECH, and increasingly, state-level AI regulations. We help you understand your exposure and close the gaps.",
  },
  {
    icon: "☁️",
    title: "Managed IT Services",
    body: "For healthcare organizations that need a reliable, HIPAA-aware technology partner to manage day-to-day operations while leadership focuses on strategy.",
  },
  {
    icon: "📊",
    title: "Vendor & Platform Review",
    body: "Independent evaluation of the technology platforms you're considering — with a focus on AI capabilities, data practices, and long-term strategic fit for your organization.",
  },
];

const EXPECT_STEPS = [
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

export default function CustomSolutionsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex flex-1 flex-col">
        {/* Hero shell — min-height + padding aligned with HeroSection / /radar */}
        <section className="relative isolate flex min-h-[560px] items-center overflow-hidden border-b-4 border-pulse-teal">
          <Image
            src="/hero-bg.png"
            alt=""
            fill
            priority
            className="absolute inset-0 object-cover object-center"
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.65)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[2] mx-auto w-full max-w-[1100px] px-6 py-16">
            <div className="mb-7 inline-flex items-center gap-2 rounded-[24px] border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="size-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[12px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                Your Recommended Path
              </span>
            </div>
            <h1 className="mb-4 max-w-[760px] font-sans text-[clamp(1.75rem,4vw,42px)] font-extrabold leading-snug text-white">
              Here&apos;s what PulseOne looks like for a <em className="text-pulse-teal not-italic">Healthcare CEO</em>{" "}
              in the West.
            </h1>
            <p className="mb-8 max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              Based on what you shared, we&apos;ve pulled together the services, insights, and next steps most
              relevant to your role, your region, and your focus on AI &amp; Emerging Technology.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-2">
                <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Region
                </span>
                <span className="font-sans text-[15px] font-semibold text-white">West</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-2">
                <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Industry
                </span>
                <span className="font-sans text-[15px] font-semibold text-white">Healthcare</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-2">
                <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Role
                </span>
                <span className="font-sans text-[15px] font-semibold text-white">CEO / President</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 py-2">
                <span className="font-sans text-[10px] font-semibold tracking-[2px] text-white/35 uppercase">
                  Focus
                </span>
                <span className="font-sans text-[15px] font-semibold text-white">AI &amp; Emerging Tech</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e0e0e0] bg-[#f5f5f5] px-8 py-16">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-9 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                What This Means For You
              </span>
              <h2 className="mx-auto mb-3 max-w-[720px] font-sans text-[30px] font-bold leading-tight text-[#111]">
                Using AI in Healthcare is a leadership decision.
              </h2>
              <p className="mx-auto max-w-[680px] font-sans text-[15px] leading-relaxed text-[#646464]">
                For healthcare CEOs in the West, the pressure around AI adoption is accelerating faster than most
                governance frameworks can keep up with. Here&apos;s what we&apos;re seeing on the ground.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {CONTEXT_CARDS.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-pulse-teal bg-white px-5 py-5 md:px-[20px] md:py-[18px]"
                >
                  <h3 className="mb-2 font-sans text-sm font-bold text-[#111]">{c.title}</h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#646464]">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#e8e8e8] px-8 py-[80px]">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Insights Picked For You
              </span>
              <h2 className="inline-block font-sans text-[32px] font-bold text-[#111]">
                What Healthcare CEOs Are Reading
              </h2>
              <p className="mx-auto mt-3 max-w-[600px] font-sans text-[15px] leading-relaxed text-[#646464]">
                Articles and perspectives from our editorial team, selected for your role and focus area.
              </p>
            </div>
            <div className="grid gap-7 md:grid-cols-3">
              {ARTICLES.map((a) => (
                <article
                  key={a.title}
                  className="flex flex-col overflow-hidden rounded-lg border border-[#e0e0e0] bg-[#f7f7f7] shadow-none transition-colors hover:border-pulse-teal hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex flex-1 flex-col p-[22px] pt-[22px] pb-[18px]">
                    <span
                      className={`mb-2.5 inline-flex self-start rounded px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[2px] ${a.tagClass}`}
                    >
                      {a.tag}
                    </span>
                    <h3 className="mb-3 flex-1 font-sans text-[17px] font-bold leading-snug text-[#111]">
                      {a.title}
                    </h3>
                    <p className="mb-[22px] font-sans text-sm leading-relaxed text-[#646464]">{a.body}</p>
                    <Link
                      href="https://blog.pulseone.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sans text-[12.5px] font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
                    >
                      Read Article →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b-4 border-pulse-red bg-dark-bg px-8 py-[72px]">
          <div className="mx-auto max-w-[1100px]">
            <span className="mb-4 block font-sans text-[13px] font-semibold tracking-[3px] text-white/45 uppercase">
              Recommended For You
            </span>
            <h2 className="mb-4 font-sans text-[32px] font-bold text-white">Services Aligned to Your Situation</h2>
            <p className="mb-10 max-w-[600px] font-sans text-base leading-relaxed text-white/50">
              These are the PulseOne services most relevant to a healthcare CEO focused on AI governance and
              strategic technology leadership.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {SERVICES.map((s) => (
                <div
                  key={s.title}
                  className={`rounded-[10px] border border-white/[0.08] px-6 py-7 transition-colors hover:border-pulse-teal/40 hover:bg-pulse-teal/[0.04] ${
                    s.featured ? "border-pulse-teal/35 bg-pulse-teal/[0.06]" : "bg-white/[0.04]"
                  }`}
                >
                  <div className="mb-3 text-[28px]" aria-hidden>
                    {s.icon}
                  </div>
                  <h3 className="mb-2 font-sans text-base font-bold text-white">{s.title}</h3>
                  <p className="mb-4 font-sans text-sm leading-relaxed text-white/50">{s.body}</p>
                  {s.featured ? (
                    <div className="mb-4">
                      <span className="inline-block rounded bg-pulse-teal/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[1.5px] text-pulse-teal">
                        Top Match
                      </span>
                    </div>
                  ) : null}
                  <a href="#" className="font-sans text-[13px] font-semibold text-pulse-teal hover:underline">
                    Learn More →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#e0e0e0] bg-[#f5f5f5] px-8 py-[72px]">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-12 text-center">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                How We Work
              </span>
              <h2 className="mb-3 font-sans text-[32px] font-bold text-[#111]">
                What Engaging PulseOne Looks Like
              </h2>
              <p className="mx-auto max-w-[560px] font-sans text-base leading-relaxed text-[#646464]">
                Every relationship starts with a conversation. Here&apos;s what the first 30 days typically look
                like for a healthcare executive.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {EXPECT_STEPS.map((s, idx) => (
                <div
                  key={s.title}
                  className="rounded-[10px] border border-[#e0e0e0] bg-white px-6 py-7 text-center"
                >
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-pulse-red font-sans text-base font-extrabold text-white">
                    {idx + 1}
                  </div>
                  <h3 className="mb-3 font-sans text-sm font-bold text-[#111]">{s.title}</h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#646464]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ContactCtaBand
          id="schedule"
          eyebrow="Ready When You Are"
          title="Let's talk about what this looks like for your organization."
          description="Send us a message about where you are and where you want to go — an advisor will follow up within one business day."
        />
      </main>
      <GlobalFooter />
    </div>
  );
}

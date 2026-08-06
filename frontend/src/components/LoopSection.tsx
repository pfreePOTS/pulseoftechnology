import Link from "next/link";

/**
 * The flywheel, told once, as a router: each column names one beat of the
 * PulseOne loop and ends in the conversion action that matches it (subscribe,
 * intake, services). Its job is routing visitors into a funnel path, not
 * explaining the company — keep each body to two sentences.
 */
const BEATS = [
  {
    title: "See it coming",
    body: "The Pulse of Technology Radar tracks what is moving and scores it for executive urgency, tuned to your industry. A daily briefing tells you what changed and whether it matters to you.",
    cta: "Get the Daily Briefing",
    href: "#subscribe",
  },
  {
    title: "Know where you stand",
    body: "Sixty seconds of context — your industry, your role, what is on your mind — returns a recommended path: where you stand and what to do next. No sales call required.",
    cta: "Start the 60-Second Intake",
    href: "#how-can-we-help",
  },
  {
    title: "Make the most of it",
    body: "When a signal turns into work, the same team does the work. Managed business technology, security, and AI adoption that keeps improving instead of just staying up.",
    cta: "See Our Services",
    href: "/services",
  },
];

export default function LoopSection() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 max-w-[760px]">
          <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
            How It Fits Together
          </span>
          <h2 className="mb-4 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[34px] leading-tight font-bold tracking-tight text-[#1a1a1a]">
            See it coming. Know where you stand. Make the most of it.
          </h2>
          <p className="font-sans text-[16px] leading-[1.8] text-[#646464]">
            One team watches the technology landscape, tells you what it means for your
            industry, and then does the work — and keeps improving it.
          </p>
        </div>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {BEATS.map((beat, index) => (
            <li key={beat.title} className="flex flex-col">
              <div className="mb-4 flex size-9 items-center justify-center rounded-full bg-pulse-red font-sans text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mb-2.5 font-sans text-xl font-bold text-[#1a1a1a]">{beat.title}</h3>
              <p className="mb-5 flex-1 font-sans text-[15px] leading-[1.75] text-[#646464]">
                {beat.body}
              </p>
              <Link
                href={beat.href}
                className="inline-flex items-center gap-1 font-sans text-sm font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
              >
                {beat.cta} →
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

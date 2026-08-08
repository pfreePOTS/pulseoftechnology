import Link from "next/link";

/**
 * The flywheel, told once, as a router: each column names one beat of the
 * PulseOne loop and ends in the conversion action that matches it (subscribe,
 * intake, services). Its job is routing visitors into a funnel path, not
 * explaining the company — keep each body to two sentences.
 */
const BEATS = [
  {
    title: "See IT coming",
    body: "Our advisors track what's moving and what it means for your industry. The Pulse of Technology Radar and daily briefing keep you pointed in the right direction without burying you in noise.",
    cta: "Get the Daily Briefing",
    href: "#subscribe",
  },
  {
    title: "Know where you stand",
    body: "Give us sixty seconds of context: your industry, your role, and what's on your mind. You get back a recommended path showing where you stand and what to do next. No sales call required.",
    cta: "Start the 60-Second Intake",
    href: "#how-can-we-help",
  },
  {
    title: "Make the most of IT",
    body: "When a signal turns into a project, the same team does the work: managed business technology, security, and AI adoption that keeps getting better, not just staying up.",
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
            How PulseOne Works
          </span>
          <h2 className="mb-4 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[34px] leading-tight font-bold tracking-tight text-[#1a1a1a]">
            See IT coming. Know where you stand. Make the most of IT.
          </h2>
          <p className="font-sans text-[16px] leading-[1.8] text-[#646464]">
            We watch what&rsquo;s changing in technology so you don&rsquo;t have to. We&rsquo;ll tell
            you what it means for your industry, show you where you stand, and then do the
            work and keep improving it.
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

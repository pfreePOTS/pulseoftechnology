import Link from "next/link";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import IndustriesGrid from "@/components/IndustriesGrid";

export const metadata = {
  title: "Industries We Serve — PulseOne",
  description:
    "Twenty industries, one common challenge: balancing accelerating technology change with operational reality. Pick your sector to build a custom recommended path.",
};

export default function IndustriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        {/* HERO — same dark, full-bleed framing as the corporate homepage. */}
        <section className="relative overflow-hidden border-b-4 border-pulse-teal bg-[#111] px-8 py-16">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.65)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1100px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                Industries We Serve
              </span>
            </div>
            <h1 className="mb-4 max-w-[820px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              Twenty industries. One common challenge.
            </h1>
            <p className="max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              Every sector is balancing accelerating technology change against the operational
              reality of running the business. Pick your industry below and we&rsquo;ll build a
              custom path tuned to the regulatory, security, and AI-governance pressures you
              actually face.
            </p>
          </div>
        </section>

        {/* GRID — 20 industry cards, each opens the wizard pre-selected. */}
        <section className="bg-light-bg px-6 py-16 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                  Pick Your Sector
                </span>
                <h2 className="font-sans text-[38px] font-bold tracking-tight text-[#111]">
                  Tap an industry to build your custom path
                </h2>
              </div>
              <p className="max-w-[420px] font-sans text-[14px] leading-relaxed text-[#555]">
                We&rsquo;ll skip the &ldquo;what industry are you?&rdquo; question and jump
                straight to the rest of the conversation.
              </p>
            </div>

            <IndustriesGrid />
          </div>
        </section>

        {/* SECONDARY CTA — for visitors whose industry isn't in the canonical 20. */}
        <section className="border-t border-[#e0e0e0] bg-white px-8 py-16">
          <div className="mx-auto max-w-[820px] text-center">
            <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Don&rsquo;t see your industry?
            </span>
            <h2 className="mb-3 font-sans text-[34px] font-bold tracking-tight text-[#111]">
              We work with sectors outside the canonical twenty too.
            </h2>
            <p className="mx-auto mb-6 max-w-[620px] font-sans text-[15px] leading-relaxed text-[#555]">
              Take the full intake and choose &ldquo;Other&rdquo; on the industry step &mdash;
              we&rsquo;ll still build you a tailored recommendation.
            </p>
            <Link
              href="/#how-can-we-help"
              className="inline-flex items-center gap-2 rounded-md bg-pulse-red px-6 py-3 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Take the full intake →
            </Link>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import FaqSection from "@/components/FaqSection";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import IndustriesGrid from "@/components/IndustriesGrid";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import type { FaqItem } from "@/lib/schema";

const DESCRIPTION =
  "Twenty industries, one common challenge. See how PulseOne fits managed IT, security, and integration work to the sector you actually operate in.";

export const metadata: Metadata = {
  title: "IT Support by Industry: 20 Sectors We Serve",
  description: DESCRIPTION,
  alternates: { canonical: "/industries" },
  openGraph: {
    type: "website",
    url: "/industries",
    title: "IT Support by Industry: 20 Sectors We Serve",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "IT Support by Industry: 20 Sectors We Serve",
    description: DESCRIPTION,
  },
};

const FAQ: FaqItem[] = [
  {
    question: "Does the industry change what PulseOne actually does?",
    answer:
      "The industry changes the context, not the scope. Managed IT, remote support, security, and integration work are the same services everywhere. What differs is the systems involved, the rules the sector answers to, and the hours when an outage costs the most. A restaurant group and a manufacturer need the same discipline applied to very different constraints.",
  },
  {
    question: "Do you support organizations with multiple locations?",
    answer:
      "Yes, and it is core work. Restaurants, franchises, retail stores, branch offices, field offices, and warehouses are supported remotely from one help desk, with consistent technology standards across sites rather than whatever each location assembled independently.",
  },
  {
    question: "What if our industry is not on the list?",
    answer:
      "The twenty sectors shown cover the most common cases, not the limit. The underlying work is the same: support, security, integration, and advisory applied to whatever systems your business runs on. Tell us what you operate and we will say plainly whether it fits.",
  },
  {
    question: "Do you work on production or operational equipment?",
    answer:
      "PulseOne handles the technology layer around that equipment: networking, segmentation, monitoring, security, and integrating its data into business systems. Installing, configuring, or commissioning the machinery itself belongs to the manufacturer or its integrator.",
  },
];

export default function IndustriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Industries" }])} />
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
          <div className="mx-auto max-w-[820px] text-center lg:max-w-[min(100%,58rem)]">
            <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Don&rsquo;t see your industry?
            </span>
            <h2 className="mb-3 font-sans text-[clamp(1.5rem,2.75vw,2rem)] font-bold tracking-tight text-[#111] lg:whitespace-nowrap">
              We work with sectors outside the canonical twenty{"\u00a0"}too.
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

        <FaqSection
          items={FAQ}
          heading="Working with PulseOne by industry"
          tone="surface"
        />
      </main>
      <GlobalFooter />
    </div>
  );
}

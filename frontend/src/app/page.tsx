import type { Metadata } from "next";

import GlobalHeader from "@/components/GlobalHeader";
import HeroSection from "@/components/HeroSection";
import LoopSection from "@/components/LoopSection";
import PhilosophySection from "@/components/PhilosophySection";
import IndustriesSection from "@/components/IndustriesSection";
import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";
import SubscribeWizard from "@/components/SubscribeWizard";
import GlobalFooter from "@/components/GlobalFooter";
import { API_BASE } from "@/lib/api";
import { SITE_DESCRIPTION } from "@/lib/site";

/**
 * The home page owns the brand's primary commercial term. Other routes target
 * their own primary keyword so no two pages compete for the same query.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Managed Business Technology and Advisory | PulseOne",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <GlobalHeader />
      <HeroSection />
      <LoopSection />
      <PhilosophySection />
      <IndustriesSection />
      <ExecutiveIntakeForm />
      {/* Nurture path for visitors not ready for the intake. The homepage is
          the largest landing surface, so it must offer both conversion
          actions: intake above, briefing subscribe here. */}
      <section id="subscribe" className="scroll-mt-4 border-t border-[#e8e8e8] bg-[#f4f4f4] px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <span className="mb-3 block text-center font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
            The Daily Briefing
          </span>
          <h2 className="mb-2 text-center font-sans text-[34px] leading-tight font-bold tracking-tight text-[#1a1a1a]">
            Not ready to talk? Stay ahead anyway.
          </h2>
          <p className="mb-8 text-center font-sans text-[15px] leading-relaxed text-[#646464]">
            The Pulse of Technology Radar is PulseOne&rsquo;s live view of what&rsquo;s
            changing in technology. Subscribe and get the signals that matter to your industry and role,
            in your inbox each morning.
          </p>
          <SubscribeWizard apiBase={API_BASE} />
        </div>
      </section>
      <GlobalFooter />
    </>
  );
}

import type { Metadata } from "next";

import GlobalHeader from "@/components/GlobalHeader";
import HeroSection from "@/components/HeroSection";
import PhilosophySection from "@/components/PhilosophySection";
import IndustriesSection from "@/components/IndustriesSection";
import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";
import GlobalFooter from "@/components/GlobalFooter";
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
      <PhilosophySection />
      <IndustriesSection />
      <ExecutiveIntakeForm />
      <GlobalFooter />
    </>
  );
}

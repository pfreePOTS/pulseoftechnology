import GlobalHeader from "@/components/GlobalHeader";
import HeroSection from "@/components/HeroSection";
import PhilosophySection from "@/components/PhilosophySection";
import IndustriesSection from "@/components/IndustriesSection";
import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";
import GlobalFooter from "@/components/GlobalFooter";

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

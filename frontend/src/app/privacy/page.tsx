import type { Metadata } from "next";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import { PRIVACY_INTRO, PRIVACY_PATH, PRIVACY_SECTIONS } from "@/lib/privacyPolicy";

const TITLE = "Privacy Policy | PulseOne";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: PRIVACY_INTRO,
  alternates: { canonical: PRIVACY_PATH },
  openGraph: {
    type: "website",
    url: PRIVACY_PATH,
    title: TITLE,
    description: PRIVACY_INTRO,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: PRIVACY_INTRO,
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        <section className="border-b-4 border-pulse-teal bg-[#111] px-8 py-16">
          <div className="mx-auto max-w-[800px]">
            <h1 className="font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              Privacy Policy
            </h1>
          </div>
        </section>
        <section className="bg-white px-8 py-14">
          <div className="mx-auto max-w-[800px]">
            <p className="font-sans text-[17px] leading-relaxed text-[#333]">{PRIVACY_INTRO}</p>
            {PRIVACY_SECTIONS.map((section) => (
              <section key={section.heading} className="mt-10">
                <h2 className="mb-3 font-sans text-[22px] font-bold tracking-tight text-[#111]">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-3 font-sans text-[16px] leading-relaxed text-[#333]"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { SERVICES, servicePath } from "@/lib/services";

const DESCRIPTION =
  "Managed business technology, cybersecurity, compliance reviews, emerging technology adoption, and strategic advisory for small and mid-market organizations.";

export const metadata: Metadata = {
  title: "IT Services and Technology Advisory",
  description: DESCRIPTION,
  alternates: { canonical: "/services" },
  openGraph: {
    type: "website",
    url: "/services",
    title: "IT Services and Technology Advisory",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "IT Services and Technology Advisory",
    description: DESCRIPTION,
  },
};

export default function ServicesPage() {
  return (
    <>
      <GlobalHeader />
      <div className="h-[5px] w-full bg-gradient-to-r from-pulse-red to-pulse-teal" aria-hidden />

      <JsonLd
        data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Services" }])}
      />

      <main className="flex flex-1 flex-col bg-white">
        <section className="relative overflow-hidden border-b-[3px] border-pulse-teal bg-dark-bg px-6 py-[88px]">
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 size-[400px] rounded-full bg-[radial-gradient(circle,rgba(1,158,124,0.12)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1200px]">
            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Our Services
            </span>
            <h1 className="mb-5 max-w-[860px] font-sans text-[clamp(2rem,4.5vw,52px)] leading-[1.1] font-bold tracking-tight text-white">
              Five ways we work{" "}
              <span className="text-pulse-red [text-shadow:0_0_40px_rgba(213,23,30,0.4)]">
                with you.
              </span>
            </h1>
            <p className="max-w-[640px] font-sans text-lg leading-relaxed text-white/78">
              PulseOne provides technology services to small and mid-market organizations:
              advisory when you need a decision, and hands-on delivery when you need the work
              done.
            </p>
          </div>
        </section>

        <section className="px-6 py-[90px]">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid gap-6 md:grid-cols-2">
              {SERVICES.map((service) => (
                <article
                  key={service.slug}
                  className="flex flex-col rounded-[10px] border border-[#e0e0e0] bg-white p-8 transition-colors hover:border-pulse-teal"
                >
                  <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                    {service.eyebrow}
                  </span>
                  <h2 className="mb-3 font-sans text-[22px] font-bold leading-snug text-[#1a1a1a]">
                    <Link
                      href={servicePath(service.slug)}
                      className="transition-colors hover:text-pulse-red"
                    >
                      {service.navLabel}
                    </Link>
                  </h2>
                  <p className="mb-6 flex-1 font-sans text-[15px] leading-[1.75] text-[#646464]">
                    {service.metaDescription}
                  </p>
                  <Link
                    href={servicePath(service.slug)}
                    className="inline-flex items-center gap-1 self-start font-sans text-[13px] font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
                  >
                    {service.navLabel} details →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-4 border-pulse-teal bg-[#f4f4f4] px-6 py-[80px]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <h2 className="mb-4 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[28px] font-bold leading-tight text-[#1a1a1a]">
                Not sure which one you need?
              </h2>
              <p className="max-w-[620px] pl-[23px] font-sans text-[15px] leading-[1.75] text-[#646464]">
                Most engagements start with a conversation rather than a service line. Tell us
                where things stand and we will point you at the right starting place, including
                the free assessments if that is the honest answer.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/contact"
                className="rounded bg-pulse-red px-8 py-[13px] text-center font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Talk with an Expert
              </Link>
              <Link
                href="/industries"
                className="rounded border-2 border-pulse-teal px-8 py-[11px] text-center font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal hover:text-white"
              >
                See Industries We Serve
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FaqSection from "@/components/FaqSection";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import { SERVICES, getService, servicePath } from "@/lib/services";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};

  const path = servicePath(service.slug);
  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: service.metaTitle,
      description: service.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: service.metaTitle,
      description: service.metaDescription,
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = SERVICES.filter((item) => item.slug !== service.slug);

  return (
    <>
      <GlobalHeader />
      <div className="h-[5px] w-full bg-gradient-to-r from-pulse-red to-pulse-teal" aria-hidden />

      <JsonLd
        data={serviceSchema({
          name: service.name,
          serviceType: service.serviceType,
          description: service.metaDescription,
          path: servicePath(service.slug),
          audience: service.audience,
          includes: service.capabilities.map((capability) => capability.title),
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.navLabel },
        ])}
      />

      <main className="flex flex-1 flex-col bg-white">
        <section className="relative overflow-hidden border-b-[3px] border-pulse-teal bg-dark-bg px-6 py-[88px]">
          <div
            className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(213,23,30,0.12)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1200px]">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-2 font-sans text-[13px] text-white/45">
                <li>
                  <Link href="/" className="hover:text-pulse-teal">
                    Home
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href="/services" className="hover:text-pulse-teal">
                    Services
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li className="text-white/70">{service.navLabel}</li>
              </ol>
            </nav>

            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {service.eyebrow}
            </span>
            <h1 className="mb-5 max-w-[860px] font-sans text-[clamp(2rem,4.5vw,52px)] leading-[1.1] font-bold tracking-tight text-white">
              {service.headline}{" "}
              <span className="text-pulse-red [text-shadow:0_0_40px_rgba(213,23,30,0.4)]">
                {service.headlineAccent}
              </span>
            </h1>
            <p className="max-w-[620px] font-sans text-lg leading-relaxed text-white/78">
              {service.lede}
            </p>
          </div>
        </section>

        <section className="px-6 py-[90px]">
          <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <h2 className="mb-6 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[30px] font-bold leading-tight text-[#1a1a1a]">
                What {service.navLabel} means at PulseOne
              </h2>
              <div className="space-y-5 font-sans text-[16px] leading-[1.8] text-[#4a4a4a]">
                {service.intro.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </div>
            <aside className="rounded-xl border border-[#e0e0e0] bg-[#f4f8fa] p-8">
              <h2 className="mb-3 font-sans text-[15px] font-bold text-[#1a1a1a]">
                {service.boundaryHeading ?? "Where this stops"}
              </h2>
              <p className="mb-7 font-sans text-[14.5px] leading-[1.75] text-[#646464]">
                {service.boundary}
              </p>
              <Link
                href="/contact"
                className="block w-full rounded bg-pulse-red py-3 text-center font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
              >
                Talk with an Expert
              </Link>
              <Link
                href="/assessments"
                className="mt-3 block w-full rounded border-2 border-pulse-teal py-[10px] text-center font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal hover:text-white"
              >
                Start with an Assessment
              </Link>
              <p className="mt-6 border-t border-[#e0e0e0] pt-5 font-sans text-[13px] leading-relaxed text-[#646464]">
                Our advisors track the technology landscape continuously. The{" "}
                <Link href="/radar" className="font-semibold text-pulse-teal hover:underline">
                  Pulse of Technology Radar
                </Link>{" "}
                is the industry-tuned view we publish, so you can see the direction we are
                steering from.
              </p>
            </aside>
          </div>
        </section>

        <section className="border-t-4 border-pulse-teal bg-[#f4f4f4] px-6 py-[90px]">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-12">
              <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                What&apos;s Included
              </span>
              <h2 className="font-sans text-4xl font-bold text-[#1a1a1a]">
                The work, specifically
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {service.capabilities.map((capability) => (
                <div
                  key={capability.title}
                  className="rounded-[10px] border border-[#e0e0e0] bg-white px-6 py-7 transition-colors hover:border-pulse-teal"
                >
                  <h3 className="mb-3 font-sans text-lg font-bold text-[#1a1a1a]">
                    {capability.title}
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-[#646464]">
                    {capability.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {service.pathForward ? (
          <section className="px-6 py-[90px]">
            <div className="mx-auto max-w-[1200px]">
              <div className="mb-12 max-w-[720px]">
                <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                  Where to Start
                </span>
                <h2 className="mb-4 font-sans text-4xl font-bold text-[#1a1a1a]">
                  {service.pathForward.heading}
                </h2>
                <p className="font-sans text-[16px] leading-[1.8] text-[#4a4a4a]">
                  {service.pathForward.intro}
                </p>
              </div>
              <ol className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
                {service.pathForward.steps.map((step, index) => (
                  <li key={step.title} className="flex gap-5">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-pulse-red font-sans text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="mb-1.5 font-sans text-lg font-bold text-[#1a1a1a]">
                        {step.title}
                      </h3>
                      <p className="font-sans text-[15px] leading-[1.75] text-[#646464]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {service.pathForward.outro ? (
                <p className="mt-11 max-w-[720px] border-l-[3px] border-pulse-teal pl-5 font-sans text-[15px] leading-[1.75] text-[#4a4a4a]">
                  {service.pathForward.outro}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {service.industryFocus ? (
          <section className="px-6 py-[90px]">
            <div className="mx-auto max-w-[1200px]">
              <div className="mb-10 max-w-[720px]">
                <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                  By Industry
                </span>
                <h2 className="mb-4 font-sans text-4xl font-bold text-[#1a1a1a]">
                  {service.industryFocus.heading}
                </h2>
                <p className="font-sans text-[16px] leading-[1.8] text-[#4a4a4a]">
                  {service.industryFocus.intro}
                </p>
              </div>
              <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {service.industryFocus.items.map((item) => (
                  <div key={item.industry} className="border-l-[3px] border-pulse-red pl-5">
                    <dt className="mb-2 font-sans text-lg font-bold text-[#1a1a1a]">
                      {item.industry}
                    </dt>
                    <dd className="font-sans text-[15px] leading-[1.75] text-[#646464]">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/industries"
                className="mt-10 inline-flex items-center gap-1 font-sans text-[13px] font-semibold text-pulse-red transition-[gap] duration-200 hover:gap-1.5"
              >
                See all industries we serve →
              </Link>
            </div>
          </section>
        ) : null}

        <FaqSection
          items={service.faq}
          heading={`${service.navLabel}: common questions`}
          intro="Direct answers to what leaders ask before an engagement starts."
        />

        <section className="border-t border-[#e8e8e8] bg-[#f4f4f4] px-6 py-[70px]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="mb-8 font-sans text-[22px] font-bold text-[#1a1a1a]">
              Other services
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={servicePath(item.slug)}
                  className="group rounded-[10px] border border-[#e0e0e0] bg-white px-5 py-5 transition-colors hover:border-pulse-teal"
                >
                  <p className="mb-1.5 font-sans text-[15px] font-bold text-[#1a1a1a] group-hover:text-pulse-teal">
                    {item.navLabel}
                  </p>
                  <p className="font-sans text-[13px] leading-relaxed text-[#646464]">
                    {item.lede}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-6 py-[80px] text-center">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(213,23,30,0.12)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[720px]">
            <h2 className="mb-4 font-sans text-[32px] font-bold leading-tight text-white">
              Let&apos;s talk about what this looks like for your organization.
            </h2>
            <p className="mb-8 font-sans text-[16px] leading-relaxed text-white/65">
              Tell us where things stand. We listen before we recommend.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded bg-pulse-red px-9 py-[13px] font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Send us a message
            </Link>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

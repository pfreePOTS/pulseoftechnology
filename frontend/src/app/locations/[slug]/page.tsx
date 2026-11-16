import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import JsonLd from "@/components/JsonLd";
import PartnersLogoMarquee from "@/components/PartnersLogoMarquee";
import { LOCATIONS, getLocation, locationPath } from "@/lib/locations";
import { breadcrumbSchema, localBusinessSchema } from "@/lib/schema";

type Params = { slug: string };

function telHref(display: string): string {
  const digits = display.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

export function generateStaticParams(): Params[] {
  return LOCATIONS.map((location) => ({ slug: location.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = getLocation(slug);
  if (!location) return {};

  const path = locationPath(location.slug);
  const shareImages = [{ url: location.image, alt: location.imageAlt }];
  return {
    title: { absolute: location.metaTitle },
    description: location.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: location.metaTitle,
      description: location.metaDescription,
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title: location.metaTitle,
      description: location.metaDescription,
      images: shareImages.map((image) => image.url),
    },
  };
}

export default async function LocationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const location = getLocation(slug);
  if (!location) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <JsonLd
        data={localBusinessSchema({
          name: `PulseOne ${location.city}`,
          description: location.metaDescription,
          path: locationPath(location.slug),
          telephone: location.phone,
          areaServed: location.areas,
          image: location.image,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: location.headline }])}
      />
      <main className="flex-1">
        <section className="relative flex min-h-[480px] items-center overflow-hidden border-b-4 border-pulse-teal">
          <Image
            src={location.image}
            alt={location.imageAlt}
            fill
            priority
            sizes="100vw"
            className={`object-cover ${location.imagePosition ?? "object-center"}`}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.78)] via-[rgba(10,10,15,0.42)] to-[rgba(10,10,15,0.12)]"
            aria-hidden
          />
          {location.imageCredit ? (
            <p className="absolute right-4 bottom-3 z-[1] font-sans text-[11px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
              Photo by{" "}
              <a
                href={location.imageCredit.fileUrl}
                className="underline decoration-white/40 underline-offset-2 hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                {location.imageCredit.author}
              </a>
              ,{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                className="underline decoration-white/40 underline-offset-2 hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0
              </a>
            </p>
          ) : null}
          <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-6 py-16">
            <p className="mb-4 font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
              {location.areas}
            </p>
            <h1 className="mb-4 max-w-[820px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              {location.headline}
            </h1>
            <p className="max-w-[680px] font-sans text-lg leading-relaxed text-white/80">
              {location.intro}
            </p>
          </div>
        </section>

        <section className="bg-white px-6 py-16 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Local solutions
            </span>
            <h2 className="mb-8 max-w-[720px] border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[28px] font-bold tracking-tight text-[#1a1a1a]">
              Information technology solutions for your business
            </h2>
            <ul className="grid gap-5 md:grid-cols-2">
              {location.services.map((service) => (
                <li
                  key={service.title}
                  className="rounded-[10px] border border-[#e0e0e0] bg-[#f4f4f4] px-6 py-6 transition-colors hover:border-pulse-teal"
                >
                  <h3 className="font-sans text-[17px] font-bold text-[#1a1a1a]">{service.title}</h3>
                  <p className="mt-2 font-sans text-[15px] leading-relaxed text-[#646464]">{service.body}</p>
                </li>
              ))}
            </ul>

            <h2 className="mt-16 mb-6 font-sans text-[22px] font-bold tracking-tight text-[#1a1a1a]">
              Expertise includes
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {location.expertise.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 border-l-[3px] border-pulse-teal/40 pl-4 font-sans text-[15px] leading-relaxed text-[#646464]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="overflow-hidden border-t-4 border-pulse-teal bg-[#f4f4f4] px-6 py-[70px]">
          <div className="mx-auto mb-10 max-w-[1200px] text-center">
            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Technologies we work with
            </span>
            <h2 className="font-sans text-[28px] font-bold text-[#1a1a1a]">
              Platform partnerships that support delivery
            </h2>
          </div>
          <PartnersLogoMarquee fadeFrom="#f4f4f4" />
        </section>

        <section className="relative overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-6 py-[80px]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(213,23,30,0.12)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[720px] text-center">
            <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              {location.city} office
            </span>
            <a
              href={`tel:${telHref(location.phone)}`}
              className="mb-4 inline-block font-sans text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-white transition-colors hover:text-pulse-teal"
            >
              {location.phone}
            </a>
            <p className="mb-8 font-sans text-base leading-relaxed text-white/65">
              Talk with the local team about managed IT for your organization. We listen before we
              recommend.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded bg-pulse-red px-9 py-[13px] font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Talk with an expert
            </Link>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

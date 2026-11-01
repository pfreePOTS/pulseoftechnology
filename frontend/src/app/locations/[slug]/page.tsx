import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import JsonLd from "@/components/JsonLd";
import { LOCATION_PARTNERS, LOCATIONS, getLocation, locationPath } from "@/lib/locations";
import { breadcrumbSchema } from "@/lib/schema";

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
  return {
    title: { absolute: location.metaTitle },
    description: location.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: location.metaTitle,
      description: location.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: location.metaTitle,
      description: location.metaDescription,
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
          <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-8 py-16">
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

        <section className="bg-white px-8 py-14">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="mb-8 font-sans text-[28px] font-bold tracking-tight text-[#111]">
              Information technology solutions for your business
            </h2>
            <ul className="grid gap-6 md:grid-cols-2">
              {location.services.map((service) => (
                <li key={service.title} className="rounded-lg border border-[#e0e0e0] bg-[#f6f6f6] px-6 py-5">
                  <h3 className="font-sans text-[17px] font-bold text-[#111]">{service.title}</h3>
                  <p className="mt-2 font-sans text-[15px] leading-relaxed text-[#333]">{service.body}</p>
                </li>
              ))}
            </ul>

            <h2 className="mt-14 mb-4 font-sans text-[22px] font-bold tracking-tight text-[#111]">
              Expertise includes
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {location.expertise.map((item) => (
                <li key={item} className="font-sans text-[15px] leading-relaxed text-[#333]">
                  {item}
                </li>
              ))}
            </ul>

            <h2 className="mt-14 mb-6 font-sans text-[13px] font-semibold tracking-[2px] text-[#777] uppercase">
              Technologies we work with
            </h2>
            <ul className="flex flex-wrap items-center gap-6">
              {LOCATION_PARTNERS.map((partner) => (
                <li key={partner.src} className="flex h-16 w-36 items-center justify-center rounded-md bg-white">
                  <Image
                    src={partner.src}
                    alt={partner.alt}
                    width={144}
                    height={64}
                    className="max-h-12 w-auto object-contain"
                  />
                </li>
              ))}
            </ul>

            <p className="mt-12 font-sans text-[15px] text-[#333]">
              <span className="mb-1 block font-sans text-[12px] font-semibold tracking-[1.5px] text-[#777] uppercase">
                Phone
              </span>
              <a
                href={`tel:${telHref(location.phone)}`}
                className="font-semibold text-pulse-teal hover:underline"
              >
                {location.phone}
              </a>
            </p>
            <p className="mt-8">
              <Link
                href="/contact"
                className="inline-block rounded-md bg-pulse-red px-5 py-3 font-sans text-sm font-semibold text-white hover:opacity-90"
              >
                Talk with an expert
              </Link>
            </p>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}

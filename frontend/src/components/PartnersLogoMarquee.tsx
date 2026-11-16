import Image from "next/image";

import { APPROACH_PARTNERS } from "@/lib/approachPartners";

function LogoRow({ suffix }: { suffix: string }) {
  return (
    <>
      {APPROACH_PARTNERS.map((partner) => (
        <div
          key={`${suffix}-${partner.name}`}
          className="flex h-16 shrink-0 items-center justify-center border-r border-[#cbc9c9] px-10 last:border-r-0"
        >
          <Image
            src={partner.logoSrc}
            alt={partner.logoAlt}
            width={160}
            height={48}
            className="max-h-12 w-auto max-w-[140px] object-contain"
            unoptimized={partner.logoSrc.endsWith(".svg")}
          />
        </div>
      ))}
    </>
  );
}

type PartnersLogoMarqueeProps = {
  /** Fade edges to match the section background. */
  fadeFrom?: string;
};

export default function PartnersLogoMarquee({ fadeFrom = "#f4f4f4" }: PartnersLogoMarqueeProps) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 z-[2] w-20"
        style={{ background: `linear-gradient(to right, ${fadeFrom}, transparent)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-[2] w-20"
        style={{ background: `linear-gradient(to left, ${fadeFrom}, transparent)` }}
        aria-hidden
      />
      <div className="marquee-track-animate-slow flex w-max gap-0">
        <LogoRow suffix="a" />
        <LogoRow suffix="b" />
      </div>
    </div>
  );
}

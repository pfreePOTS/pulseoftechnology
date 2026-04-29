import type { ComponentType } from "react";

import type { IndustryOption } from "@/lib/industryGrid";

const common = {
  vb: "0 0 24 24" as const,
  strokeWidth: "1.75" as const,
};

/**
 * Line icons for `/industries` cards — semantic per sector, PulseOne palette applied via CSS `color` on stroke.
 */
function SvgFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg viewBox={common.vb} fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {children}
    </svg>
  );
}

function IconHealthcare({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      />
    </SvgFrame>
  );
}

function IconFinancial({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
        d="M4 21V8l8-5 8 5v13M4 21h16M12 21V13"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M9 21v-6h6v6" />
    </SvgFrame>
  );
}

function IconTechnology({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M9 9h2M13 15h2M9 12h6" />
    </SvgFrame>
  );
}

function IconManufacturing({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <circle cx="8" cy="15" r="3.5" stroke="currentColor" strokeWidth={common.strokeWidth} />
      <circle cx="17" cy="13" r="3.5" stroke="currentColor" strokeWidth={common.strokeWidth} />
      <path
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
        d="M10.8 13.8l2.9-7.9a1 1 0 011.87-.06l3.2 9.3"
      />
    </SvgFrame>
  );
}

function IconEnergy({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M13 2L4 13h8l-1 9 11-13h-7l3-8z"
      />
    </SvgFrame>
  );
}

function IconRetail({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M3 11l2-8h14l2 8"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M3 11h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M8 21V11m8 10V11" />
    </SvgFrame>
  );
}

function IconGovernment({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M5 21V9l7-6 7 6v12M9 21v-6h6v6"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M9 13h6v2H9zm0-5h6v2H9z" />
    </SvgFrame>
  );
}

function IconEducation({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M3 11l9-6 9 6-9 4-9-4z"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M6 12v4.5a3 3 0 004.05 2.82L12 21" />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M19 13v6" />
    </SvgFrame>
  );
}

function IconTelecommunications({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={common.strokeWidth}
        d="M7 21v-9M11 21v-5M15 21V8M19 3v17"
      />
      <circle cx="19" cy="3" r="1.2" fill="currentColor" />
    </SvgFrame>
  );
}

function IconTransportation({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M3 17h14l3-8H3v8zm2 0v2m10-2v2"
      />
      <circle cx="7.5" cy="20" r="2" stroke="currentColor" strokeWidth={common.strokeWidth} />
      <circle cx="15.5" cy="20" r="2" stroke="currentColor" strokeWidth={common.strokeWidth} />
    </SvgFrame>
  );
}

function IconMediaEntertainment({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
      />
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M11 14V10l6 4-6 4v-4z"
      />
    </SvgFrame>
  );
}

function IconRealEstate({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M4 10l8-8 8 8v11a1 1 0 01-1 1h-4v-7H9v7H5a1 1 0 01-1-1V10z"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M9 21V12h6v9" />
    </SvgFrame>
  );
}

function IconAgriculture({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={common.strokeWidth}
        d="M12 21c-4.5-3-8-9-8-13a8 8 0 0116 0c0 4-3.5 10-8 13z"
      />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M12 21v-8m-3 3l3 5 3-5" />
    </SvgFrame>
  );
}

function IconPharmaBiotech({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <rect
        x="8"
        y="6"
        width="8"
        height="12"
        rx="4"
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
      />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M8 14h8" />
    </SvgFrame>
  );
}

function IconLegalServices({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M7 21h10M12 21V8" />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M7 14l10-6-4-6-10 6h4z" />
    </SvgFrame>
  );
}

function IconHospitality({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M4 21V10h16v11M9 21V17h6v4"
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M2 10h20M7 17h2M15 17h2M7 7V4m10 3V4" />
    </SvgFrame>
  );
}

function IconNonprofit({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M12 21C7 17 5 13 5 9a7 7 0 0114 0c0 4-2 8-7 12z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={common.strokeWidth}
        d="M12 21V10m0 0l4-5m-4 5l-4-5"
      />
    </SvgFrame>
  );
}

function IconDefenseAerospace({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={common.strokeWidth}
        d="M12 22s8-4 8-10V8l-8-6-8 6v4c0 6 8 10 8 10z"
      />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M12 22V12M8 17h8" />
    </SvgFrame>
  );
}

function IconInsurance({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={common.strokeWidth}
        d="M12 21c4-4 7-9 7-14V5l-7-3-7 3v2"
      />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth={common.strokeWidth} d="M7 10h10" />
      <circle cx="12" cy="15" r="3" stroke="currentColor" strokeWidth={common.strokeWidth} />
    </SvgFrame>
  );
}

function IconProfessionalServices({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <rect
        x="5"
        y="7"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth={common.strokeWidth}
      />
      <path stroke="currentColor" strokeWidth={common.strokeWidth} d="M9 7V5a3 3 0 016 0v2M9 21h6v-8H9v8z" />
    </SvgFrame>
  );
}

const BY_INDUSTRY: Record<IndustryOption, ComponentType<{ className?: string }>> = {
  Healthcare: IconHealthcare,
  "Financial Services": IconFinancial,
  Technology: IconTechnology,
  Manufacturing: IconManufacturing,
  Energy: IconEnergy,
  Retail: IconRetail,
  Government: IconGovernment,
  Education: IconEducation,
  Telecommunications: IconTelecommunications,
  Transportation: IconTransportation,
  "Media & Entertainment": IconMediaEntertainment,
  "Real Estate": IconRealEstate,
  Agriculture: IconAgriculture,
  "Pharma & Biotech": IconPharmaBiotech,
  "Legal Services": IconLegalServices,
  Hospitality: IconHospitality,
  Nonprofit: IconNonprofit,
  "Defense & Aerospace": IconDefenseAerospace,
  Insurance: IconInsurance,
  "Professional Services": IconProfessionalServices,
};

export default function IndustryCardIcon({
  industryName,
  className,
}: {
  /** Must be a canonical `INDUSTRY_OPTIONS` entry. */
  industryName: IndustryOption;
  /** Typically `h-9 w-9` plus `text-[color]` via parent. */
  className?: string;
}) {
  const Cmp = BY_INDUSTRY[industryName];
  return <Cmp className={className} />;
}

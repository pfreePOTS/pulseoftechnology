"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PulseOneOfficialLogo } from "@/components/PulseOneOfficialLogo";

function NavCaret() {
  return (
    <>
      {" "}
      <span
        aria-hidden="true"
        className="inline-block min-w-[0.65rem] align-middle text-[9px] text-pulse-teal opacity-80"
      >
        ▼
      </span>
    </>
  );
}

export default function GlobalHeader() {
  const pathname = usePathname();
  const pulseSelected = pathname === "/radar" || pathname.startsWith("/radar/");
  const approachSelected = pathname === "/approach" || pathname.startsWith("/approach/");
  const assessmentsSelected = pathname === "/assessments" || pathname.startsWith("/assessments/");

  return (
    <header className="sticky top-0 z-[100] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex min-h-[96px] max-w-[1200px] items-center justify-between gap-4 px-6 py-3 sm:py-3.5">
        <Link
          href="/"
          className="shrink-0 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-teal focus-visible:ring-offset-2"
          aria-label="PulseOne — People | Technology | Progress"
        >
          <PulseOneOfficialLogo variant="onLight" size="header" />
        </Link>
        <nav className="nav flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto text-[13.5px] font-semibold whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/radar"
            aria-current={pulseSelected ? "page" : undefined}
            className={`rounded px-2.5 py-1.5 transition-colors ${pulseSelected ? "text-pulse-teal hover:text-pulse-teal" : "text-[#646464] hover:text-pulse-red"}`}
          >
            Pulse of Technology
            {pulseSelected ? <NavCaret /> : null}
          </Link>
          <Link
            href="/approach"
            aria-current={approachSelected ? "page" : undefined}
            className={`rounded px-2.5 py-1.5 transition-colors hover:text-pulse-red ${approachSelected ? "text-pulse-teal hover:text-pulse-teal" : "text-[#646464]"}`}
          >
            Our Approach
            {approachSelected ? <NavCaret /> : null}
          </Link>
          <Link
            href="/assessments"
            aria-current={assessmentsSelected ? "page" : undefined}
            className={`rounded px-2.5 py-1.5 transition-colors hover:text-pulse-red ${assessmentsSelected ? "text-pulse-teal hover:text-pulse-teal" : "text-[#646464]"}`}
          >
            Assessments
            {assessmentsSelected ? <NavCaret /> : null}
          </Link>
          <Link
            href="/contact"
            className="ml-8 shrink-0 rounded bg-pulse-red px-[18px] py-[9px] text-[13.5px] text-white transition-colors hover:bg-[#a81117]"
          >
            Let&apos;s Talk
          </Link>
        </nav>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PulseOneOfficialLogo } from "@/components/PulseOneOfficialLogo";
import SolutionsIntakeModal from "@/components/SolutionsIntakeModal";
import { useIsClient } from "@/lib/useIsClient";

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
  const isClient = useIsClient();
  const pathname = usePathname();
  const pulseSelected = pathname === "/radar" || pathname.startsWith("/radar/");
  const approachSelected = pathname === "/approach" || pathname.startsWith("/approach/");
  const assessmentsSelected = pathname === "/assessments" || pathname.startsWith("/assessments/");

  // Solutions opens the executive intake wizard (USAMap + tailoring questions)
  // in a `<dialog>`. Bumping `sessionKey` on every open resets the wizard to
  // step 1 without remounting the component (preserves dialog open animations).
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [solutionsSessionKey, setSolutionsSessionKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const openSolutions = () => {
    setMenuOpen(false);
    setSolutionsSessionKey((k) => k + 1);
    setSolutionsOpen(true);
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const itemClass = (selected: boolean, stacked: boolean) =>
    `${stacked ? "block px-1 py-3 text-base" : "rounded px-2.5 py-1.5"} transition-colors hover:text-pulse-red ${selected ? "text-pulse-teal" : "text-[#646464]"}`;

  const links = (stacked: boolean) => (
    <>
      <Link
        href="/radar"
        aria-current={pulseSelected ? "page" : undefined}
        className={itemClass(pulseSelected, stacked)}
        onClick={() => setMenuOpen(false)}
      >
        Pulse of Technology
        {pulseSelected ? <NavCaret /> : null}
      </Link>
      <Link
        href="/approach"
        aria-current={approachSelected ? "page" : undefined}
        className={itemClass(approachSelected, stacked)}
        onClick={() => setMenuOpen(false)}
      >
        Our Approach
        {approachSelected ? <NavCaret /> : null}
      </Link>
      <Link
        href="/assessments"
        aria-current={assessmentsSelected ? "page" : undefined}
        className={itemClass(assessmentsSelected, stacked)}
        onClick={() => setMenuOpen(false)}
      >
        Assessments
        {assessmentsSelected ? <NavCaret /> : null}
      </Link>
      {isClient ? (
        <button
          type="button"
          onClick={openSolutions}
          aria-haspopup="dialog"
          aria-expanded={solutionsOpen}
          className={`${stacked ? "block w-full px-1 py-3 text-left text-base" : "rounded px-2.5 py-1.5"} font-semibold text-[#646464] transition-colors hover:text-pulse-red`}
        >
          Solutions
        </button>
      ) : (
        <span className={stacked ? "block px-1 py-3 text-base text-[#646464]" : "rounded px-2.5 py-1.5 font-semibold text-[#646464]"}>
          Solutions
        </span>
      )}
      <Link
        href="/contact"
        onClick={() => setMenuOpen(false)}
        className={
          stacked
            ? "mt-2 inline-block rounded bg-pulse-red px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#a81117]"
            : "ml-6 shrink-0 rounded bg-pulse-red px-[18px] py-[9px] text-[13.5px] text-white transition-colors hover:bg-[#a81117]"
        }
      >
        Let&apos;s Talk
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-[100] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 xl:min-h-[96px] xl:px-6">
        <Link
          href="/"
          className="min-w-0 shrink py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-teal focus-visible:ring-offset-2"
          aria-label="PulseOne — People | Technology | Progress"
        >
          <PulseOneOfficialLogo variant="onLight" size="header" />
        </Link>
        <button
          type="button"
          className="shrink-0 rounded border border-[#d8d8d8] px-3 py-2 font-sans text-sm font-semibold text-[#111] xl:hidden"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav className="hidden items-center justify-end gap-0.5 text-[13.5px] font-semibold whitespace-nowrap xl:flex">
          {links(false)}
        </nav>
      </div>
      {menuOpen ? (
        <nav
          id="site-menu"
          className="flex flex-col border-t border-[#e8e8e8] px-4 py-2 font-sans text-sm font-semibold xl:hidden"
        >
          {links(true)}
        </nav>
      ) : null}
      <SolutionsIntakeModal
        open={solutionsOpen}
        onClose={() => setSolutionsOpen(false)}
        sessionKey={solutionsSessionKey}
      />
    </header>
  );
}

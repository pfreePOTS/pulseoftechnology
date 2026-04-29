import Image from "next/image";
import Link from "next/link";

export default function GlobalHeader() {
  return (
    <header className="sticky top-0 z-[100] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/pulseone_logo_official.png"
            alt="PulseOne – People | Technology | Progress"
            width={200}
            height={48}
            className="h-12 w-auto"
            priority
          />
        </Link>
        <nav className="nav flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto text-[13.5px] font-semibold whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/radar"
            className="rounded px-2.5 py-1.5 text-pulse-teal transition-colors hover:text-[#0fa09b]"
          >
            Pulse of Technology <span className="ml-0.5 align-middle text-[9px] opacity-60">▼</span>
          </Link>
          <a
            href="#"
            className="rounded px-2.5 py-1.5 text-[#646464] transition-colors hover:text-pulse-red"
          >
            Our Approach
          </a>
          <a
            href="#"
            className="rounded px-2.5 py-1.5 text-[#646464] transition-colors hover:text-pulse-red"
          >
            Assessments
          </a>
          <a
            href="#"
            className="rounded px-2 py-1.5 text-[13px] text-pulse-teal transition-colors hover:text-[#0fa09b]"
          >
            Client Login
          </a>
          <Link
            href="/contact"
            className="ml-1 rounded bg-pulse-red px-[18px] py-[9px] text-[13.5px] text-white transition-colors hover:bg-[#a81117]"
          >
            Let&apos;s Talk
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Typographic PulseOne wordmark — DESIGN.md: IBM Plex Sans, red accent (pulse-red).
 * Marketing chrome uses `PulseOneOfficialLogo` (`public/pulseone_logo_official.png`); this remains for typography-only layouts.
 */

type Props = {
  /** Light header (near-black + red); dark surfaces (footer, admin rail — white + red). */
  variant: "light" | "dark";
  className?: string;
};

export function PulseOneWordmark({ variant, className = "" }: Props) {
  const pulseTone = variant === "light" ? "text-[#111827]" : "text-white";
  return (
    <span
      className={`inline-flex shrink-0 items-baseline font-sans font-bold tracking-[0.11em] select-none [-webkit-font-smoothing:antialiased] ${className}`}
    >
      <span className={pulseTone}>PULSE</span>
      <span className="text-pulse-red">ONE</span>
    </span>
  );
}

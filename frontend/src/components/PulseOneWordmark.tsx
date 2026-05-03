/**
 * Typographic PulseOne wordmark — DESIGN.md: IBM Plex Sans, red accent (#d5171e / pulse-red).
 * The raster asset `pulseone_logo_official.png` is not in `public/`; this avoids broken images on deploy.
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

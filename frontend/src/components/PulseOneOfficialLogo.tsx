import Image from "next/image";

const OFFICIAL_PNG = {
  src: "/pulseone_logo_official.png",
  width: 524,
  height: 152,
} as const;

type Props = {
  /** PNG for light surfaces; `onDark` inverts for charcoal backgrounds. */
  variant?: "onDark" | "onLight";
  size?: "sm" | "md" | "header" | "footer";
  className?: string;
};

/**
 * Official PulseOne lockup in `public/pulseone_logo_official.png`
 * (typically includes tagline below the wordmark).
 */
export function PulseOneOfficialLogo({
  variant = "onDark",
  size = "md",
  className = "",
}: Props) {
  const filter = variant === "onDark" ? "brightness-0 invert opacity-95" : "";

  let sizeCls: string;
  if (size === "sm") {
    sizeCls = "h-9 w-auto max-w-[9.75rem] object-contain object-left";
  } else if (size === "header") {
    sizeCls =
      "h-12 w-auto max-w-[min(72vw,340px)] object-contain object-left sm:h-[3.25rem] md:h-[3.5rem] md:max-w-[380px]";
  } else if (size === "footer") {
    sizeCls =
      "h-10 w-auto max-w-[220px] object-contain object-left sm:h-11 sm:max-w-[240px]";
  } else {
    sizeCls =
      "h-[2.875rem] w-auto max-w-[272px] object-contain object-left sm:h-12 md:h-[3.5rem] md:max-w-[300px]";
  }

  let sizesAttr: string;
  if (size === "sm") {
    sizesAttr = "156px";
  } else if (size === "header") {
    sizesAttr = "(max-width:768px) 72vw,380px";
  } else if (size === "footer") {
    sizesAttr = "240px";
  } else {
    sizesAttr = "300px";
  }

  const priority = size === "header" || size === "md";

  return (
    <Image
      {...OFFICIAL_PNG}
      alt="PulseOne — People | Technology | Progress"
      className={[filter, sizeCls, className].filter(Boolean).join(" ")}
      priority={priority}
      sizes={sizesAttr}
    />
  );
}

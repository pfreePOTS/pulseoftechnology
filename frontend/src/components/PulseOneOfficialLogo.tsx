import Image from "next/image";

// Both assets are confirmed RGBA with a real alpha channel (transparent surround,
// not a baked-in white rectangle). `pulseone_logo_official.png` and the *_white
// derivative were 100% opaque despite being RGBA — do not reintroduce them.
const OFFICIAL_PNG_LIGHT = {
  src: "/pots_logo_new.png",
  width: 386,
  height: 83,
} as const;

const OFFICIAL_PNG_DARK = {
  src: "/pulseone_logo_white.png",
  width: 386,
  height: 83,
} as const;

type Props = {
  /** Light surfaces use the dark wordmark PNG; dark surfaces use the white-recolored variant. */
  variant?: "onDark" | "onLight";
  size?: "sm" | "md" | "header" | "footer";
  className?: string;
};

function sizeClasses(size: NonNullable<Props["size"]>): string {
  if (size === "sm") {
    return "h-9 w-auto max-w-[9.75rem] object-contain object-left";
  }
  if (size === "header") {
    // Header lockup heights: 54 / 58.5 / 63 px (10% smaller than the prior 60 / 65 / 70 px scale).
    return "h-[3.375rem] w-auto max-w-[min(80vw,382px)] object-contain object-left sm:h-[3.6563rem] md:h-[3.9375rem] md:max-w-[427px]";
  }
  if (size === "footer") {
    return "h-10 w-auto max-w-[220px] object-contain object-left sm:h-11 sm:max-w-[240px]";
  }
  return "h-[2.875rem] w-auto max-w-[272px] object-contain object-left sm:h-12 md:h-[3.5rem] md:max-w-[300px]";
}

function sizesAttr(size: NonNullable<Props["size"]>): string {
  if (size === "sm") return "156px";
  if (size === "header") return "(max-width:768px) 80vw,427px";
  if (size === "footer") return "240px";
  return "300px";
}

/**
 * Official PulseOne lockup with proper red-ring "ONE":
 *  - light surfaces → ``pots_logo_new.png`` (dark wordmark, real transparent surround)
 *  - dark surfaces  → ``pulseone_logo_white.png`` (white wordmark + red ONE, real transparent surround)
 */
export function PulseOneOfficialLogo({
  variant = "onDark",
  size = "md",
  className = "",
}: Props) {
  const asset = variant === "onDark" ? OFFICIAL_PNG_DARK : OFFICIAL_PNG_LIGHT;
  const priority = size === "header" || size === "md";

  return (
    <Image
      {...asset}
      alt="PulseOne — People | Technology | Progress"
      className={[sizeClasses(size), className].filter(Boolean).join(" ")}
      priority={priority}
      sizes={sizesAttr(size)}
    />
  );
}

import Image from "next/image";

const OFFICIAL_PNG_LIGHT = {
  src: "/pulseone_logo_official.png",
  width: 524,
  height: 152,
} as const;

const OFFICIAL_PNG_DARK = {
  src: "/pulseone_logo_official_white.png",
  width: 524,
  height: 152,
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
    return "h-12 w-auto max-w-[min(72vw,340px)] object-contain object-left sm:h-[3.25rem] md:h-[3.5rem] md:max-w-[380px]";
  }
  if (size === "footer") {
    return "h-10 w-auto max-w-[220px] object-contain object-left sm:h-11 sm:max-w-[240px]";
  }
  return "h-[2.875rem] w-auto max-w-[272px] object-contain object-left sm:h-12 md:h-[3.5rem] md:max-w-[300px]";
}

function sizesAttr(size: NonNullable<Props["size"]>): string {
  if (size === "sm") return "156px";
  if (size === "header") return "(max-width:768px) 72vw,380px";
  if (size === "footer") return "240px";
  return "300px";
}

/**
 * Official PulseOne lockup with proper red-ring "ONE":
 *  - light surfaces → ``pulseone_logo_official.png`` (the canonical asset used on the marketing site)
 *  - dark surfaces  → ``pulseone_logo_official_white.png`` (white wordmark + same red ONE for charcoal/admin)
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

import Image from "next/image";

const OFFICIAL_PNG = {
  src: "/pulseone_logo_official.png",
  width: 524,
  height: 152,
} as const;

/** Vector lockup authored for charcoal / dark admins — avoids ``brightness-0 invert`` on the PNG (shows as a flat white slab). */
const DARK_SVG = "/pulseone_logo_dark.svg";

type Props = {
  /** PNG on light backgrounds; branded SVG on charcoal (footer, admin). */
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

/**
 * PulseOne lockup: raster ``pulseone_logo_official.png`` on light UI; SVG ``pulseone_logo_dark.svg`` on dark
 * (invert-on-PNG is wrong for rectangular assets — produces a blank white rectangle).
 */
export function PulseOneOfficialLogo({
  variant = "onDark",
  size = "md",
  className = "",
}: Props) {
  const sizeCls = sizeClasses(size);

  if (variant === "onDark") {
    return (
      <Image
        src={DARK_SVG}
        width={440}
        height={118}
        alt="PulseOne — People | Technology | Progress"
        unoptimized
        priority={size === "md"}
        className={[sizeCls, "block shrink-0", className].filter(Boolean).join(" ")}
      />
    );
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
      className={[sizeCls, className].filter(Boolean).join(" ")}
      priority={priority}
      sizes={sizesAttr}
    />
  );
}

import Image from "next/image";

const OFFICIAL_PNG = {
  src: "/pulseone_logo_official.png",
  width: 524,
  height: 152,
} as const;

type Props = {
  /** PNG is authored for light backgrounds — filters for charcoal admin shells. */
  variant?: "onDark" | "onLight";
  /** Sidebar vs login / password gate. */
  size?: "md" | "sm";
  className?: string;
};

/**
 * Official PulseOne raster wordmark (`public/pulseone_logo_official.png`).
 * Marketing header keeps typography `PulseOneWordmark`; admin uses this lockup.
 */
export function PulseOneOfficialLogo({
  variant = "onDark",
  size = "md",
  className = "",
}: Props) {
  const filter = variant === "onDark" ? "brightness-0 invert opacity-95" : "";

  const sizeCls =
    size === "sm"
      ? "h-9 w-auto max-w-[9.75rem] object-contain object-left"
      : "h-[2.875rem] w-auto max-w-[272px] object-contain object-left sm:h-12 md:h-[3.5rem] md:max-w-[300px]";

  return (
    <Image
      {...OFFICIAL_PNG}
      alt="PulseOne — People | Technology | Progress"
      className={[filter, sizeCls, className].filter(Boolean).join(" ")}
      priority={size !== "sm"}
      sizes={size === "sm" ? "156px" : "300px"}
    />
  );
}

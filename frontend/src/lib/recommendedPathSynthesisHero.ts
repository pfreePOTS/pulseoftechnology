import { absoluteApiUrl } from "./api";

const RP_IMAGE_PATH_PREFIXES = ["/api/recommended-path/process-card-images/"] as const;

/** ``GET /api/recommended-path`` may return path-only ``hero_image_url``; merge with browser API origin (incl. ``/__pulse_api``). */
export function synthesisCardHeroAbsoluteSrc(href: string | null | undefined): string | undefined {
  const raw = typeof href === "string" ? href.trim() : "";
  if (!raw) return undefined;

  if (raw.startsWith("/")) {
    return absoluteApiUrl(raw);
  }

  try {
    const u = new URL(raw);
    if (RP_IMAGE_PATH_PREFIXES.some((p) => u.pathname.startsWith(p))) {
      return absoluteApiUrl(u.pathname);
    }
  } catch {
    /* malformed URL — treat as opaque */
  }

  return raw;
}

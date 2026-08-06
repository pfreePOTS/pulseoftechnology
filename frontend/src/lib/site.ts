/**
 * Canonical site identity for metadata, canonical URLs, sitemap, and JSON-LD.
 *
 * `NEXT_PUBLIC_SITE_URL` is intentionally unset in production until the app
 * takes over `pulseone.com` (a different site serves that domain today).
 * Emitting canonicals at the live host before cutover would point search
 * engines at content that is not there yet.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(
  /\/$/,
  "",
);

export const SITE_NAME = "PulseOne";
export const LEGAL_NAME = "PulseOne Group";
export const SITE_TAGLINE = "People | Technology | Progress";
export const FOUNDING_YEAR = "2002";

export const SITE_DESCRIPTION =
  "Managed business technology, security, and remote multi-site support for small and mid-market organizations. Advisory plus hands-on delivery from PulseOne since 2002.";

/** Offices as listed in the global footer. */
export const OFFICE_LOCATIONS = [
  "Ventura, CA",
  "Los Angeles, CA",
  "New Jersey",
  "Nashville, TN",
  "Bozeman, MT",
];

/** Paths excluded from indexing: internal tooling and email-link destinations. */
export const PRIVATE_PATHS = ["/admin", "/preferences", "/recommended-path"];

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

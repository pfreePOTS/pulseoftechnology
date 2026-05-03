import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

/**
 * Wide band photos for synthesis cards keyed by canonical industry slug.
 *
 * Files: `public/images/industry-synthesis/{slug}.jpg` (+ legacy `.svg` for fallback / tooling).
 */

const KNOWN_SLUGS = new Set(INDUSTRY_OPTIONS.map((l) => slugifyIndustryLabel(l)));

export function slugifyIndustryLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function industrySynthesisBannerSlug(industry: string): string {
  const raw = industry.trim();
  if (!raw) return "default";
  const slug = slugifyIndustryLabel(raw);
  if (KNOWN_SLUGS.has(slug)) return slug;
  return "default";
}

/** Primary raster strip for intake industry (and `default` for Other / unmatched). */
export function industrySynthesisBannerSrc(industry: string): string {
  const slug = industrySynthesisBannerSlug(industry);
  return `/images/industry-synthesis/${slug}.jpg`;
}

/** SVG gradient placeholder paired with JPG when raster is missing locally. */
export function industrySynthesisBannerSvgFallback(industry: string): string {
  const slug = industrySynthesisBannerSlug(industry);
  return `/images/industry-synthesis/${slug}.svg`;
}

/** SVG placeholders bypass optimizer; JPG bands use Next image pipeline defaults. */
export function industrySynthesisBannerDisableOptimization(src: string): boolean {
  return src.endsWith(".svg");
}

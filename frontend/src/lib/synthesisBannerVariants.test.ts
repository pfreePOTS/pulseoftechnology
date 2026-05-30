import { describe, expect, it } from "vitest";

import { SYNTHESIS_BANNER_VARIANT_COUNT, synthesisBannerVariantV } from "./synthesisBannerVariants";

describe("synthesisBannerVariantV", () => {
  it("pins variant count to match generator docstring", () => {
    expect(SYNTHESIS_BANNER_VARIANT_COUNT).toBe(6);
  });

  it("spreads industry vs focus for the same slug and card slots (four-card row)", () => {
    const slug = "healthcare";
    const industry = Array.from({ length: 4 }, (_, i) => synthesisBannerVariantV(i, slug, "industry"));
    const focus = Array.from({ length: 4 }, (_, i) => synthesisBannerVariantV(i, slug, "focus"));

    expect(new Set(industry).size).toBeGreaterThan(1);
    expect(new Set(focus).size).toBeGreaterThan(1);
    expect(industry.join()).not.toBe(focus.join());
  });

  it("never returns variant outside 1 … SYNTHESIS_BANNER_VARIANT_COUNT for many slugs/indices", () => {
    const slugs = [
      "cybersecurity",
      "ai",
      "compliance",
      "cloud",
      "it-management",
      "strategy",
      "other",
      "healthcare",
      "financial-services",
      "default",
      "media-and-entertainment",
    ];
    for (const slug of slugs) {
      for (let i = -5; i < 64; i++) {
        for (const lane of ["industry", "focus"] as const) {
          const v = synthesisBannerVariantV(i, slug, lane);
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(SYNTHESIS_BANNER_VARIANT_COUNT as number);
        }
      }
    }
  });
});

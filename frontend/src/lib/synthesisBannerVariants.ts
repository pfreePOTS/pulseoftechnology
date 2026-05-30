/**
 * Variant count for procedural synthesis banners — keep in sync with
 * ``VARIANT_COUNT`` in ``frontend/scripts/generate_synthesis_banner_placeholders.py``.
 */
export const SYNTHESIS_BANNER_VARIANT_COUNT = 6 as const;

/** Deterministic 1 .. SYNTHESIS_BANNER_VARIANT_COUNT for industry vs focus lane + card slot. */
export function synthesisBannerVariantV(cardIndex: number, slug: string, lane: "industry" | "focus"): number {
  const k = SYNTHESIS_BANNER_VARIANT_COUNT as number;
  let salt = lane === "industry" ? 0xb4d3ea11 : 0xf0c5735f;
  salt >>>= 0;
  for (let i = 0; i < slug.length; i++) {
    salt = (salt * 33 + slug.charCodeAt(i)) >>> 0;
  }
  const idx = Math.trunc(cardIndex);
  // ``>>> 0`` on the XOR result is critical — bitwise ``^`` returns a signed 32-bit int,
  // which can be negative and break modulo (produced URLs like ``…-v-3.jpg`` before).
  const base = ((idx * 31 + salt) >>> 0) ^ (lane === "focus" ? 0xa5a5a5aa : 0);
  const mixed = base >>> 0;
  return (mixed % k) + 1;
}

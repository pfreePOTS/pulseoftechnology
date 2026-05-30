"use client";

import { useEffect, useMemo, useState } from "react";

import {
  industrySynthesisBannerSrc,
  industrySynthesisBannerSvgFallback,
} from "@/lib/industrySynthesisBanner";
import {
  type SynthesisFocusBannerSlug,
  synthesisFocusBannerSrcFromSlug,
} from "@/lib/synthesisFocusBanner";

type Props = {
  industry: string;
  topicSlug: SynthesisFocusBannerSlug;
  /** Slight compositional shift across a row when assets share a similar wash */
  variationIndex?: number;
};

/**
 * “What we think” card hero: sector wash (industry strip, low opacity) +
 * a topic-specific band (Focus library) on top. ``object-cover`` + per-card ``objectPosition``
 * keeps adjacent placeholders from feeling like one photo cropped four identical ways.
 *
 * Uses native ``<img>`` (not ``next/image`` ``fill``) so every card’s band occupies the exact
 * pixel height set by the parent — optimized ``Image`` wrappers have been observed to diverge across cards.
 */
export default function SynthesisCardBandImages({ industry, topicSlug, variationIndex = 0 }: Props) {
  const industryPrimary = useMemo(
    () => industrySynthesisBannerSrc(industry, variationIndex),
    [industry, variationIndex],
  );
  const industrySvg = useMemo(() => industrySynthesisBannerSvgFallback(industry), [industry]);
  const [industrySrc, setIndustrySrc] = useState(industryPrimary);

  const topicSrc = useMemo(
    () => synthesisFocusBannerSrcFromSlug(topicSlug, variationIndex),
    [topicSlug, variationIndex],
  );
  const [topicFailed, setTopicFailed] = useState(false);

  useEffect(() => {
    setIndustrySrc(industryPrimary);
  }, [industryPrimary]);

  useEffect(() => {
    setTopicFailed(false);
  }, [topicSrc]);

  const v = ((variationIndex % 4) + 4) % 4;
  const industryFocus = `${48 + v * 3}% ${40 + v * 4}%`;
  const topicFocus = `${46 + ((v + 1) % 3) * 5}% ${38 + ((v + 2) % 4) * 5}%`;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* block + object-cover avoids inline-image struts and keeps the raster pinned to the band box */}
      {/* Plain <img>: next/image fill was producing inconsistent tiles in the lg 4-column process grid */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={industrySrc}
        alt=""
        className={`absolute inset-0 block h-full w-full object-cover transition-opacity duration-300 ${
          topicFailed ? "z-[1] opacity-100" : "opacity-[0.38]"
        }`}
        style={{ objectPosition: industryFocus }}
        onError={() => setIndustrySrc(industrySvg)}
        loading="lazy"
        decoding="async"
      />
      {!topicFailed ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={topicSrc}
            alt=""
            className="absolute inset-0 z-[1] block h-full w-full object-cover"
            style={{ objectPosition: topicFocus }}
            onError={() => setTopicFailed(true)}
            loading="lazy"
            decoding="async"
          />
        </>
      ) : null}
    </div>
  );
}

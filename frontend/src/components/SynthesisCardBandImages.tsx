"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  industrySynthesisBannerDisableOptimization,
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
  sizes: string;
};

/**
 * “What we think” card hero: sector wash (industry strip, low opacity) +
 * a topic-specific band (Focus library) on top. Both use object-center so
 * adjacent cards don’t look like the same photo cropped three ways.
 */
export default function SynthesisCardBandImages({ industry, topicSlug, sizes }: Props) {
  const industryPrimary = useMemo(() => industrySynthesisBannerSrc(industry), [industry]);
  const industrySvg = useMemo(() => industrySynthesisBannerSvgFallback(industry), [industry]);
  const [industrySrc, setIndustrySrc] = useState(industryPrimary);

  const topicSrc = useMemo(() => synthesisFocusBannerSrcFromSlug(topicSlug), [topicSlug]);
  const [topicFailed, setTopicFailed] = useState(false);

  return (
    <>
      <Image
        src={industrySrc}
        alt=""
        fill
        sizes={sizes}
        className={`object-cover object-center transition-opacity duration-300 ${
          topicFailed ? "z-[1] opacity-100" : "opacity-[0.38]"
        }`}
        unoptimized={industrySynthesisBannerDisableOptimization(industrySrc)}
        onError={() => setIndustrySrc(industrySvg)}
      />
      {!topicFailed ? (
        <Image
          src={topicSrc}
          alt=""
          fill
          sizes={sizes}
          className="z-[1] object-cover object-center"
          onError={() => setTopicFailed(true)}
        />
      ) : null}
    </>
  );
}

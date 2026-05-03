"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  industrySynthesisBannerDisableOptimization,
  industrySynthesisBannerSrc,
  industrySynthesisBannerSvgFallback,
} from "@/lib/industrySynthesisBanner";
import { synthesisFocusBannerSrc } from "@/lib/synthesisFocusBanner";

const BAND_OBJECT_POSITIONS = ["object-[center_18%]", "object-center", "object-[center_82%]"] as const;

type Props = {
  industry: string;
  issue: string;
  cardIndex: number;
  sizes: string;
};

export default function SynthesisCardBandImages({ industry, issue, cardIndex, sizes }: Props) {
  const pos = BAND_OBJECT_POSITIONS[cardIndex % BAND_OBJECT_POSITIONS.length];

  const industryPrimary = useMemo(() => industrySynthesisBannerSrc(industry), [industry]);
  const industrySvg = useMemo(() => industrySynthesisBannerSvgFallback(industry), [industry]);
  const [industrySrc, setIndustrySrc] = useState(industryPrimary);

  const focusUrl = useMemo(() => synthesisFocusBannerSrc(issue), [issue]);
  const [focusActive, setFocusActive] = useState(focusUrl !== null);

  const showFocus = focusActive && focusUrl;

  return (
    <>
      {showFocus ? (
        <Image
          src={focusUrl}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover ${pos} scale-105 opacity-[0.42] blur-[0.5px]`}
          aria-hidden
          onError={() => setFocusActive(false)}
        />
      ) : null}
      <Image
        src={industrySrc}
        alt=""
        fill
        sizes={sizes}
        className={`z-[1] object-cover ${pos}`}
        unoptimized={industrySynthesisBannerDisableOptimization(industrySrc)}
        onError={() => setIndustrySrc(industrySvg)}
      />
    </>
  );
}

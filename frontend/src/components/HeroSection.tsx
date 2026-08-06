"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const CYCLING_TOPICS = [
  "Cybersecurity",
  "AI Readiness",
  "Compliance",
  "Cyber Insurance Readiness",
  "Cloud Governance",
  "Technology Strategy",
] as const;

export default function HeroSection() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % CYCLING_TOPICS.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {/* Hero shell — sizing/padding/gradient match the /radar hero so the two
          feel like one design system, but each page owns its own background
          asset (homepage → /FrontPage_SecurityImage.png; radar →
          /pulse_of_technology_hero.png). Update layout/gradient together. */}
      <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden text-center">
        <Image
          src="/FrontPage_SecurityImage.png"
          alt=""
          fill
          priority
          className="object-cover object-[center_12%]"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[rgba(10,10,10,0.72)] via-[rgba(10,10,10,0.55)] to-[rgba(10,10,10,0.75)]"
          aria-hidden
        />
        <div className="relative z-[2] mx-auto w-full max-w-[1320px] px-6 py-16">
          <div className="mb-4 inline-block rounded-full border border-pulse-teal/35 bg-pulse-teal/12 px-3.5 py-1.5 font-sans text-[13px] font-semibold tracking-[4px] text-pulse-teal uppercase">
            The Pulse of Technology
          </div>
          <h1 className="mb-5 font-sans text-[clamp(2.125rem,5vw,58px)] leading-[1.1] font-bold tracking-tight text-white">
            <span className="text-white">Find where your organization</span>
            <br />
            <span className="text-white">stands in </span>
            <span
              className={`inline text-pulse-red transition-opacity duration-300 [text-shadow:0_0_40px_rgba(213,23,30,0.4)] ${visible ? "opacity-100" : "opacity-0"}`}
            >
              {CYCLING_TOPICS[index]}
            </span>
            <span className="text-white">.</span>
          </h1>
          <p className="mx-auto mb-7 max-w-[620px] font-sans text-lg leading-relaxed text-white/78">
            Two decades of hands-on delivery, guided by a live view of where technology is
            heading — so you&rsquo;re ready for what&rsquo;s next and get more from what you
            already run.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            {/* Primary CTA stays on-site: the intake is the site's main conversion
                action, so the first click must never leave the domain. */}
            <Link
              href="#how-can-we-help"
              className="inline-block rounded bg-pulse-red px-[26px] py-[13px] font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Get Your Recommended Path
            </Link>
            <Link
              href="/contact"
              className="inline-block rounded border-2 border-white/50 bg-transparent px-[26px] py-[11px] font-sans text-sm font-semibold text-white transition-colors hover:border-white"
            >
              Talk with an Expert
            </Link>
          </div>
        </div>
      </section>
      <div
        className="h-[5px] w-full bg-gradient-to-r from-pulse-red to-pulse-teal"
        aria-hidden
      />
    </>
  );
}

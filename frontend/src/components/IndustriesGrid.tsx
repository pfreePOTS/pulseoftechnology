"use client";

import { useState } from "react";

import IndustryCardIcon from "@/components/IndustryCardIcon";
import IndustryIntakeModal from "@/components/IndustryIntakeModal";
import {
  INDUSTRY_DESCRIPTIONS,
  INDUSTRY_HOW_WE_FIT,
  INDUSTRY_OPTIONS,
  industryColor,
} from "@/lib/industryGrid";

/**
 * Card grid for `/industries`. Each card shows the industry name, an
 * industry-colored top accent (same hue as the radar legend), and the
 * canonical short description from `INDUSTRY_DESCRIPTIONS`. "Learn More"
 * opens the intake wizard in a modal with that industry pre-selected.
 *
 * The whole card is clickable for accessibility (the button is just the
 * affordance hint), so users with assistive tech don't have to hunt for the
 * tiny "Learn More" target.
 */
export default function IndustriesGrid() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {INDUSTRY_OPTIONS.map((name) => {
          const color = industryColor(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedIndustry(name)}
              className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-[#e0e0e0] bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-pulse-teal hover:shadow-lg focus:outline-none focus-visible:border-pulse-teal focus-visible:ring-2 focus-visible:ring-pulse-teal/40"
            >
              <span
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <div
                className="mb-4 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl"
                style={{
                  color,
                  backgroundColor: color.length === 7 ? `${color}1f` : "#f3f4f6",
                }}
                aria-hidden
              >
                <IndustryCardIcon industryName={name} className="h-[38px] w-[38px]" />
              </div>
              <h3 className="mb-2 font-sans text-[18px] font-bold text-[#111]">{name}</h3>
              <p className="mb-3 font-sans text-[14px] leading-relaxed text-[#555]">
                {INDUSTRY_DESCRIPTIONS[name]}
              </p>
              {/* Demonstration layer: how the work concretely changes in this
                  sector, so expertise is shown rather than asserted. */}
              <p className="mb-5 flex-1 border-l-2 border-pulse-teal/40 pl-3 font-sans text-[13px] leading-relaxed text-[#666]">
                {INDUSTRY_HOW_WE_FIT[name]}
              </p>
              <span
                aria-hidden
                className="inline-flex w-fit items-center gap-1.5 rounded-md bg-pulse-red px-3.5 py-2 font-sans text-[12.5px] font-semibold text-white transition-colors group-hover:bg-[#a81117]"
              >
                Learn More →
              </span>
              <span className="sr-only">Build a custom path for {name}</span>
            </button>
          );
        })}
      </div>

      <IndustryIntakeModal
        industry={selectedIndustry}
        onClose={() => setSelectedIndustry(null)}
      />
    </>
  );
}

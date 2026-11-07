import { describe, expect, it } from "vitest";

import { isLiveIndustryCell, isPlaceholderCell } from "./industryGrid";

const LEGACY_BACKFILL = {
  adoption_state: "Learn About",
  impact_score: 10,
  risk_level: 5,
  rationale:
    "Included so this topic appears across all industries on the radar. Adjust impact, risk, and adoption per sector as needed.",
  industry_impact:
    "Placeholder — run AI Suggest on this topic to generate sector-specific impact analysis.",
  impact_approved: true,
};

describe("isPlaceholderCell", () => {
  it("flags tagged and legacy backfill rows and missing cells", () => {
    expect(isPlaceholderCell({ source: "placeholder" })).toBe(true);
    expect(isPlaceholderCell(LEGACY_BACKFILL)).toBe(true);
    expect(isPlaceholderCell(undefined)).toBe(true);
  });

  it("treats AI, manual, and untagged real copy as analyzed", () => {
    expect(isPlaceholderCell({ ...LEGACY_BACKFILL, source: "manual" })).toBe(false);
    expect(isPlaceholderCell({ source: "ai", industry_impact: "Grid operators face OT risk." })).toBe(
      false,
    );
    expect(isPlaceholderCell({ industry_impact: "Carriers face claims pressure." })).toBe(false);
  });
});

describe("isLiveIndustryCell", () => {
  it("requires analysis and a radar check", () => {
    expect(isLiveIndustryCell(LEGACY_BACKFILL)).toBe(false);
    expect(isLiveIndustryCell({ source: "ai", impact_approved: false })).toBe(false);
    expect(isLiveIndustryCell({ source: "ai", impact_approved: true })).toBe(true);
    expect(isLiveIndustryCell({ source: "ai" })).toBe(true);
  });
});

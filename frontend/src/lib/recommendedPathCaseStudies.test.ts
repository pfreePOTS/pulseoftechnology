import { describe, expect, it } from "vitest";

import { canonicalIndustryLabel } from "@/lib/industryGrid";
import {
  recommendedCaseStudiesForIntake,
  recommendedCaseStudiesIntro,
} from "@/lib/recommendedPathCaseStudies";

describe("canonicalIndustryLabel", () => {
  it("resolves aliases and case", () => {
    expect(canonicalIndustryLabel("Finance & Banking")).toBe("Financial Services");
    expect(canonicalIndustryLabel("healthcare")).toBe("Healthcare");
  });
});

describe("recommendedCaseStudiesForIntake", () => {
  it("maps free-text food service to Hospitality narratives", () => {
    const studies = recommendedCaseStudiesForIntake({
      industry: "Food Service",
      issue: "",
      stage: "",
    });
    expect(studies[0]?.title).toMatch(/agent-assisted|payments at risk/i);
  });

  it("prioritizes governance cards for cybersecurity focus", () => {
    const studies = recommendedCaseStudiesForIntake({
      industry: "Healthcare",
      issue: "Cybersecurity",
      stage: "",
    });
    expect(studies[0]?.id).toBe("governance-sprint");
  });

  it("prioritizes change sequencing when stage mentions agents or pilots", () => {
    const studies = recommendedCaseStudiesForIntake({
      industry: "Technology",
      issue: "",
      stage: "We need to sequence agent rollouts without breaking production.",
    });
    expect(studies[0]?.id).toBe("ops-ai-sequencing");
  });
});

describe("recommendedCaseStudiesIntro", () => {
  it("weaves industry and situation into the subheading", () => {
    const intro = recommendedCaseStudiesIntro({
      industry: "Food Service",
      issue: "",
      stage: "Rolling out POS upgrades across franchise sites.",
    });
    expect(intro).toContain("Food Service");
    expect(intro).toMatch(/how we would approach|illustrative/i);
  });
});

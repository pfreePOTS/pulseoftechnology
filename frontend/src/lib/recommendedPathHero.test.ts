import { describe, expect, it } from "vitest";

import {
  mentionsAi,
  resolveRecommendedPathHeroBackground,
} from "./recommendedPathHero";

describe("mentionsAi", () => {
  it("treats wizard AI issue as AI", () => {
    expect(mentionsAi("anything", "AI")).toBe(true);
  });

  it("does not treat Strategy or generic agents as AI", () => {
    expect(mentionsAi("investment and governance", "Strategy")).toBe(false);
    expect(mentionsAi("need change agents in the org", "IT Management")).toBe(false);
  });

  it("matches explicit generative AI / LLM cues", () => {
    expect(mentionsAi("planning generative AI rollout", "Other")).toBe(true);
    expect(mentionsAi("evaluate llm vendors", "Other")).toBe(true);
  });
});

describe("resolveRecommendedPathHeroBackground", () => {
  it("uses enterprise art for tech industries without explicit AI focus", () => {
    const hero = resolveRecommendedPathHeroBackground("Software", "Cloud", "migrate SaaS");
    expect(hero.src).toBe("/recommended-path/hero-recommended-enterprise.png");
  });

  it("uses AI art only for explicit AI intake", () => {
    const hero = resolveRecommendedPathHeroBackground("Insurance", "AI", "governance");
    expect(hero.src).toBe("/recommended-path/hero-recommended-ai.png");
  });

  it("uses enterprise art for Insurance + Strategy", () => {
    const hero = resolveRecommendedPathHeroBackground(
      "Insurance",
      "Strategy",
      "investment and governance",
    );
    expect(hero.src).toBe("/recommended-path/hero-recommended-enterprise.png");
  });
});

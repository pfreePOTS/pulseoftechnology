import { describe, expect, it } from "vitest";

import { engagementExamplesToCaseStudies } from "@/lib/recommendedPathEngagements";

describe("engagementExamplesToCaseStudies", () => {
  it("maps three API rows to case studies", () => {
    const rows = engagementExamplesToCaseStudies([
      {
        id: "ops-ai-sequencing",
        title: "Standardize remote branch networks",
        who: "Regional IT lead",
        provided: "Design and phased rollout",
        approach: "Discovery",
        solution: "Playbook",
        how_we_helped: "Facilitation",
      },
      {
        id: "governance-sprint",
        title: "B",
        who: "C",
        provided: "D",
      },
      {
        id: "fractional-office",
        title: "C",
        who: "D",
        provided: "E",
      },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows?.[0]?.howWeHelped).toBe("Facilitation");
  });

  it("returns null when fewer than three", () => {
    expect(
      engagementExamplesToCaseStudies([{ id: "ops-ai-sequencing", title: "One" }]),
    ).toBeNull();
  });
});

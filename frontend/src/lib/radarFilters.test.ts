// @vitest-environment node

import { describe, expect, it } from "vitest";

import { filterByRadarDomain, normalizeRadarDomain } from "./radarFilters";

describe("radarFilters", () => {
  it("normalizes supported domain query values", () => {
    expect(normalizeRadarDomain("Security")).toBe("Security");
    expect(normalizeRadarDomain("Unknown")).toBe("");
    expect(normalizeRadarDomain(null)).toBe("");
  });

  it("filters stories to the requested radar domain", () => {
    const rows = [
      { title: "A", domain: "AI" },
      { title: "S", domain: "Security" },
    ];

    expect(filterByRadarDomain(rows, "Security")).toEqual([{ title: "S", domain: "Security" }]);
    expect(filterByRadarDomain(rows, "")).toEqual(rows);
  });
});

// @vitest-environment node

import { describe, expect, it } from "vitest";

import { filterByRadarDomain, normalizeRadarDomain } from "./radarFilters";

describe("radarFilters", () => {
  it("normalizes supported domain query values to slugs", () => {
    expect(normalizeRadarDomain("security")).toBe("security");
    expect(normalizeRadarDomain("Security")).toBe("security");
    expect(normalizeRadarDomain("Unknown")).toBe("");
    expect(normalizeRadarDomain(null)).toBe("");
  });

  it("filters stories to the requested radar domain slug", () => {
    const rows = [
      { title: "A", domain: { slug: "ai", short_label: "AI", label: "AI", color: "#7C3AED" } },
      { title: "S", domain: "Security" },
    ];

    expect(filterByRadarDomain(rows, "security")).toEqual([{ title: "S", domain: "Security" }]);
    expect(filterByRadarDomain(rows, "")).toEqual(rows);
  });
});

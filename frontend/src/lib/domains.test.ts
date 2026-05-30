// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  domainSlug,
  FALLBACK_DOMAINS,
  filterByRadarDomainSlug,
  normalizeRadarDomainSlug,
} from "./domains";

describe("domains helpers", () => {
  it("normalizes short labels and slugs for subscribe prefill", () => {
    expect(domainSlug("Security")).toBe("security");
    expect(domainSlug("cloud")).toBe("cloud");
    expect(domainSlug(FALLBACK_DOMAINS[0])).toBe("ai");
  });

  it("filters radar rows by domain slug", () => {
    const rows = [
      { title: "A", domain: { slug: "ai", short_label: "AI", label: "AI", color: "#7C3AED" } },
      { title: "S", domain: "Security" },
    ];
    expect(normalizeRadarDomainSlug("Security")).toBe("security");
    expect(filterByRadarDomainSlug(rows, "security")).toEqual([{ title: "S", domain: "Security" }]);
  });
});

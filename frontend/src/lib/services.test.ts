// @vitest-environment node

import { describe, expect, it } from "vitest";

import { SERVICES, getService, servicePath } from "./services";

/** Redirected in `next.config.ts`; must never come back as a live slug. */
const RETIRED_SLUG = "managed-it-services";

describe("service content", () => {
  it("has unique slugs and no retired slug in the live set", () => {
    const slugs = SERVICES.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).not.toContain(RETIRED_SLUG);
    expect(getService(RETIRED_SLUG)).toBeUndefined();
  });

  it("describes managed business technology with an industry section", () => {
    const service = getService("managed-business-technology");
    expect(service).toBeDefined();
    expect(servicePath(service!.slug)).toBe("/services/managed-business-technology");
    expect(service!.industryFocus?.items.length).toBeGreaterThan(0);
    for (const item of service!.industryFocus!.items) {
      expect(item.industry.length).toBeGreaterThan(0);
      expect(item.body.length).toBeGreaterThan(0);
    }
  });

  it("keeps the industry section opt-in for other services", () => {
    const others = SERVICES.filter((service) => service.slug !== "managed-business-technology");
    expect(others.length).toBeGreaterThan(0);
    for (const service of others) {
      expect(service.industryFocus).toBeUndefined();
    }
  });
});

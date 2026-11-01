import { describe, expect, it } from "vitest";

import { HOME_DESCRIPTION, HOME_TITLE } from "./site";

describe("homepage metadata", () => {
  it("keeps the managed IT head term in the document title", () => {
    expect(HOME_TITLE).toBe("Managed IT Services and Business Technology | PulseOne");
    expect(HOME_DESCRIPTION.toLowerCase()).toContain("managed it");
  });
});

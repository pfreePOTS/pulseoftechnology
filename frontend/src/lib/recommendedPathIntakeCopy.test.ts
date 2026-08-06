// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  fallbackHeadlineFromIntake,
  roleDisplayPhrase,
  roleLabelPluralHeadline,
} from "./recommendedPathIntakeCopy";

describe("role display phrases", () => {
  it("maps multi-named identifiers to collective phrases", () => {
    expect(roleDisplayPhrase("CEO / President / Owner")).toBe("organizational leaders");
    expect(roleDisplayPhrase("CIO / CTO")).toBe("technology leaders");
    expect(roleDisplayPhrase("IT Manager / Director")).toBe("IT leaders");
    expect(roleDisplayPhrase("Other / Not Sure")).toBe("leadership teams");
  });

  it("passes single titles through unchanged", () => {
    expect(roleDisplayPhrase("CFO")).toBe("CFO");
    expect(roleDisplayPhrase("Operations")).toBe("Operations");
  });

  it("never renders a slash combo or a pluralized combo in the fallback headline", () => {
    const headline = fallbackHeadlineFromIntake(
      "",
      "Pharma & Biotech",
      "CEO / President / Owner",
      "",
      "",
    );
    expect(headline).toBe(
      "Technology priorities for organizational leaders in Pharma & Biotech",
    );
    expect(headline).not.toContain("/");
  });

  it("still pluralizes plain titles without double-s", () => {
    expect(roleLabelPluralHeadline("CFO")).toBe("CFOs");
    expect(roleLabelPluralHeadline("Operations")).toBe("Operations");
  });
});

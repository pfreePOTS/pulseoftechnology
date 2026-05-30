import { describe, expect, it } from "vitest";

import { intakePlainText } from "./intakePlainText";

describe("intakePlainText", () => {
  it("removes span markup from focus/issue echoes", () => {
    expect(
      intakePlainText('<span style="color: grey;">microsoft license management</span>'),
    ).toBe("microsoft license management");
  });

  it("trims and collapses whitespace", () => {
    expect(intakePlainText("  a  \n  b  ")).toBe("a b");
  });

  it("decodes common entities after stripping tags", () => {
    expect(intakePlainText("Foo &amp; Bar")).toBe("Foo & Bar");
  });
});

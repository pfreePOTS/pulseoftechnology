import { describe, expect, it } from "vitest";

import { clampRadarRationaleParagraph, splitSentences, truncateToMaxSentences } from "./sentences";

describe("sentences", () => {
  it("splitSentences handles basic terminators", () => {
    expect(splitSentences("A. B? C!")).toEqual(["A.", "B?", "C!"]);
  });

  it("truncateToMaxSentences preserves short text", () => {
    expect(truncateToMaxSentences("One. Two.", 6)).toBe("One. Two.");
  });

  it("clampRadarRationaleParagraph caps at six sentences", () => {
    const long = Array.from({ length: 10 }, (_, i) => `S${i + 1}.`).join(" ");
    const out = clampRadarRationaleParagraph(long);
    expect(splitSentences(out)).toHaveLength(6);
  });
});

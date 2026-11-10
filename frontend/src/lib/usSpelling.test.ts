// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The site is written in US English. Matches whole words only, so identifiers
 * such as `fracFromCentre` are not flagged. `cancelled` is accepted US spelling.
 */
const BRITISH_SPELLING =
  /\b(?:organisation(?:al|s)?|organis(?:e|ed|es|ing)|personalis(?:e|ed|es|ing|ation)|prioritis(?:e|ed|es|ing)|deprioritis(?:e|ed|ing)|optimis(?:e|ed|es|ing|ation)|unoptimised|modernis(?:e|ed|ing|ation)|summaris(?:e|ed|es|ing|ation)|minimis(?:e|ed|ing|ation)|maximis(?:e|ed|ing)|authoris(?:e|ed|ing|ation)|scrutinis(?:e|ed|ing)|specialis(?:e|ed|ing)|synthesis(?:ed|ing)|generalis(?:e|ed|ing)|serialis(?:e|ed|ing)|normalis(?:e|ed|ing|ation)|publicis(?:e|ed)|recognis(?:e|ed|es|ing)|realis(?:e|ed|es|ing)|colours?|behaviours?|favour(?:s|ed|ite)?|centres?|programmes?|catalogues?|licence|defence|labell(?:ed|ing)|grey|fulfilment)\b/i;

const SRC = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("US spelling", () => {
  it("frontend source uses US spellings", () => {
    const hits = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) => {
          const m = line.match(BRITISH_SPELLING);
          return m ? [`${file.slice(SRC.length)}:${i + 1} ${m[0]}`] : [];
        }),
    );
    expect(hits).toEqual([]);
  });
});

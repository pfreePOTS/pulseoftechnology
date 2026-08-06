// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for PULSE-022: the /approach page (and the rest of the
 * public site) must not slide back into the retired MSP voice. Phrases are
 * banned by `backend/content/pulseone-identity.md` (clichés) or contradict
 * positioning (`areaServed: United States`, SMB focus).
 */
const BANNED_PHRASES = [
  "best-in-class",
  "Better IT",
  '"get IT done"',
  "global IT services company",
];

const APP_DIR = fileURLToPath(new URL("../", import.meta.url));
const COMPONENTS_DIR = fileURLToPath(new URL("../../components", import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Admin surfaces are internal; the voice rules target public copy.
      if (entry === "admin") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("public site voice (PULSE-022)", () => {
  const files = [...collectSourceFiles(APP_DIR), ...collectSourceFiles(COMPONENTS_DIR)];

  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(BANNED_PHRASES)("never uses the retired phrase %s", (phrase) => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(phrase));
    expect(offenders).toEqual([]);
  });
});

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

/**
 * Internal/developer vocabulary that must never render on a public page
 * (loading states, error states, empty states). Ops notes belong in code
 * comments or docs, not in copy a visitor can see. A radar loading screen
 * once told visitors to run `docker compose up`.
 */
const BANNED_DEV_NOTES = [
  "SERVER_API_URL",
  "docker compose",
  "http://backend:8000",
  "verify the Pulse API",
];

/** Soft ceiling for spaced em dashes (` — `) in public source. Identity doc
 * asks for light use; placeholders that are only `—` and brand wordmarks
 * are fine, but prose should not lean on the em dash as default punctuation. */
const MAX_SPACED_EM_DASHES = 12;

const APP_DIR = fileURLToPath(new URL("../", import.meta.url));
const COMPONENTS_DIR = fileURLToPath(new URL("../../components", import.meta.url));
const LIB_DIR = fileURLToPath(new URL("../../lib", import.meta.url));

/** Lib modules that hold visitor-facing copy (not every util). */
const LIB_COPY_FILES = new Set([
  "services.ts",
  "industryGrid.ts",
  "recommendedPathCaseStudies.ts",
  "recommendedPathIntakeCopy.ts",
  "site.ts",
]);

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

function collectLibCopyFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => LIB_COPY_FILES.has(entry))
    .map((entry) => join(dir, entry));
}

describe("public site voice (PULSE-022)", () => {
  const files = [
    ...collectSourceFiles(APP_DIR),
    ...collectSourceFiles(COMPONENTS_DIR),
    ...collectLibCopyFiles(LIB_DIR),
  ];

  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(BANNED_PHRASES)("never uses the retired phrase %s", (phrase) => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(phrase));
    expect(offenders).toEqual([]);
  });

  it.each(BANNED_DEV_NOTES)("never exposes internal dev note %s", (phrase) => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(phrase));
    expect(offenders).toEqual([]);
  });

  it("keeps spaced em dashes light in public prose", () => {
    // Strip block and line comments so JSDoc/section markers do not count.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    let count = 0;
    for (const file of files) {
      const body = stripComments(readFileSync(file, "utf8"));
      count += (body.match(/ — /g) ?? []).length;
    }
    expect(count).toBeLessThanOrEqual(MAX_SPACED_EM_DASHES);
  });
});

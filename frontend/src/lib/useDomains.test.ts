// @vitest-environment node

import { describe, expect, it, vi, afterEach } from "vitest";

import { FALLBACK_DOMAINS, setCachedDomains } from "./domains";

describe("useDomains fetch contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setCachedDomains([...FALLBACK_DOMAINS]);
  });

  it("maps a successful /api/public/domains payload into cached registry rows", async () => {
    const apiRows = [
      {
        slug: "ai",
        label: "Artificial Intelligence",
        short_label: "AI",
        color: "#7C3AED",
        sort_order: 10,
        status: "core",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(apiRows), { status: 200 })),
    );

    const res = await fetch("http://api.test/api/public/domains", { cache: "no-store" });
    expect(res.ok).toBe(true);
    const rows = (await res.json()) as typeof apiRows;
    setCachedDomains(rows);
    expect(rows).toEqual(apiRows);
  });

  it("falls back to static core domains when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const res = await fetch("http://api.test/api/public/domains");
    expect(res.ok).toBe(false);
    setCachedDomains([...FALLBACK_DOMAINS]);
    expect(FALLBACK_DOMAINS.map((d) => d.slug)).toEqual([
      "ai",
      "security",
      "cloud",
      "storage",
      "compliance",
      "infrastructure",
    ]);
  });
});

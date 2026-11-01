import { afterEach, describe, expect, it, vi } from "vitest";

import { indexingEnabled } from "./indexing";

describe("indexingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("indexes unless the flag is exactly false", () => {
    vi.stubEnv("NEXT_PUBLIC_ROBOTS_INDEX", "");
    expect(indexingEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ROBOTS_INDEX", "false");
    expect(indexingEnabled()).toBe(false);
  });
});

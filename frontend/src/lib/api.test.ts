import { afterEach, describe, expect, it, vi } from "vitest";

import { adminFetch, API_BASE } from "./api";

describe("API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("API_BASE is an absolute URL (Compose default is localhost:8100)", () => {
    expect(API_BASE).toMatch(/^https?:\/\//);
  });

  it("adminFetch uses credentials include and sets JSON Content-Type for string bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await adminFetch("http://api.example.test/x", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(init?.credentials).toBe("include");
    const headers = init?.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});

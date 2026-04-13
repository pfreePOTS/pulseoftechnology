import { expect, test } from "@playwright/test";

import { getApiBaseUrl } from "./helpers";

test.describe("Public API (host ports)", () => {
  test("GET /health returns ok", async ({ request }) => {
    const api = getApiBaseUrl();
    const res = await request.get(`${api}/health`);
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  test("GET /api/topics/published returns JSON array", async ({ request }) => {
    const api = getApiBaseUrl();
    const res = await request.get(`${api}/api/topics/published`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});

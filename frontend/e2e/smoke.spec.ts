import { expect, test } from "@playwright/test";

/**
 * Minimal checks for fast feedback (CI and local smoke runs).
 * Deeper coverage lives in `public-site.spec.ts`, `api.spec.ts`, `admin.spec.ts`.
 */
test.describe("Smoke", () => {
  test("home responds with PulseOne branding", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Technology Intelligence for C-Suite Leaders/i,
      }),
    ).toBeVisible();
  });

  test("API health is reachable", async ({ request }) => {
    const api = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8100";
    const res = await request.get(`${api.replace(/\/$/, "")}/health`);
    expect(res.ok()).toBeTruthy();
  });
});

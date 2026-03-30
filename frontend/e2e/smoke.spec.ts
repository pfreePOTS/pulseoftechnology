import { expect, test } from "@playwright/test";

test.describe("Public site", () => {
  test("home page loads and shows brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PulseOne")).toBeVisible();
  });

  test("admin login page loads", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: /PulseOne Admin/i })).toBeVisible();
  });
});

test.describe("Backend health (host ports)", () => {
  test("API /health returns ok", async ({ request }) => {
    const api =
      process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8100";
    const res = await request.get(`${api}/health`);
    expect(res.ok()).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

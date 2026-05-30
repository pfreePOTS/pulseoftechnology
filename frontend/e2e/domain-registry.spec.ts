import { expect, test } from "@playwright/test";

test.describe("Dynamic domain registry", () => {
  test("public domains API returns six core pickable domains", async ({ request }) => {
    const res = await request.get("http://localhost:8100/api/public/domains");
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Array<{ slug: string; short_label: string }>;
    const slugs = rows.map((r) => r.slug).sort();
    expect(slugs).toEqual(
      ["ai", "cloud", "compliance", "infrastructure", "security", "storage"].sort(),
    );
  });

  test("radar subscribe section shows core domain chips", async ({ page }) => {
    await page.goto("/radar#subscribe");
    await expect(page.getByRole("button", { name: "AI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cloud" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Storage" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compliance" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Infrastructure" })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test.describe("Marketing / public pages", () => {
  test("home page shows hero, radar, and subscribe sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header img[alt='PulseOne']")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Technology Intelligence for C-Suite Leaders/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore the Radar/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /How to Read the Radar/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Get Personalised Intelligence/i }),
    ).toBeVisible();
  });

  test("header links to curation dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Curation Dashboard/i }),
    ).toHaveAttribute("href", "/admin");
  });

  test("admin login shell renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(
      page.getByRole("heading", { name: /PulseOne Admin/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/^password$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

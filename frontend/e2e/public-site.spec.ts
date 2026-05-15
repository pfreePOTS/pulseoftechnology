import { expect, test } from "@playwright/test";

test.describe("Marketing / public pages", () => {
  test("home page shows hero PulseOne branding and core hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator(`header img[alt*="PulseOne"]`).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Find where your organization/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /PulseOne — People \| Technology \| Progress/i,
      }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /A People-First Philosophy/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Pulse of Technology/i })).toBeVisible();
  });

  test("radar page shows explorer CTAs and newsletter section heading", async ({ page }) => {
    await page.goto("/radar");
    await expect(page.getByRole("link", { name: /Explore the Radar/i })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Technology Intelligence for.*C-Suite Leaders/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Key Trending Topics/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Get Personalised Intelligence/i }),
    ).toBeVisible();
  });

  test("footer links to radar and admin login remains reachable via direct URL", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Technology Radar$/i })).toHaveAttribute(
      "href",
      "/radar",
    );

    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: /^Admin$/i })).toBeVisible();
    await expect(page.getByTestId("admin-login-email")).toBeVisible();
    await expect(page.getByTestId("admin-login-password")).toBeVisible();
    await expect(page.getByTestId("admin-login-submit")).toBeVisible();
  });
});

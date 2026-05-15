import { expect, test } from "@playwright/test";

import { getAdminCredentials, loginAsAdmin, logoutFromAdmin } from "./helpers";

test.describe("Admin console", () => {
  test("sign in with configured credentials reaches dashboard chrome", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expect(
      page.getByRole("navigation", { name: "Admin navigation" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^logout$/i })).toBeVisible();
    const { email } = getAdminCredentials();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("logout returns to login page", async ({ page }) => {
    await loginAsAdmin(page);
    await logoutFromAdmin(page);
    await expect(page.getByRole("heading", { name: /^Admin$/i })).toBeVisible();
  });

  test("unauthenticated /admin redirects to login", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 60_000 });
  });
});

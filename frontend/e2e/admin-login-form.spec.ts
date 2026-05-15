import { expect, test } from "@playwright/test";

import { getAdminCredentials } from "./helpers";

test.describe("Admin login form", () => {
  test("submits credentials and reaches dashboard chrome", async ({ page }) => {
    const { email, password } = getAdminCredentials();
    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(email);
    await page.getByTestId("admin-login-password").fill(password);
    await page.getByTestId("admin-login-submit").click();

    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /^logout$/i })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

import { getAdminCredentials, getAdminMfaDevCode } from "./helpers";

test.describe("Admin login form", () => {
  test("submits credentials, MFA code, and reaches dashboard chrome", async ({ page }) => {
    const { email, password } = getAdminCredentials();
    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(email);
    await page.getByTestId("admin-login-password").fill(password);
    await page.getByTestId("admin-login-submit").click();

    await expect(page.getByTestId("admin-login-mfa-code")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("admin-login-mfa-code").fill(getAdminMfaDevCode());
    await page.getByTestId("admin-login-mfa-submit").click();

    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /^logout$/i })).toBeVisible();
  });
});

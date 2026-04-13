import { expect, type Page } from "@playwright/test";

/** Host-mapped API (Compose exposes backend 8000 → 8100). */
export function getApiBaseUrl(): string {
  return (process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8100").replace(
    /\/$/,
    "",
  );
}

/**
 * Defaults match `docker-compose.yml` (`FIRST_ADMIN_EMAIL`, `ADMIN_PASSWORD`).
 * Override in CI or local runs when using non-default credentials.
 */
export function getAdminCredentials(): { email: string; password: string } {
  return {
    email: process.env.E2E_ADMIN_EMAIL ?? "pulseoneadmin@pulseone.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? "pulseadmin",
  };
}

/** Fills the admin login form and waits for a successful redirect off `/admin/login`. */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = getAdminCredentials();
  await page.goto("/admin/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => {
    const p = new URL(url).pathname;
    return p.startsWith("/admin") && p !== "/admin/login";
  });
}

export async function logoutFromAdmin(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^logout$/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

import { expect, type Page } from "@playwright/test";

/** Host-mapped API (Compose exposes backend 8000 → 8100). */
export function getApiBaseUrl(): string {
  return (process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8100").replace(
    /\/$/,
    "",
  );
}

/**
 * POST /api/admin/login so Set-Cookie is for `PLAYWRIGHT_BASE_URL`'s origin — required when the app uses
 * the Next `/__pulse_api` rewrite (cookies are not scoped to `:8100` for the UI).
 */
export function getAdminLoginPostUrl(): string {
  if (process.env.PLAYWRIGHT_USE_DIRECT_ADMIN_LOGIN === "1") {
    return `${getApiBaseUrl()}/api/admin/login`;
  }
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
  const origin = new URL(base.replace(/\/$/, "")).origin;
  return `${origin}/__pulse_api/api/admin/login`;
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

/** Prime httpOnly `pulse_admin` via the API using the Playwright cookie jar (no UI flakiness). */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = getAdminCredentials();
  const loginUrl = getAdminLoginPostUrl();
  const res = await page.context().request.post(loginUrl, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`admin login failed (${res.status()}): ${await res.text()}`);
  }

  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible({
    timeout: 30_000,
  });
}

export async function logoutFromAdmin(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^logout$/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

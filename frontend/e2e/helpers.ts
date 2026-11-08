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

/** Compose / CI fixed OTP when `ADMIN_MFA_DEV_CODE` is set (non-production only). */
export function getAdminMfaDevCode(): string {
  return process.env.E2E_ADMIN_MFA_CODE ?? process.env.ADMIN_MFA_DEV_CODE ?? "246801";
}

function mfaVerifyUrl(loginUrl: string): string {
  return loginUrl.replace(/\/login\/?$/, "/login/mfa");
}

/** Prime httpOnly `pulse_admin` via the API using the Playwright cookie jar (no UI flakiness). */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = getAdminCredentials();
  const loginUrl = getAdminLoginPostUrl();
  const step1 = await page.context().request.post(loginUrl, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
  if (!step1.ok()) {
    throw new Error(`admin login failed (${step1.status()}): ${await step1.text()}`);
  }
  const body = (await step1.json()) as { mfa_required?: boolean; mfa_token?: string };
  if (!body.mfa_required || !body.mfa_token) {
    throw new Error(`admin login missing MFA challenge: ${JSON.stringify(body)}`);
  }
  const step2 = await page.context().request.post(mfaVerifyUrl(loginUrl), {
    data: { mfa_token: body.mfa_token, code: getAdminMfaDevCode() },
    headers: { "Content-Type": "application/json" },
  });
  if (!step2.ok()) {
    throw new Error(`admin MFA failed (${step2.status()}): ${await step2.text()}`);
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

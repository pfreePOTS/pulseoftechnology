import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests expect the full stack reachable on the host (see root README).
 * Run: `docker compose up -d --build`, apply migrations, then `npm run test:e2e`
 *
 * Env:
 * - `PLAYWRIGHT_BASE_URL` — frontend (default http://localhost:3100)
 * - `PLAYWRIGHT_API_URL` — API on host port (default http://localhost:8100)
 * - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — admin login (`admin.spec.ts`)
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

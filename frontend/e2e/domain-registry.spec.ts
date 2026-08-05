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

  test("radar domain filter lists core domains from the registry", async ({ page }) => {
    await page.goto("/radar");
    const domainFilter = page.getByLabel("Domain");
    await expect(domainFilter).toBeVisible();
    const options = await domainFilter.locator("option").allInnerTexts();
    expect(options).toEqual(
      expect.arrayContaining([
        "AI",
        "Security",
        "Cloud",
        "Storage",
        "Compliance",
        "Infrastructure",
      ]),
    );
  });

  test("subscribe wizard offers core domain chips on the domains step", async ({
    page,
    request,
  }) => {
    const rolesRes = await request.get("http://localhost:8100/api/roles");
    expect(rolesRes.ok()).toBeTruthy();
    const roles = (await rolesRes.json()) as Array<{ id: number; name: string }>;
    test.skip(roles.length === 0, "No roles seeded; wizard cannot advance past the title step");

    await page.goto("/radar#subscribe");
    // Step 1: contact details.
    await page.getByPlaceholder("Jane", { exact: true }).fill("E2E");
    await page.getByPlaceholder("Smith", { exact: true }).fill("Tester");
    await page.getByPlaceholder("jane@company.com").fill("e2e-tester@example.com");
    await page.getByRole("button", { name: "Continue →" }).click();
    // Step 2: title.
    await page.getByRole("button", { name: roles[0].name, exact: true }).click();
    await page.getByRole("button", { name: "Continue →" }).click();
    // Step 3: industry.
    await page.getByRole("button", { name: "Technology", exact: true }).click();
    await page.getByRole("button", { name: "Continue →" }).click();
    // Step 4: domain chips sourced from the registry.
    for (const label of ["AI", "Security", "Cloud", "Storage", "Compliance", "Infrastructure"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });
});

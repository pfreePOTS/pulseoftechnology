import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";

import { PRIVACY_PATH, PRIVACY_SECTIONS } from "./privacyPolicy";

describe("privacy policy", () => {
  it("keeps the current policy's required statements", () => {
    expect(PRIVACY_PATH).toBe("/privacy");
    const text = PRIVACY_SECTIONS.map((section) =>
      [section.heading, ...section.paragraphs].join(" "),
    ).join(" ");
    expect(text).toContain("PulseOne does not sell personal information");
    expect(text).toContain("support@pulseone.com");
    expect(text).toContain("California Consumer Privacy Act");
    expect(PRIVACY_SECTIONS.map((section) => section.heading)).toEqual([
      "Information We Collect",
      "How We Use Information",
      "Cookies and Tracking Technologies",
      "Sharing of Information",
      "Data Retention",
      "Data Security",
      "Your Rights and Choices",
      "California Residents",
      "Changes to This Privacy Policy",
      "Contact Us",
    ]);
  });

  it("lists the privacy page on the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith(PRIVACY_PATH))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS } from "./legacyRedirects";

const DESTINATIONS = new Set([
  "/services/managed-business-technology",
  "/services/cybersecurity",
  "/services/compliance-and-risk",
  "/services/ai-and-emerging-tech",
  "/services",
  "/assessments",
  "/approach",
  "/contact",
  "/industries",
  "/privacy",
  "/locations/los-angeles",
  "/locations/ventura",
  "/locations/new-jersey",
  "/locations/bozeman",
  "/locations/philadelphia",
  "https://blog.pulseone.com",
]);

describe("legacy redirects", () => {
  it("permanent-redirects every source once, onto a known destination", () => {
    const sources = LEGACY_REDIRECTS.map((rule) => rule.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const rule of LEGACY_REDIRECTS) {
      expect(rule.permanent).toBe(true);
      expect(rule.source.endsWith("/")).toBe(false);
      expect(rule.source).not.toBe(rule.destination);
      const known =
        DESTINATIONS.has(rule.destination) ||
        rule.destination.startsWith("/service-offers/");
      expect(known).toBe(true);
    }
  });

  it("redirects legacy PulseOne landing PDFs into service-offers", () => {
    const to = Object.fromEntries(LEGACY_REDIRECTS.map((rule) => [rule.source, rule.destination]));
    expect(to["/marketplace-offers/PulseOne_05_landing.pdf"]).toBe(
      "/service-offers/endpoint-management-assessment-for-microsoft-intune.pdf",
    );
  });

  it("keeps the paths this app already serves off the redirect table", () => {
    const sources = new Set(LEGACY_REDIRECTS.map((rule) => rule.source));
    for (const live of ["/", "/assessments", "/contact", "/services", "/approach"]) {
      expect(sources.has(live)).toBe(false);
    }
  });

  it("maps the equity clusters", () => {
    const to = Object.fromEntries(LEGACY_REDIRECTS.map((rule) => [rule.source, rule.destination]));
    expect(to["/contact-us"]).toBe("/contact");
    expect(to["/our-services"]).toBe("/services/managed-business-technology");
    expect(to["/services/managed-it-services"]).toBe("/services/managed-business-technology");
    expect(to["/cyber-security-services"]).toBe("/services/cybersecurity");
    expect(to["/cmmc-compliance-services"]).toBe("/services/compliance-and-risk");
    expect(to["/ai-consulting_and_integration"]).toBe("/services/ai-and-emerging-tech");
    expect(to["/about-us"]).toBe("/approach");
    expect(to["/privacy-policy"]).toBe("/privacy");
    expect(to["/blog"]).toBe("https://blog.pulseone.com");
    expect(to["/los-angeles-it-services-company"]).toBe("/locations/los-angeles");
    expect(to["/managed-it-services-in-ventura"]).toBe("/locations/ventura");
    expect(to["/it-management-in-central-coast"]).toBe("/locations/ventura");
    expect(to["/managed-it-services-in-new-jersey"]).toBe("/locations/new-jersey");
    expect(to["/bozeman"]).toBe("/locations/bozeman");
    expect(to["/philadelphia"]).toBe("/locations/philadelphia");
  });
});

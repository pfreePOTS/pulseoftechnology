import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";

import { LOCATIONS, getLocation, locationPath } from "./locations";

describe("location pages", () => {
  it("has a page for each office city, including Nashville", () => {
    expect(LOCATIONS.map((location) => location.slug)).toEqual([
      "los-angeles",
      "ventura",
      "new-jersey",
      "bozeman",
      "philadelphia",
      "nashville",
    ]);
    for (const location of LOCATIONS) {
      expect(getLocation(location.slug)?.slug).toBe(location.slug);
      expect(locationPath(location.slug)).toBe(`/locations/${location.slug}`);
    }
  });

  it("puts the city and managed IT in each title", () => {
    for (const location of LOCATIONS) {
      expect(location.metaTitle).toContain(location.city);
      expect(location.metaTitle.toLowerCase()).toContain("managed it");
      expect(location.metaDescription.length).toBeGreaterThan(40);
      expect(location.intro.length).toBeGreaterThan(40);
      expect(location.services.length).toBe(5);
      expect(location.expertise.length).toBeGreaterThan(3);
      expect(location.image).toBe(`/images/locations/${location.slug}.jpg`);
    }
    expect(new Set(LOCATIONS.map((location) => location.image)).size).toBe(LOCATIONS.length);
  });

  it("lists each location on the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const location of LOCATIONS) {
      expect(urls.some((url) => url.endsWith(locationPath(location.slug)))).toBe(true);
    }
  });
});

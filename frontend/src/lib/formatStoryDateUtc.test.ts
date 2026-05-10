import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatStoryDateUtc } from "./formatStoryDateUtc";

describe("formatStoryDateUtc", () => {
  beforeEach(() => {
    // Set a fixed system time so "this year" is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for null", () => {
    expect(formatStoryDateUtc(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatStoryDateUtc("")).toBe("");
  });

  it("returns empty string for invalid date strings", () => {
    expect(formatStoryDateUtc("not-a-date")).toBe("");
  });

  it("formats dates in the current UTC year without the year", () => {
    // Current year is 2024
    expect(formatStoryDateUtc("2024-01-05T10:00:00Z")).toBe("Jan 5");
    expect(formatStoryDateUtc("2024-12-31T23:59:59Z")).toBe("Dec 31");
  });

  it("formats dates in previous years with the year", () => {
    expect(formatStoryDateUtc("2023-11-20T10:00:00Z")).toBe("Nov 20, 2023");
    expect(formatStoryDateUtc("2000-05-01T00:00:00Z")).toBe("May 1, 2000");
  });

  it("formats dates in future years with the year", () => {
    expect(formatStoryDateUtc("2025-02-14T10:00:00Z")).toBe("Feb 14, 2025");
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RadarSection from "./RadarSection";

vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: false, json: async () => [] })),
);

describe("RadarSection industry filter layout", () => {
  it("reserves the Clear filters slot so selecting an industry does not shift the field", async () => {
    render(<RadarSection topics={[]} />);

    const industry = await screen.findByLabelText("Industry");
    const clear = screen.getByText("Clear filters");

    expect(clear.className.split(/\s+/)).toContain("invisible");
    expect(clear.getAttribute("aria-hidden")).toBe("true");

    fireEvent.change(industry, { target: { value: "Financial Services" } });

    expect(screen.getByRole("button", { name: "Clear filters" })).toBe(clear);
    expect(clear.className.split(/\s+/)).not.toContain("invisible");
    expect(clear.getAttribute("aria-hidden")).toBeNull();

    fireEvent.click(clear);
    expect((industry as HTMLSelectElement).value).toBe("");
    expect(clear.className.split(/\s+/)).toContain("invisible");
  });
});

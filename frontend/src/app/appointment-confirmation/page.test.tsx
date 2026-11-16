import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppointmentConfirmationPage, { metadata } from "./page";

vi.mock("@/components/GlobalHeader", () => ({ default: () => null }));
vi.mock("@/components/GlobalFooter", () => ({ default: () => null }));

afterEach(cleanup);

describe("/appointment-confirmation", () => {
  it("thanks the visitor and says someone will follow up", () => {
    render(<AppointmentConfirmationPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /thanks for your meeting request/i }),
    ).toBeTruthy();
    expect(screen.getByText(/get back to you shortly/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });

  it("stays out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

const adminFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  API_BASE: "http://api.test",
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

import AnalysisPage from "./page";

const placeholder = {
  adoption_state: "Learn About",
  impact_score: 10,
  risk_level: 5,
  industry_impact: "Placeholder — run AI Suggest on this topic to generate sector-specific impact analysis.",
  source: "placeholder",
  impact_approved: false,
};

const analyzed = {
  adoption_state: "Get Prepared For",
  impact_score: 8.5,
  risk_level: 7,
  industry_impact: "Hospitals run unpatched imaging systems.",
  source: "ai",
  impact_approved: true,
};

function grid(overrides: Record<string, object>) {
  return Object.fromEntries(INDUSTRY_OPTIONS.map((ind) => [ind, overrides[ind] ?? placeholder]));
}

const topics = [
  {
    id: 1,
    name: "Cyber Breach Takeover",
    domain: "Security",
    urgency_score: 10,
    adoption_state: "Learn About",
    industry_positions: grid({}),
    article_count: 3,
    is_published: true,
    days_on_radar: 79,
    industry_analysis_attempts: 0,
  },
  {
    id: 2,
    name: "Software Supply Chain Attack",
    domain: "Security",
    urgency_score: 8,
    adoption_state: "Learn About",
    industry_positions: grid(Object.fromEntries(INDUSTRY_OPTIONS.map((ind) => [ind, analyzed]))),
    article_count: 3,
    is_published: true,
    days_on_radar: 172,
    industry_analyzed_at: "2026-11-06T03:00:00Z",
    industry_analysis_attempts: 0,
  },
  {
    id: 3,
    name: "Nation-State Cyber Espionage",
    domain: "Security",
    urgency_score: 10,
    adoption_state: "Learn About",
    industry_positions: grid({ Healthcare: analyzed }),
    article_count: 3,
    is_published: true,
    days_on_radar: 0,
    industry_analysis_attempts: 3,
    industry_analysis_error: "provider down",
  },
];

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe("Analysis industry grid", () => {
  beforeEach(() => {
    adminFetch.mockReset();
    adminFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/admin/topics?status=selected")) return jsonResponse(topics);
      return jsonResponse({}, false);
    });
  });

  afterEach(cleanup);

  it("shows analysis status and hides placeholder scores", async () => {
    render(<AnalysisPage />);
    expect(await screen.findByText("Cyber Breach Takeover")).toBeTruthy();

    expect(screen.getByTitle(/Queued for industry AI/).textContent).toBe("Not analyzed");
    expect(screen.getByText("Analyzed")).toBeTruthy();
    expect(screen.getByText("Analysis failed").getAttribute("title")).toContain("provider down");
    expect(screen.getByText("79d selected")).toBeTruthy();
    expect(screen.queryByText(/^\d+d on radar$/)).toBeNull();

    // 20 placeholders in row 1 + 19 in row 3; their copied 10 / 5 scores are not editable inputs.
    expect(screen.getAllByText("Not analyzed", { selector: "span.uppercase" })).toHaveLength(39);
    expect(screen.getAllByRole("checkbox")).toHaveLength(21);
  });

  it("All on radar never checks placeholder cells", async () => {
    render(<AnalysisPage />);
    await screen.findByText("Cyber Breach Takeover");
    fireEvent.click(screen.getAllByRole("button", { name: "All on radar" })[0]);
    await waitFor(() => {
      expect(screen.queryByText(/topic\(s\) with unsaved changes/)).toBeNull();
    });
  });

  it("Edit turns a placeholder into an editable manual cell", async () => {
    render(<AnalysisPage />);
    await screen.findByText("Cyber Breach Takeover");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(await screen.findByText(/1 topic\(s\) with unsaved changes/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(22);
  });
});

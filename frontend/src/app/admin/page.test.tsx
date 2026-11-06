// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api", () => ({
  API_BASE: "http://api.test",
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

import TrendDiscoveryPage from "./page";

const topic = {
  id: 7,
  name: "Package registry theft",
  domain: "Security",
  subdomain: "Supply chain",
  summary: null,
  urgency_score: 5,
  status: "pending",
  adoption_state: "emerging",
  article_count: 2,
  is_published: false,
  velocity_score: 1.5,
  acceleration_score: 1.2,
  signal_rationale: null,
  signal_suggested_action: "watch",
  signal_id: null,
  latest_article_at: "2026-11-01T00:00:00Z",
};

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

describe("Trend Discovery row actions", () => {
  beforeEach(() => {
    adminFetch.mockReset();
    adminFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (method === "GET" && path.includes("/api/admin/topics?")) {
        return jsonResponse([topic]);
      }
      if (method === "GET" && path.includes("/api/admin/settings")) {
        return jsonResponse({ trend_window_days: 7, trend_prior_window_days: 7 });
      }
      if (method === "POST" && (path.endsWith("/approve") || path.endsWith("/watch"))) {
        return jsonResponse({});
      }
      return jsonResponse("unexpected", false);
    });
  });

  async function renderPending() {
    render(<TrendDiscoveryPage />);
    expect(await screen.findByText("Package registry theft")).toBeTruthy();
  }

  function topicListGets(): number {
    return adminFetch.mock.calls.filter(([url, init]) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      return method === "GET" && String(url).includes("/api/admin/topics?");
    }).length;
  }

  it("removes the row after Radar without reloading the list", async () => {
    await renderPending();
    const loadsBefore = topicListGets();

    fireEvent.click(screen.getByRole("button", { name: "Radar" }));

    await waitFor(() => {
      expect(screen.queryByText("Package registry theft")).toBeNull();
    });
    expect(screen.queryByText("Loading topics…")).toBeNull();
    expect(topicListGets()).toBe(loadsBefore);
    expect(
      adminFetch.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/admin/topics/7/approve") &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });

  it("removes the row after Watch without reloading the list", async () => {
    await renderPending();
    const loadsBefore = topicListGets();

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    await waitFor(() => {
      expect(screen.queryByText("Package registry theft")).toBeNull();
    });
    expect(screen.queryByText("Loading topics…")).toBeNull();
    expect(topicListGets()).toBe(loadsBefore);
  });
});

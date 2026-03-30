"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INDUSTRIES = [
  "All Industries",
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "Manufacturing",
  "Government & Public Sector",
  "Retail & E-Commerce",
  "Energy & Utilities",
  "Education",
  "Media & Entertainment",
];

const DOMAINS = ["AI", "Security", "Cloud", "Finance", "Leadership", "Other"];

function authHeader(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("pulse_admin_token") ?? "")
      : "";
  return { Authorization: `Bearer ${token}` };
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export default function NewsletterSandboxPage() {
  const [html, setHtml] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Simulation controls
  const [industry, setIndustry] = useState("Technology");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  }

  const loadPreview = useCallback(
    async (ind: string, doms: string[]) => {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (ind && ind !== "All Industries") params.set("industry", ind);
        doms.forEach((d) => params.append("domains", d));

        const url = `${API_BASE}/api/admin/newsletter/preview${
          params.toString() ? `?${params}` : ""
        }`;
        const res = await fetch(url, { headers: authHeader() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setHtml(await res.text());
        setLastRefreshed(new Date());
        setState("loaded");
      } catch {
        setState("error");
      }
    },
    [],
  );

  // Load on mount with defaults
  useEffect(() => {
    loadPreview(industry, selectedDomains);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subtitle description of the current simulation
  const simDesc =
    selectedDomains.length > 0
      ? `${industry === "All Industries" ? "All Industries" : industry} · ${selectedDomains.join(", ")}`
      : `${industry === "All Industries" ? "All Industries" : industry} · All Domains`;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Newsletter Simulation Sandbox
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Simulating:{" "}
            <span className="font-medium text-indigo-400">{simDesc}</span>
            {lastRefreshed && (
              <span className="ml-3 text-xs text-gray-600">
                · Refreshed {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-6">
          {/* ── Simulation Controls ── */}
          <aside className="w-56 shrink-0 space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Industry
              </h2>
              <div className="space-y-1">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setIndustry(ind)}
                    className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      industry === ind
                        ? "bg-indigo-600/25 text-indigo-300 ring-1 ring-indigo-500/40"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Domain Interests
              </h2>
              <p className="mb-2 text-xs text-gray-600">
                None selected = all domains
              </p>
              <div className="space-y-2">
                {DOMAINS.map((domain) => (
                  <label
                    key={domain}
                    className="flex cursor-pointer items-center gap-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDomains.includes(domain)}
                      onChange={() => toggleDomain(domain)}
                      className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 accent-indigo-500"
                    />
                    <span className="text-xs text-gray-300">{domain}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => loadPreview(industry, selectedDomains)}
              disabled={state === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {state === "loading" && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {state === "loading" ? "Running…" : "Run Simulation"}
            </button>
          </aside>

          {/* ── Preview iframe ── */}
          <div className="flex flex-1 flex-col">
            {state === "error" ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-red-900 bg-gray-900 p-10 text-center">
                <div>
                  <p className="text-base font-medium text-red-400">
                    Failed to load preview
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Check that the backend is running and you are logged in.
                  </p>
                  <button
                    onClick={() => loadPreview(industry, selectedDomains)}
                    className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : state === "loading" && !html ? (
              <div
                className="flex flex-1 items-center justify-center rounded-xl border border-gray-800 bg-gray-900"
                style={{ minHeight: "600px" }}
              >
                <p className="text-sm text-gray-500">Running simulation…</p>
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-xl border border-gray-800 shadow-xl"
                style={{ minHeight: "600px" }}
              >
                <iframe
                  srcDoc={html}
                  title="Newsletter Simulation Preview"
                  className="h-full w-full"
                  style={{ minHeight: "600px", border: "none" }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

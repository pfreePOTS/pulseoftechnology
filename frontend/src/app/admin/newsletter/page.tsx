"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

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

interface Role {
  id: number;
  name: string;
  tags: string[] | null;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export default function NewsletterSandboxPage() {
  const [html, setHtml] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Simulation controls
  const [industry, setIndustry] = useState("Technology");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  }

  async function loadRoles() {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/roles`);
      if (res.ok) setRoles(await res.json());
    } catch {
      // roles are optional — fail silently
    }
  }

  const loadPreview = useCallback(
    async (ind: string, doms: string[], roleId: number | "") => {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (ind && ind !== "All Industries") params.set("industry", ind);
        doms.forEach((d) => params.append("domains", d));
        if (roleId !== "") params.set("role_id", String(roleId));

        const url = `${API_BASE}/api/admin/newsletter/preview${
          params.toString() ? `?${params}` : ""
        }`;
        const res = await adminFetch(url);
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

  useEffect(() => {
    loadRoles();
    loadPreview(industry, selectedDomains, selectedRoleId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const rolePart = selectedRole ? selectedRole.name : "No Role";
  const domainPart =
    selectedDomains.length > 0 ? selectedDomains.join(", ") : "All Domains";
  const industryPart = industry === "All Industries" ? "All Industries" : industry;
  const simDesc = `${rolePart} · ${industryPart} · ${domainPart}`;

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

            {/* Role Persona */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Role Persona
              </h2>
              <select
                value={selectedRoleId}
                onChange={(e) =>
                  setSelectedRoleId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No Role (All Articles)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.tags && r.tags.length > 0 ? ` · ${r.tags.join(", ")}` : ""}
                  </option>
                ))}
              </select>
              {selectedRole && selectedRole.tags && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedRole.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Industry */}
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

            {/* Domain Interests */}
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
              onClick={() => loadPreview(industry, selectedDomains, selectedRoleId)}
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
                    onClick={() => loadPreview(industry, selectedDomains, selectedRoleId)}
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

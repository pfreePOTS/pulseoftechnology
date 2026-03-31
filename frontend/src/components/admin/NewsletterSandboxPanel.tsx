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

type Props = {
  /** Hide the large page title when embedded in the workbench */
  embedded?: boolean;
};

const PREVIEW_MIN_HEIGHT = 600;

export default function NewsletterSandboxPanel({ embedded = false }: Props) {
  const [html, setHtml] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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
      /* optional */
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
    void loadRoles();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadPreview(industry, selectedDomains, selectedRoleId);
    }, 300);
    return () => window.clearTimeout(id);
  }, [industry, selectedDomains, selectedRoleId, loadPreview]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const rolePart = selectedRole ? selectedRole.name : "No Role";
  const domainPart =
    selectedDomains.length > 0 ? selectedDomains.join(", ") : "All Domains";
  const industryPart = industry === "All Industries" ? "All Industries" : industry;
  const simDesc = `${rolePart} · ${industryPart} · ${domainPart}`;

  return (
    <div className={embedded ? "" : "mx-auto max-w-7xl"}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Newsletter Simulation Sandbox
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Simulating:{" "}
            <span className="font-medium text-indigo-400">{simDesc}</span>
            {lastRefreshed && (
              <span className="ml-3 text-xs text-gray-600">
                · Refreshed{" "}
                {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-[200px] flex-1">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Role
              </h2>
              <select
                value={selectedRoleId}
                onChange={(e) =>
                  setSelectedRoleId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No Role (generic impact)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.tags && r.tags.length > 0 ? ` · ${r.tags.join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px] flex-1">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Industry
              </h2>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[min(100%,280px)] flex-[2]">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Domains
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {DOMAINS.map((domain) => (
                  <label
                    key={domain}
                    className="inline-flex cursor-pointer items-center gap-2"
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

            <div className="flex min-w-[160px] max-w-md flex-col justify-end text-xs text-gray-500">
              <span className="text-gray-400">(auto-refreshes)</span>
              {embedded && (
                <span
                  className="mt-1 line-clamp-2 text-[11px] leading-snug text-indigo-400/90"
                  title={simDesc}
                >
                  {simDesc}
                </span>
              )}
              {state === "loading" && (
                <span className="mt-1 text-indigo-400">Updating preview…</span>
              )}
              {lastRefreshed && state !== "loading" && (
                <span className="mt-1 text-gray-600">
                  {lastRefreshed.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex w-full flex-col"
          style={{ minHeight: PREVIEW_MIN_HEIGHT }}
        >
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
                  type="button"
                  onClick={() =>
                    void loadPreview(industry, selectedDomains, selectedRoleId)
                  }
                  className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : state === "loading" && !html ? (
            <div
              className="flex flex-1 items-center justify-center rounded-xl border border-gray-800 bg-gray-900"
              style={{ minHeight: PREVIEW_MIN_HEIGHT }}
            >
              <p className="text-sm text-gray-500">Running simulation…</p>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-xl border border-gray-800 shadow-xl"
              style={{ minHeight: PREVIEW_MIN_HEIGHT }}
            >
              <iframe
                srcDoc={html}
                title="Newsletter Simulation Preview"
                className="h-full w-full"
                style={{ minHeight: PREVIEW_MIN_HEIGHT, border: "none" }}
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

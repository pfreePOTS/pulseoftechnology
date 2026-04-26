"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";
import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

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

const PREVIEW_MIN_HEIGHT = 1200;

export default function NewsletterSandboxPanel({ embedded = false }: Props) {
  const [html, setHtml] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [industryChips, setIndustryChips] = useState<string[]>([]);
  const [domainChips, setDomainChips] = useState<string[]>([]);
  const [filterOptionsError, setFilterOptionsError] = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  }

  function toggleIndustry(ind: string) {
    setSelectedIndustries((prev) =>
      prev.includes(ind) ? prev.filter((x) => x !== ind) : [...prev, ind],
    );
  }

  function toggleRoleId(id: number) {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
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
    async (inds: string[], doms: string[], rids: number[]) => {
      setState("loading");
      try {
        const params = new URLSearchParams();
        inds.forEach((i) => params.append("industries", i));
        doms.forEach((d) => params.append("domains", d));
        rids.forEach((id) => params.append("role_ids", String(id)));

        const url = `${API_BASE}/api/admin/newsletter/preview${
          params.toString() ? `?${params}` : ""
        }`;
        const res = await adminFetch(url, { cache: "no-store" });
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
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/admin/newsletter/preview-filters`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { industries: string[]; domains: string[] };
        if (cancelled) return;
        setFilterOptionsError(false);
        setIndustryChips(data.industries);
        setDomainChips(data.domains);
        const preferred =
          data.industries.includes("Technology") ? ["Technology"] : data.industries[0] ? [data.industries[0]] : [];
        setSelectedIndustries(preferred);
      } catch {
        if (!cancelled) {
          setFilterOptionsError(true);
          setIndustryChips([...INDUSTRY_OPTIONS]);
          setDomainChips([]);
          const preferred =
            INDUSTRY_OPTIONS.includes("Technology") ? ["Technology"] : INDUSTRY_OPTIONS[0] ? [INDUSTRY_OPTIONS[0]] : [];
          setSelectedIndustries(preferred);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (industryChips.length === 0 && !filterOptionsError) return;
    const id = window.setTimeout(() => {
      void loadPreview(selectedIndustries, selectedDomains, selectedRoleIds);
    }, 300);
    return () => window.clearTimeout(id);
  }, [
    industryChips.length,
    filterOptionsError,
    selectedIndustries,
    selectedDomains,
    selectedRoleIds,
    loadPreview,
  ]);

  const selectedRoleNames = roles
    .filter((r) => selectedRoleIds.includes(r.id))
    .map((r) => r.name);
  const rolePart = selectedRoleNames.length > 0 ? selectedRoleNames.join(", ") : "No Role";
  const domainPart =
    selectedDomains.length > 0 ? selectedDomains.join(", ") : "All Domains";
  const industryPart =
    selectedIndustries.length > 0 ? selectedIndustries.join(", ") : "All Industries";
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
            <div className="min-w-[min(100%,320px)] flex-[2]">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Role (multi)
              </h2>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => {
                  const on = selectedRoleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRoleId(r.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                        on
                          ? "bg-indigo-500/25 text-indigo-300 ring-indigo-500/50"
                          : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                      }`}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
              {roles.length === 0 && (
                <p className="text-xs text-gray-500">Loading roles…</p>
              )}
            </div>

            <div className="min-w-[min(100%,320px)] flex-[2]">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Industry (multi)
              </h2>
              {filterOptionsError && (
                <p className="mb-2 text-[11px] text-amber-400/90">
                  Could not load filter options from the API — using local industry grid. Domains unavailable.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {industryChips.length === 0 ? (
                  <p className="text-xs text-gray-500">Loading industries…</p>
                ) : (
                  industryChips.map((ind) => {
                    const on = selectedIndustries.includes(ind);
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => toggleIndustry(ind)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-[#019E7C]/25 text-[#019E7C] ring-[#019E7C]/50"
                            : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                        }`}
                      >
                        {ind}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="min-w-[min(100%,280px)] flex-[2]">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Domains (multi)
              </h2>
              <p className="mb-2 text-[11px] leading-snug text-gray-600">
                Topics are the watched/selected pipeline (same as the daily send). Leave all domain chips off to preview
                the full eligible briefing; turn domains on to narrow the simulation like subscriber domain picks.
              </p>
              <div className="flex flex-wrap gap-2">
                {industryChips.length === 0 && !filterOptionsError ? (
                  <p className="text-xs text-gray-500">Loading domains…</p>
                ) : domainChips.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    {filterOptionsError
                      ? "Domains were not loaded — fix the API connection and reload this page."
                      : "No domains on selected topics — promote topics to Selected in Research, or topics have no domain set."}
                  </p>
                ) : (
                  domainChips.map((domain) => {
                    const on = selectedDomains.includes(domain);
                    return (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => toggleDomain(domain)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-amber-500/20 text-amber-200 ring-amber-500/45"
                            : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                        }`}
                      >
                        {domain}
                      </button>
                    );
                  })
                )}
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
                    void loadPreview(selectedIndustries, selectedDomains, selectedRoleIds)
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

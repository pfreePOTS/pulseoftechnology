"use client";

import { useEffect, useMemo, useState } from "react";

import { API_BASE } from "@/lib/api";

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Manufacturing",
  "Education",
  "Retail & E-Commerce",
  "Government & Public Sector",
  "Media & Entertainment",
  "Energy & Utilities",
  "Other",
];

const DOMAIN_OPTIONS = [
  { value: "AI", label: "Artificial Intelligence" },
  { value: "Security", label: "Cybersecurity" },
  { value: "Cloud", label: "Cloud & Infrastructure" },
  { value: "Finance", label: "FinTech & Finance" },
  { value: "Leadership", label: "Leadership & Strategy" },
  { value: "Other", label: "Other Topics" },
];

interface Role {
  id: number;
  name: string;
}

interface Preferences {
  email: string;
  first_name: string;
  last_name: string;
  industries: string[] | null;
  domains: string[] | null;
  role_ids: number[] | null;
  is_active: boolean;
}

interface FormState {
  first_name: string;
  last_name: string;
  industries: string[];
  domains: string[];
  role_ids: number[];
}

function toForm(p: Preferences): FormState {
  return {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    industries: p.industries ?? [],
    domains: p.domains ?? [],
    role_ids: p.role_ids ?? [],
  };
}

function toggleString(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function toggleNumber(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function PreferencesPage() {
  const [token, setToken] = useState("");
  const [unsubscribePrompt, setUnsubscribePrompt] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    last_name: "",
    industries: [],
    domains: [],
    role_ids: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token") ?? "";
    setToken(nextToken);
    setUnsubscribePrompt(params.get("unsubscribe") === "1");
    if (!nextToken) {
      setError("This preferences link is missing or invalid.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [prefRes, roleRes] = await Promise.all([
          fetch(`${API_BASE}/api/subscriber/preferences?token=${encodeURIComponent(nextToken)}`),
          fetch(`${API_BASE}/api/roles`),
        ]);
        if (!prefRes.ok) {
          throw new Error("This preferences link is invalid or has expired.");
        }
        const prefData = (await prefRes.json()) as Preferences;
        setPrefs(prefData);
        setForm(toForm(prefData));
        if (roleRes.ok) {
          setRoles((await roleRes.json()) as Role[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load preferences.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const canSubmit = useMemo(
    () =>
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.role_ids.length > 0 &&
      form.industries.length > 0 &&
      form.domains.length > 0,
    [form],
  );

  async function savePreferences() {
    if (!token) return;
    if (!canSubmit) {
      setError("Select at least one title, one industry, and one topic domain.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `${API_BASE}/api/subscriber/preferences?token=${encodeURIComponent(token)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            industries: form.industries.length > 0 ? form.industries : null,
            domains: form.domains.length > 0 ? form.domains : null,
            role_ids: form.role_ids,
          }),
        },
      );
      if (!res.ok) throw new Error("Could not save preferences.");
      const data = (await res.json()) as Preferences;
      setPrefs(data);
      setForm(toForm(data));
      setMessage("Your preferences have been updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    if (!token) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `${API_BASE}/api/subscriber/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Could not unsubscribe.");
      const data = (await res.json()) as Preferences;
      setPrefs(data);
      setMessage("You have been unsubscribed from Pulse of Technology Daily.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unsubscribe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8FA] px-6 py-12 text-gray-900">
      <section className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pulse-teal">
          Pulse of Technology Daily
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Manage your preferences</h1>
        <p className="mt-3 text-sm leading-6 text-[#4A5F6D]">
          Adjust the industries, roles, and topic domains that shape your daily briefing.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-[#4A5F6D]">Loading preferences...</p>
        ) : error && !prefs ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            {prefs && (
              <div className="mt-6 rounded-lg bg-[#F4F8FA] p-4 text-sm text-[#4A5F6D]">
                Signed in by link as <span className="font-semibold text-gray-900">{prefs.email}</span>
                {prefs.is_active ? "" : " (currently unsubscribed)"}
              </div>
            )}

            {unsubscribePrompt && prefs?.is_active && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Unsubscribe from the daily briefing?</p>
                <p className="mt-1 text-sm text-red-700">
                  You can unsubscribe now, or update your preferences below to receive a more relevant briefing.
                </p>
                <button
                  type="button"
                  onClick={unsubscribe}
                  disabled={saving}
                  className="mt-3 rounded-lg bg-[#E91D24] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Updating..." : "Unsubscribe"}
                </button>
              </div>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold">First name</span>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-pulse-teal focus:ring-2 focus:ring-pulse-teal/20"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Last name</span>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-pulse-teal focus:ring-2 focus:ring-pulse-teal/20"
                />
              </label>
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-semibold">Your titles</h2>
              <p className="mt-1 text-sm text-[#4A5F6D]">Select at least one title.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        role_ids: toggleNumber(prev.role_ids, role.id),
                      }))
                    }
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      form.role_ids.includes(role.id)
                        ? "border-pulse-teal bg-pulse-teal text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold">Industries</h2>
              <p className="mt-1 text-sm text-[#4A5F6D]">Select at least one industry.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {INDUSTRIES.map((industry) => (
                  <label key={industry} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.industries.includes(industry)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          industries: toggleString(prev.industries, industry),
                        }))
                      }
                      className="h-4 w-4 accent-pulse-teal"
                    />
                    {industry}
                  </label>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold">Topic domains</h2>
              <p className="mt-1 text-sm text-[#4A5F6D]">
                Select at least one topic domain for your briefing.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {DOMAIN_OPTIONS.map((domain) => (
                  <label key={domain.value} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.domains.includes(domain.value)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          domains: toggleString(prev.domains, domain.value),
                        }))
                      }
                      className="h-4 w-4 accent-pulse-teal"
                    />
                    {domain.label}
                  </label>
                ))}
              </div>
            </section>

            {error && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {message}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={savePreferences}
                disabled={!canSubmit || saving}
                className="rounded-lg bg-pulse-teal px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save preferences"}
              </button>
              {prefs?.is_active && (
                <button
                  type="button"
                  onClick={unsubscribe}
                  disabled={saving}
                  className="rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-[#E91D24] disabled:opacity-60"
                >
                  Unsubscribe
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

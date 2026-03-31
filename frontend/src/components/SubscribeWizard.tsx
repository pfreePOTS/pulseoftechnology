"use client";

import { useEffect, useState } from "react";

import {
  consumeSubscribeDomainPrefill,
  SUBSCRIBE_PREFILL_EVENT,
} from "@/lib/subscribeNavigation";
import { useIsClient } from "@/lib/useIsClient";

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
  { value: "AI", label: "Artificial Intelligence", color: "#8b5cf6" },
  { value: "Security", label: "Cybersecurity", color: "#ef4444" },
  { value: "Cloud", label: "Cloud & Infrastructure", color: "#38bdf8" },
  { value: "Finance", label: "FinTech & Finance", color: "#10b981" },
  { value: "Leadership", label: "Leadership & Strategy", color: "#f59e0b" },
  { value: "Other", label: "Other Topics", color: "#6b7280" },
];

type Step = 1 | 2 | 3 | 4;

interface PublicRole {
  id: number;
  name: string;
}

interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  role_id: number | null;
  industry: string;
  domains: string[];
}

interface Props {
  apiBase: string;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = (i + 1) as Step;
        const active = n === current;
        const done = n < current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : done
                    ? "bg-indigo-900 text-indigo-300"
                    : "bg-gray-800 text-gray-500"
              }`}
            >
              {done ? "✓" : n}
            </div>
            {i < total - 1 && (
              <div className={`h-px w-8 ${done ? "bg-indigo-700" : "bg-gray-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SubscribeWizard({ apiBase }: Props) {
  const isClient = useIsClient();
  const [step, setStep] = useState<Step>(1);
  const [roles, setRoles] = useState<PublicRole[]>([]);
  const [rolesError, setRolesError] = useState("");
  const [form, setForm] = useState<FormData>({
    email: "",
    first_name: "",
    last_name: "",
    role_id: null,
    industry: "",
    domains: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isClient) return;
    fetch(`${apiBase}/api/roles`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load roles"))))
      .then((data: PublicRole[]) => setRoles(data))
      .catch(() => setRolesError("Roles could not be loaded. Refresh and try again."));
  }, [apiBase, isClient]);

  useEffect(() => {
    if (!isClient) return;
    const prefill = consumeSubscribeDomainPrefill();
    if (!prefill) return;
    const valid = DOMAIN_OPTIONS.some((o) => o.value === prefill);
    if (!valid) return;
    setForm((prev) => ({ ...prev, domains: [prefill] }));
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    function onPrefill(e: Event) {
      const d = (e as CustomEvent<{ domain?: string }>).detail?.domain;
      if (!d || !DOMAIN_OPTIONS.some((o) => o.value === d)) return;
      setForm((prev) => ({ ...prev, domains: [d] }));
    }
    window.addEventListener(SUBSCRIBE_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(SUBSCRIBE_PREFILL_EVENT, onPrefill);
  }, [isClient]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setAllDomains() {
    setForm((prev) => ({ ...prev, domains: [] }));
  }

  function toggleDomain(d: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(d) ? prev.domains.filter((x) => x !== d) : [...prev.domains, d],
    }));
  }

  function validateStep1(): boolean {
    const e: typeof errors = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.email.trim()) {
      e.email = "Required";
    } else if (!isValidEmail(form.email)) {
      e.email = "Enter a valid email address";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    if (roles.length === 0) return true;
    if (form.role_id === null) {
      setErrors({ role_id: "Please select your role" });
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!form.industry) {
      setErrors({ industry: "Please select your industry" });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep((prev) => (prev < 4 ? ((prev + 1) as Step) : prev));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setApiError("");
    try {
      const res = await fetch(`${apiBase}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role_id: form.role_id,
          industry: form.industry || null,
          domains: form.domains.length > 0 ? form.domains : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { detail?: string }).detail ?? `Request failed (${res.status})`,
        );
      }
      setDone(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const roleLabel = roles.find((r) => r.id === form.role_id)?.name ?? "your role";
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/20">
          <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">You&apos;re on the Radar</h3>
        <p className="mt-2 text-sm text-gray-400">
          Welcome, {form.first_name}. We&apos;ll tailor the Pulse for{" "}
          <strong className="text-gray-300">{roleLabel}</strong>
          {form.domains.length > 0 ? (
            <>
              {" "}
              across <strong className="text-gray-300">{form.domains.join(", ")}</strong>
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  const allDomainsMode = form.domains.length === 0;

  const inputCls =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const errorCls = "mt-1 text-xs text-red-400";

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
      <h2 className="mb-1 text-xl font-bold text-white">Subscribe to the Pulse</h2>
      <p className="mb-6 text-sm text-gray-400">
        Get a weekly C-level briefing tailored to your role, industry, and interests.
      </p>

      {!isClient ? (
        <div className="min-h-[280px] rounded-lg bg-gray-800/40 animate-pulse" aria-busy aria-label="Loading form" />
      ) : (
        <>
          <StepIndicator current={step} total={4} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">First name</label>
                  <input
                    type="text"
                    placeholder="Jane"
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                  {errors.first_name && <p className={errorCls}>{errors.first_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Last name</label>
                  <input
                    type="text"
                    placeholder="Smith"
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    className={inputCls}
                  />
                  {errors.last_name && <p className={errorCls}>{errors.last_name}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Work email</label>
                <input
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputCls}
                  onKeyDown={(e) => e.key === "Enter" && handleNext()}
                />
                {errors.email && <p className={errorCls}>{errors.email}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Your role</label>
              {!rolesError && roles.length === 0 && (
                <p className="mb-2 text-sm text-gray-500">
                  Role options are not available yet; you can continue and we&apos;ll still personalize your briefing by
                  industry and domains.
                </p>
              )}
              {rolesError ? (
                <p className="text-sm text-red-400">{rolesError}</p>
              ) : roles.length > 0 ? (
                <select
                  value={form.role_id ?? ""}
                  onChange={(e) =>
                    set("role_id", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={`${inputCls} appearance-none`}
                >
                  <option value="" disabled>
                    Select your role…
                  </option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {errors.role_id && <p className={errorCls}>{errors.role_id}</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">Your industry</label>
              <select
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                className={`${inputCls} appearance-none`}
              >
                <option value="" disabled>
                  Select your industry…
                </option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
              {errors.industry && <p className={errorCls}>{errors.industry}</p>}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-3 text-xs text-gray-400">
                Choose the full briefing across all domains, or pick specific topics below:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={allDomainsMode}
                  onClick={() => {
                    if (!allDomainsMode) setAllDomains();
                  }}
                  className={`col-span-2 flex items-start gap-3 rounded-lg border-2 px-3 py-3 text-left text-xs transition-all sm:col-span-3 ${
                    allDomainsMode
                      ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30"
                      : "border-gray-600 bg-gray-800/50 hover:border-gray-500"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      allDomainsMode
                        ? "border-indigo-400 bg-indigo-600/30 text-indigo-300"
                        : "border-gray-600 bg-gray-800 text-transparent"
                    }`}
                    aria-hidden
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-semibold ${allDomainsMode ? "text-indigo-100" : "text-gray-400"}`}>
                      All Domains — get the full briefing
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                      {allDomainsMode
                        ? "You'll receive coverage across every topic we track."
                        : "Switch back to include all topics in your Pulse."}
                    </span>
                  </span>
                </button>
                {DOMAIN_OPTIONS.map(({ value, label, color }) => {
                  const active = form.domains.includes(value);
                  const dimmed = allDomainsMode;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleDomain(value)}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                        dimmed
                          ? "cursor-pointer border-gray-700/80 bg-gray-800/40 opacity-45 hover:border-gray-600 hover:opacity-70"
                          : active
                            ? "border-indigo-500 bg-indigo-600/20 opacity-100"
                            : "border-gray-700 bg-gray-800 opacity-100 hover:border-gray-600"
                      }`}
                    >
                      <span className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className={`font-semibold ${!dimmed && active ? "text-white" : "text-gray-300"}`}>
                        {value}
                      </span>
                      <span className="text-gray-500">{label}</span>
                    </button>
                  );
                })}
              </div>
              {apiError && (
                <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{apiError}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
                className="text-sm text-gray-500 transition-colors hover:text-gray-300"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-pulse-red px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-pulse-red px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Subscribing…" : "Subscribe to the Pulse"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

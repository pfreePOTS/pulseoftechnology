"use client";

import { useState } from "react";

import { useIsClient } from "@/lib/useIsClient";

// ── Config ────────────────────────────────────────────────────────────────────

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
  { value: "AI",         label: "Artificial Intelligence", color: "#8b5cf6" },
  { value: "Security",   label: "Cybersecurity",           color: "#ef4444" },
  { value: "Cloud",      label: "Cloud & Infrastructure",  color: "#38bdf8" },
  { value: "Finance",    label: "FinTech & Finance",       color: "#10b981" },
  { value: "Leadership", label: "Leadership & Strategy",   color: "#f59e0b" },
  { value: "Other",      label: "Other Topics",            color: "#6b7280" },
];

type Step = 1 | 2 | 3;

interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  industry: string;
  domains: string[];
}

interface Props {
  apiBase: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubscribeWizard({ apiBase }: Props) {
  const isClient = useIsClient();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    email: "",
    first_name: "",
    last_name: "",
    industry: "",
    domains: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(false);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleDomain(d: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter((x) => x !== d)
        : [...prev.domains, d],
    }));
  }

  // Step 1 validation
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

  // Step 2 validation
  function validateStep2(): boolean {
    if (!form.industry) {
      setErrors({ industry: "Please select your industry" });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
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

  // ── Success screen
  if (done) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/20">
          <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">You&apos;re on the Radar</h3>
        <p className="mt-2 text-sm text-gray-400">
          Welcome, {form.first_name}. We&apos;ll send you the Pulse tailored to{" "}
          <strong className="text-gray-300">{form.domains.join(", ") || "your interests"}</strong>.
        </p>
      </div>
    );
  }

  // ── Shared input class
  const inputCls =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const errorCls = "mt-1 text-xs text-red-400";

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
      <h2 className="mb-1 text-xl font-bold text-white">Subscribe to the Pulse</h2>
      <p className="mb-6 text-sm text-gray-400">
        Get a weekly C-level briefing tailored to your industry.
      </p>

      {!isClient ? (
        <div
          className="min-h-[280px] rounded-lg bg-gray-800/40 animate-pulse"
          aria-busy
          aria-label="Loading form"
        />
      ) : (
        <>
      <StepIndicator current={step} total={3} />

      {/* ── Step 1: Contact info ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                First name
              </label>
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
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Last name
              </label>
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
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Work email
            </label>
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

      {/* ── Step 2: Industry ── */}
      {step === 2 && (
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-400">
            Your industry
          </label>
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

      {/* ── Step 3: Domain interests ── */}
      {step === 3 && (
        <div>
          <p className="mb-3 text-xs text-gray-400">
            Select the domains you care about most (choose any number):
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DOMAIN_OPTIONS.map(({ value, label, color }) => {
              const active = form.domains.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDomain(value)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-600/20"
                      : "border-gray-700 bg-gray-800 hover:border-gray-600"
                  }`}
                >
                  <span
                    className="mb-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className={`font-semibold ${active ? "text-white" : "text-gray-300"}`}>
                    {value}
                  </span>
                  <span className="text-gray-500">{label}</span>
                </button>
              );
            })}
          </div>
          {apiError && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {apiError}
            </p>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        {step < 3 ? (
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

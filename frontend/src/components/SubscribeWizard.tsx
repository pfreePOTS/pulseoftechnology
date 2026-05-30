"use client";

import { useEffect, useState } from "react";

import {
  consumeSubscribeDomainPrefill,
  SUBSCRIBE_PREFILL_EVENT,
} from "@/lib/subscribeNavigation";
import { useDomains } from "@/lib/useDomains";
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

type Step = 1 | 2 | 3 | 4 | 5;

interface PublicRole {
  id: number;
  name: string;
}

interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  role_ids: number[];
  industries: string[];
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
                  ? "bg-pulse-teal text-white"
                  : done
                    ? "bg-gray-100 text-pulse-teal"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {done ? "✓" : n}
            </div>
            {i < total - 1 && (
              <div className={`h-px w-8 ${done ? "bg-pulse-teal" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SubscribeWizard({ apiBase }: Props) {
  const isClient = useIsClient();
  const { domains: domainOptions } = useDomains(apiBase);
  const [step, setStep] = useState<Step>(1);
  const [roles, setRoles] = useState<PublicRole[]>([]);
  const [rolesError, setRolesError] = useState("");
  const [form, setForm] = useState<FormData>({
    email: "",
    first_name: "",
    last_name: "",
    role_ids: [],
    industries: [],
    domains: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);

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
    const valid = domainOptions.some((o) => o.slug === prefill);
    if (!valid) return;
    setForm((prev) => ({ ...prev, domains: [prefill] }));
  }, [isClient, domainOptions]);

  useEffect(() => {
    if (!isClient) return;
    function onPrefill(e: Event) {
      const d = (e as CustomEvent<{ domain?: string }>).detail?.domain;
      if (!d || !domainOptions.some((o) => o.slug === d)) return;
      setForm((prev) => ({ ...prev, domains: [d] }));
    }
    window.addEventListener(SUBSCRIBE_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(SUBSCRIBE_PREFILL_EVENT, onPrefill);
  }, [isClient, domainOptions]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleDomain(d: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(d) ? prev.domains.filter((x) => x !== d) : [...prev.domains, d],
    }));
    setErrors((prev) => ({ ...prev, domains: undefined }));
  }

  function toggleRoleId(id: number) {
    setForm((prev) => ({
      ...prev,
      role_ids: prev.role_ids.includes(id)
        ? prev.role_ids.filter((x) => x !== id)
        : [...prev.role_ids, id],
    }));
    setErrors((prev) => ({ ...prev, role_ids: undefined }));
  }

  function toggleIndustry(ind: string) {
    setForm((prev) => ({
      ...prev,
      industries: prev.industries.includes(ind)
        ? prev.industries.filter((x) => x !== ind)
        : [...prev.industries, ind],
    }));
    setErrors((prev) => ({ ...prev, industries: undefined }));
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
    if (form.role_ids.length === 0) {
      setErrors({ role_ids: "Select at least one title" });
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (form.industries.length === 0) {
      setErrors({ industries: "Select at least one industry" });
      return false;
    }
    return true;
  }

  function validateStep4(): boolean {
    if (form.domains.length === 0) {
      setErrors({ domains: "Select at least one topic domain" });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;
    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  }

  function goToStep(next: Step) {
    setApiError("");
    setStep(next);
  }

  function startOver() {
    setForm({
      email: "",
      first_name: "",
      last_name: "",
      role_ids: [],
      industries: [],
      domains: [],
    });
    setStep(1);
    setErrors({});
    setApiError("");
    setDone(false);
    setDuplicateEmail(false);
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
          role_ids: form.role_ids,
          industries: form.industries,
          domains: form.domains,
        }),
      });
      if (res.status === 409) {
        setDuplicateEmail(true);
        return;
      }
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

  if (duplicateEmail) {
    const displayEmail = form.email.trim().toLowerCase();
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100">
          <svg
            className="h-8 w-8 text-sky-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-pulse-teal">You&apos;re already subscribed!</h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The email <span className="font-medium text-gray-900">{displayEmail}</span> is already on
          our list. Keep an eye on your inbox for the next briefing.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="mt-8 rounded-lg border-2 border-pulse-teal bg-white px-6 py-2.5 text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal/5"
        >
          Start Over
        </button>
      </div>
    );
  }

  if (done) {
    const roleLabel =
      form.role_ids
        .map((id) => roles.find((r) => r.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "your title";
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pulse-teal/10">
          <svg className="h-7 w-7 text-pulse-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-pulse-teal">You&apos;re on the Radar</h3>
        <p className="mt-2 text-sm text-gray-600">
          Welcome, {form.first_name}. We&apos;ll tailor the Pulse for{" "}
          <strong className="font-semibold text-gray-900">{roleLabel}</strong>
          {" "}
          across{" "}
          <strong className="font-semibold text-gray-900">
            {form.domains
              .map((slug) => domainOptions.find((d) => d.slug === slug)?.short_label ?? slug)
              .join(", ")}
          </strong>
          .
        </p>
      </div>
    );
  }

  const roleLabel =
    form.role_ids.length > 0
      ? form.role_ids
          .map((id) => roles.find((r) => r.id === id)?.name)
          .filter(Boolean)
          .join(", ") || (roles.length === 0 ? "Not specified" : "—")
      : roles.length === 0
        ? "Not specified"
        : "—";

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-pulse-teal focus:outline-none focus:ring-2 focus:ring-pulse-teal";
  const errorCls = "mt-1 text-xs text-red-600";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-bold text-pulse-teal">Subscribe to the Pulse</h2>
      <p className="mb-6 text-sm text-gray-600">
        Get a daily C-level briefing tailored to your role, industry, and interests.
      </p>

      {!isClient ? (
        <div className="min-h-[280px] rounded-lg bg-gray-200/80 animate-pulse" aria-busy aria-label="Loading form" />
      ) : (
        <>
          <StepIndicator current={step} total={5} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">First name</label>
                  <input
                    type="text"
                    placeholder="Jane"
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    className={inputCls}
                  />
                  {errors.first_name && <p className={errorCls}>{errors.first_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Last name</label>
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
                <label className="mb-1 block text-xs font-medium text-gray-700">Work email</label>
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
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Your title (select one or more)
              </label>
              {!rolesError && roles.length === 0 && (
                <p className="mb-2 text-sm text-gray-600">
                  Loading title options...
                </p>
              )}
              {rolesError ? (
                <p className="text-sm text-red-600">{rolesError}</p>
              ) : roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const on = form.role_ids.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRoleId(r.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-pulse-teal/15 text-pulse-teal ring-pulse-teal/40"
                            : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {errors.role_ids && <p className={errorCls}>{errors.role_ids}</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Your industry (select one or more)
              </label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => {
                  const on = form.industries.includes(ind);
                  return (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => toggleIndustry(ind)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-inset transition-colors ${
                        on
                          ? "bg-pulse-teal/15 text-pulse-teal ring-pulse-teal/40"
                          : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {ind}
                    </button>
                  );
                })}
              </div>
              {errors.industries && <p className={errorCls}>{errors.industries}</p>}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-3 text-xs text-gray-600">
                Choose at least one topic domain for your briefing.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {domainOptions.map(({ slug, label, short_label, color }) => {
                  const active = form.domains.includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleDomain(slug)}
                      aria-label={short_label}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                        active
                          ? "border-pulse-teal bg-pulse-teal/5 opacity-100"
                          : "border-gray-200 bg-white text-gray-700 opacity-100 hover:border-gray-300"
                      }`}
                    >
                      <span className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span
                        className={`font-semibold ${
                          active ? "text-pulse-teal" : "text-gray-700"
                        }`}
                      >
                        {short_label}
                      </span>
                      <span className="text-gray-600">{label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.domains && <p className={errorCls}>{errors.domains}</p>}
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="mb-4 text-sm font-medium text-pulse-teal">
                Review your subscription details
              </p>
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <dl className="divide-y divide-gray-200">
                  <div className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Name</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {form.first_name.trim()} {form.last_name.trim()}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="shrink-0 text-sm font-medium text-pulse-teal underline decoration-pulse-teal/40 underline-offset-2 hover:decoration-pulse-teal"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Email</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{form.email.trim()}</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="shrink-0 text-sm font-medium text-pulse-teal underline decoration-pulse-teal/40 underline-offset-2 hover:decoration-pulse-teal"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Role</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{roleLabel}</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="shrink-0 text-sm font-medium text-pulse-teal underline decoration-pulse-teal/40 underline-offset-2 hover:decoration-pulse-teal"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Industry</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {form.industries.length > 0 ? form.industries.join(", ") : "—"}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="shrink-0 text-sm font-medium text-pulse-teal underline decoration-pulse-teal/40 underline-offset-2 hover:decoration-pulse-teal"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-2 py-3 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs font-medium text-gray-500">Domains</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {form.domains.length > 0
                          ? form.domains
                              .map(
                                (slug) =>
                                  domainOptions.find((d) => d.slug === slug)?.short_label ?? slug,
                              )
                              .join(", ")
                          : "—"}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(4)}
                      className="shrink-0 text-sm font-medium text-pulse-teal underline decoration-pulse-teal/40 underline-offset-2 hover:decoration-pulse-teal"
                    >
                      Edit
                    </button>
                  </div>
                </dl>
              </div>
              {apiError && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{apiError}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
                className="text-sm text-gray-600 transition-colors hover:text-pulse-teal"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}

            {step < 5 ? (
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

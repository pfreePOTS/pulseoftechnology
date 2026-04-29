"use client";

import { useState } from "react";

import { API_BASE } from "@/lib/api";
import { INDUSTRY_OPTIONS } from "@/lib/industryGrid";

/**
 * Contact form on `/contact`. Mirrors the field set the backend
 * `POST /api/contact` endpoint (`ContactRequest`) accepts. Three render
 * states:
 *   - "idle"     — empty/edit mode (default).
 *   - "loading"  — request in flight; submit button disabled + spinner.
 *   - "success"  — form replaced with a thank-you panel.
 *   - "error"    — inline banner above the submit button; user can retry.
 *
 * The hidden `website` honeypot field is intentionally label-less and
 * positioned off-screen via `tabIndex={-1}` and `autoComplete="off"` so a
 * real keyboard user can never reach it; bots that auto-fill every input
 * will trip it and the backend silently 200s on the submission.
 */

const ROLES = [
  "CEO / President / Owner",
  "COO",
  "CFO",
  "CIO / CTO",
  "CISO",
  "IT Manager / Director",
  "Operations",
  "Other / Not Sure",
] as const;

const INDUSTRY_DROPDOWN = [...INDUSTRY_OPTIONS, "Other"] as const;

type FormState = "idle" | "loading" | "success" | "error";

const inputClass =
  "w-full rounded-md border border-[#d4d4d4] bg-white px-3.5 py-2.5 font-sans text-[14.5px] text-[#111] outline-none transition-colors placeholder:text-[#999] focus:border-pulse-teal focus:ring-2 focus:ring-pulse-teal/30";
const labelClass = "mb-1.5 block font-sans text-[12px] font-semibold tracking-[0.3px] text-[#444]";

export default function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "loading") return;
    setErrorMessage("");
    setState("loading");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: message.trim(),
          phone: phone.trim() || undefined,
          industry: industry || undefined,
          role: role || undefined,
          website: website || undefined,
        }),
      });

      if (!res.ok) {
        // Pydantic 422 returns `{ detail: [{ msg, loc }, ...] }`.
        let detail = "Sorry — your message couldn't be sent. Please try again.";
        try {
          const body = await res.json();
          if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
            detail = String(body.detail[0].msg).replace(/^Value error,\s*/i, "");
          } else if (typeof body?.detail === "string") {
            detail = body.detail;
          }
        } catch {
          // Non-JSON response — keep the generic message.
        }
        setErrorMessage(detail);
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMessage("Network error — please check your connection and try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div
        className="rounded-xl border border-pulse-teal/30 bg-pulse-teal/5 px-7 py-10 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pulse-teal text-white">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mb-2 font-sans text-[20px] font-bold text-[#111]">
          Message received.
        </h3>
        <p className="mx-auto max-w-[420px] font-sans text-[15px] leading-relaxed text-[#555]">
          Thanks, {name.split(" ")[0] || "there"} — one of our advisors will reply within one
          business day. If it&rsquo;s urgent, the calendar on the left will get you on the books
          fastest.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Honeypot — visually hidden, tabIndex -1, autoComplete off. */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="contact-website">
          Leave this field empty
          <input
            id="contact-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClass}>
            Name <span className="text-pulse-red">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>
            Work email <span className="text-pulse-red">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-company" className={labelClass}>
            Company <span className="text-pulse-red">*</span>
          </label>
          <input
            id="contact-company"
            type="text"
            required
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className={labelClass}>
            Phone <span className="font-normal text-[#999]">(optional)</span>
          </label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-industry" className={labelClass}>
            Industry <span className="font-normal text-[#999]">(optional)</span>
          </label>
          <select
            id="contact-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {INDUSTRY_DROPDOWN.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contact-role" className={labelClass}>
            Your role <span className="font-normal text-[#999]">(optional)</span>
          </label>
          <select
            id="contact-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>
          How can we help? <span className="text-pulse-red">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what you're working on, what's on your mind, or what you'd like a sounding board on."
          className={`${inputClass} resize-y`}
        />
      </div>

      {state === "error" && errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-pulse-red/30 bg-pulse-red/5 px-3.5 py-2.5 font-sans text-[13.5px] text-pulse-red"
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-pulse-red px-6 py-3 font-sans text-[14.5px] font-semibold text-white transition-colors hover:bg-[#a81117] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {state === "loading" ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-white"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeWidth="3"
              />
              <path
                d="M21 12a9 9 0 0 1-9 9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Sending…
          </>
        ) : (
          <>Send message →</>
        )}
      </button>

      <p className="font-sans text-[12px] leading-relaxed text-[#777]">
        We reply within one business day. We never share your details and you can unsubscribe at
        any time.
      </p>
    </form>
  );
}

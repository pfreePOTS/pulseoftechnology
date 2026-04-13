"use client";

import { useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

/**
 * Sends a real email using watched + selected pipeline topics only (same cohort as the
 * scheduled newsletter and Radar Preview → Pipeline staging) — not “live site (published)” only.
 */
export default function NewsletterTestSendPanel() {
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendTestNewsletter() {
    const trimmed = testEmail.trim();
    if (!trimmed) {
      setError("Enter an email address to receive the test.");
      return;
    }
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/newsletter/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        detail?: unknown;
      };
      if (!res.ok) {
        let msg = `Request failed (HTTP ${res.status}).`;
        if (typeof body.detail === "string") {
          msg = body.detail;
        } else if (Array.isArray(body.detail) && body.detail[0] && typeof body.detail[0] === "object") {
          const first = body.detail[0] as { msg?: string };
          if (first.msg) msg = first.msg;
        }
        setError(msg);
        return;
      }
      setSuccess(body.message ?? "Test newsletter sent — check the inbox.");
    } catch {
      setError("Failed to send test newsletter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="newsletter-test-send"
      aria-labelledby="test-send-heading"
      className="mb-10 scroll-mt-8 rounded-xl border border-gray-800 bg-gray-900/40 p-5"
    >
      <h2
        id="test-send-heading"
        className="text-lg font-semibold text-white"
      >
        Send test newsletter
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        Delivers a <strong className="font-medium text-gray-300">real</strong> message to your inbox using the{" "}
        <strong className="text-indigo-300">pipeline</strong> cohort: topics in{" "}
        <strong className="text-gray-300">Watched</strong> or <strong className="text-gray-300">Selected</strong> (same as
        Radar Preview → <em>Pipeline staging</em> and the scheduled send). Topics that appear on the live site only
        because they are published, but are not in that pipeline, are <strong className="text-gray-300">not</strong>{" "}
        included. Does not broadcast to subscribers.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="sr-only" htmlFor="newsletter-test-email">
          Email for test newsletter
        </label>
        <input
          id="newsletter-test-email"
          type="email"
          autoComplete="email"
          placeholder="Email for test send"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          className="w-full min-w-[200px] flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C] sm:max-w-md"
        />
        <button
          type="button"
          onClick={() => void sendTestNewsletter()}
          disabled={busy || !testEmail.trim()}
          className="rounded-lg bg-[#E91D24] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c91820] disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send Test Newsletter"}
        </button>
      </div>
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}

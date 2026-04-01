"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type PipelineSettings = {
  trend_window_days: number;
  trend_prior_window_days: number;
  article_retention_days: number;
  article_archive_enabled: boolean;
  newsletter_article_lookback_days: number;
  newsletter_send_hour_utc: number;
  newsletter_send_minute_utc: number;
  newsletter_enabled: boolean;
  last_newsletter_sent_at: string | null;
};

const TREND_OPTIONS = [7, 14, 30, 60] as const;
const RETENTION_OPTIONS = [14, 30, 60, 90] as const;

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PipelineSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/settings`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PipelineSettings;
      setForm(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PipelineSettings;
      setForm(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-gray-400">
        {loading ? "Loading settings…" : "No data."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Pipeline settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Values override <code className="text-gray-500">.env</code> defaults and apply immediately where noted.
          Newsletter send time reschedule applies on save.
        </p>
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-8">
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Trend analysis
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-400">Primary window (days)</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                value={form.trend_window_days}
                onChange={(e) =>
                  setForm({ ...form, trend_window_days: Number(e.target.value) })
                }
              >
                {TREND_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">Prior comparison window (days)</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                value={form.trend_prior_window_days}
                onChange={(e) =>
                  setForm({ ...form, trend_prior_window_days: Number(e.target.value) })
                }
              >
                {TREND_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Article retention
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-400">Retention (days) before archive</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                value={form.article_retention_days}
                onChange={(e) =>
                  setForm({ ...form, article_retention_days: Number(e.target.value) })
                }
              >
                {RETENTION_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 pt-6 text-sm text-gray-300">
              <input
                type="checkbox"
                className="rounded border-gray-600"
                checked={form.article_archive_enabled}
                onChange={(e) =>
                  setForm({ ...form, article_archive_enabled: e.target.checked })
                }
              />
              Enable automatic archiving (daily job 05:00 UTC)
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Newsletter
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-400">Article lookback in email (days)</span>
              <input
                type="number"
                min={1}
                max={365}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                value={form.newsletter_article_lookback_days}
                onChange={(e) =>
                  setForm({ ...form, newsletter_article_lookback_days: Number(e.target.value) })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">Send time (UTC)</span>
              <div className="mt-1 flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-2 py-2 text-white"
                  value={form.newsletter_send_hour_utc}
                  onChange={(e) =>
                    setForm({ ...form, newsletter_send_hour_utc: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={59}
                  className="w-20 rounded-lg border border-gray-700 bg-gray-950 px-2 py-2 text-white"
                  value={form.newsletter_send_minute_utc}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      newsletter_send_minute_utc: Math.min(
                        59,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </div>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                className="rounded border-gray-600"
                checked={form.newsletter_enabled}
                onChange={(e) =>
                  setForm({ ...form, newsletter_enabled: e.target.checked })
                }
              />
              Automatic daily send (requires SendGrid)
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Last newsletter sent:{" "}
            <span className="text-gray-300">
              {form.last_newsletter_sent_at
                ? new Date(form.last_newsletter_sent_at).toLocaleString()
                : "—"}
            </span>
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

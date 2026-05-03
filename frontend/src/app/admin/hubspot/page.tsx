"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

const ACCENT = "#019E7C";

type JobState = "idle" | "busy" | "ok" | "err";

interface HubSpotStatus {
  api_key_configured: boolean;
  api_key_masked: string;
  newsletter_list_id_configured: boolean;
  hubspot_custom_properties_note: string[];
  batch_sync_enabled: boolean;
  batch_sync_hour_utc: number;
  batch_sync_minute_utc: number;
  scheduler_job_id: string;
  scheduler_next_run_utc: string | null;
}

interface HubSpotSyncLogRow {
  id: number;
  created_at: string;
  subscriber_id: number | null;
  email: string;
  source: string;
  operation: string;
  success: boolean;
  hubspot_contact_id: string | null;
  payload: Record<string, string> | null;
  error_message: string | null;
}

interface HubSpotLogsResponse {
  total: number;
  logs: HubSpotSyncLogRow[];
}

export default function AdminHubSpotPage() {
  const [status, setStatus] = useState<HubSpotStatus | null>(null);
  const [logs, setLogs] = useState<HubSpotSyncLogRow[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [logsErr, setLogsErr] = useState<string | null>(null);
  const [testState, setTestState] = useState<JobState>("idle");
  const [reconcileState, setReconcileState] = useState<JobState>("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusErr(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/hubspot/status`);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as HubSpotStatus;
      setStatus(data);
    } catch (e) {
      setStatusErr(e instanceof Error ? e.message : "Unable to load status");
      setStatus(null);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsErr(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/hubspot/logs?limit=80&offset=0`);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as HubSpotLogsResponse;
      setLogs(data.logs);
      setTotalLogs(data.total);
    } catch (e) {
      setLogsErr(e instanceof Error ? e.message : "Unable to load sync log");
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadLogs();
  }, [loadStatus, loadLogs]);

  async function runTest() {
    setTestState("busy");
    setTestMsg(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/hubspot/test-connection`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { ok: boolean; error: string | null };
      setTestMsg(j.ok ? "HubSpot replied successfully over the Contacts API." : j.error ?? "Failed");
      setTestState(j.ok ? "ok" : "err");
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Request failed");
      setTestState("err");
    }
    setTimeout(() => setTestState("idle"), 4000);
  }

  async function runReconcile() {
    setReconcileState("busy");
    setToast(null);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/hubspot/reconcile`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { message?: string };
      setToast(j.message ?? "Queued.");
      setReconcileState("ok");
      setTimeout(() => {
        void loadLogs();
      }, 4000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed");
      setReconcileState("err");
    }
    setTimeout(() => setReconcileState("idle"), 3500);
  }

  function btnClass(state: JobState) {
    const base =
      "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ";
    if (state === "busy") return base + "bg-gray-700 text-white";
    if (state === "ok") return base + "bg-green-700 text-white";
    if (state === "err") return base + "bg-red-700 text-white";
    return (
      base +
      "border border-gray-700 bg-gray-800 text-white hover:border-teal-600/70 hover:bg-gray-[#1f2937]"
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl pb-24">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">HubSpot</h1>
          <p className="mt-1 text-sm text-gray-400">
            Connection status, APScheduler reconcile window, Contacts properties we send, and a full audit log of pushes.
          </p>
        </header>

        {statusErr && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">{statusErr}</p>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Connection</h2>
            {status && (
              <dl className="mt-4 space-y-2 text-sm text-gray-300">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Private app token</dt>
                  <dd className="font-mono text-right text-gray-200">{status.api_key_masked}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Newsletter list (<code className="text-[11px] text-gray-500">HUBSPOT_NEWSLETTER_LIST_ID</code>)
                  </dt>
                  <dd className="text-right">
                    <span style={{ color: status.newsletter_list_id_configured ? ACCENT : "#b91c1c" }}>
                      {status.newsletter_list_id_configured ? "Configured" : "Not set"}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-gray-800 pt-3">
                  <dt className="text-gray-500">Nightly reconcile (APScheduler)</dt>
                  <dd className="text-right">
                    {status.batch_sync_enabled ? (
                      <span style={{ color: ACCENT }}>
                        {String(status.batch_sync_hour_utc).padStart(2, "0")}:
                        {String(status.batch_sync_minute_utc).padStart(2, "0")} UTC
                      </span>
                    ) : (
                      <span className="text-amber-300">
                        Disabled (set <code className="text-gray-600">HUBSPOT_BATCH_SYNC_ENABLED=false</code> in env)
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Next job run (<code className="text-[11px] text-gray-500">{status.scheduler_job_id}</code>)
                  </dt>
                  <dd className="max-w-[16rem] break-all font-mono text-right text-xs text-gray-400">
                    {status.scheduler_next_run_utc ?? "— (restart API after setting PAT, or scheduler not mounted in tests)"}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Actions</h2>
            <p className="mt-2 text-xs text-gray-500">
              &quot;Test&quot; verifies your PAT can authenticate to the Contacts search API.&nbsp;
              Reconcile replays{" "}
              <strong className="text-gray-400">every subscriber row</strong> like the nightly job (background task).
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button type="button" className={btnClass(testState)} onClick={() => void runTest()} disabled={testState === "busy"}>
                {testState === "busy" && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {testState === "idle"
                  ? "Test HubSpot connectivity"
                  : testState === "busy"
                    ? "Testing…"
                    : testState === "ok"
                      ? "Success"
                      : "Failed"}
              </button>
              {testMsg && (
                <p className={`text-xs ${testMsg.includes("Failed") ? "text-red-300" : "text-green-400"}`}>{testMsg}</p>
              )}
              <button
                type="button"
                className={btnClass(reconcileState)}
                onClick={() => void runReconcile()}
                disabled={reconcileState === "busy"}
                style={{
                  borderColor: reconcileState === "idle" ? ACCENT + "66" : undefined,
                }}
              >
                {reconcileState === "busy" && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Reconcile subscribers now
              </button>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Fields sent per contact upsert</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-400">
            {(status?.hubspot_custom_properties_note ?? []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-600">
            Real-time pushes also fire after public signup/preferences and after admin edits on&nbsp;
            <Link href="/admin/subscribers" className="underline" style={{ color: ACCENT }}>
              Subscribers
            </Link>
            . Tune cadence via env:&nbsp;<code className="text-gray-500">HUBSPOT_BATCH_*</code> — see{" "}
            <Link href="/admin/jobs" className="underline" style={{ color: ACCENT }}>
              System Jobs
            </Link>
            .
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-0 overflow-hidden">
          <header className="border-b border-gray-800 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Sync log</h2>
            <p className="mt-1 text-xs text-gray-500">
              One row per API attempt ({totalLogs} rows total). Payload shows the CRM property bag we passed to HubSpot.
            </p>
          </header>
          {logsErr && (
            <p className="px-5 py-3 text-sm text-red-300">{logsErr}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2">When (UTC)</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Operation</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">CRM id</th>
                  <th className="min-w-[12rem] px-4 py-2">Payload</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !logsErr && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      No pushes recorded yet.&nbsp;
                      {!status?.api_key_configured && (
                        <>
                          Set <code className="text-gray-500">HUBSPOT_API_KEY</code> then save a subscriber or run
                          Reconcile.
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {logs.map((row) => (
                  <tr key={row.id} className="border-t border-gray-800/90">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="break-all px-4 py-2 text-xs">{row.email}</td>
                    <td className="px-4 py-2">
                      <span
                        style={{ color: row.success ? ACCENT : "#f87171" }}
                        className="font-semibold capitalize"
                      >
                        {row.operation.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs capitalize text-gray-400">{row.source.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.hubspot_contact_id ?? "—"}</td>
                    <td className="max-w-xl px-4 py-2 align-top">
                      {row.payload ? (
                        <pre className="max-h-32 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-gray-400">
                          {JSON.stringify(row.payload, null, 2)}
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[14rem] break-words px-4 py-2 text-xs text-amber-200/90">{row.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="border-t border-gray-800 px-5 py-3">
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="text-xs font-semibold underline decoration-gray-600 hover:decoration-gray-400"
              style={{ color: ACCENT }}
            >
              Refresh log
            </button>
          </footer>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 shadow-lg">
          {toast}
          <button type="button" className="ml-3 text-gray-500 underline" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

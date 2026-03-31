"use client";

import { useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type JobState = "idle" | "running" | "success" | "error";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastSeq = 0;

export default function JobsPage() {
  const [ingestState, setIngestState] = useState<JobState>("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(type: "success" | "error", message: string) {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  async function runJob(
    endpoint: string,
    setState: (s: JobState) => void,
    label: string,
  ) {
    setState("running");
    try {
      const res = await adminFetch(`${API_BASE}${endpoint}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const { message } = await res.json();
      setState("success");
      addToast("success", message);
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setState("error");
      addToast("error", err instanceof Error ? err.message : `${label} failed`);
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const JOBS = [
    {
      title: "Run RSS Ingestion Now",
      description:
        "Fetches the latest articles from all active RSS sources and runs them through the AI pipeline for scoring and topic clustering.",
      endpoint: "/api/admin/jobs/ingest",
      state: ingestState,
      setState: setIngestState,
      icon: "⬇",
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            System Jobs
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Trigger scheduled jobs manually for testing or off-cycle runs.
          </p>
        </header>

        <p className="mb-6 text-sm text-gray-500">
          Use this when you want to send the digest outside the schedule. Newsletter modeling lives under Workbench →
          Newsletter preview or the Newsletter preview sidebar link.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {JOBS.map(({ title, description, endpoint, state, setState, icon }) => (
            <div
              key={endpoint}
              className="flex flex-col rounded-xl border border-gray-800 bg-gray-900 p-6"
            >
              <div className="mb-4 text-2xl">{icon}</div>
              <h2 className="mb-2 text-base font-semibold text-white">{title}</h2>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-gray-400">
                {description}
              </p>
              <button
                onClick={() => runJob(endpoint, setState, title)}
                disabled={state === "running"}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  state === "success"
                    ? "bg-green-600 text-white"
                    : state === "error"
                      ? "bg-red-600 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                }`}
              >
                {state === "running" && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {state === "running"
                  ? "Starting…"
                  : state === "success"
                    ? "Started"
                    : state === "error"
                      ? "Failed"
                      : "Run Now"}
              </button>
            </div>
          ))}
        </div>

        {/* Scheduler info */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Scheduled Runs
          </h2>
          <ul className="space-y-1 text-sm text-gray-500">
            <li>RSS Ingestion — every hour (automatic)</li>
            <li>Daily Newsletter — 07:00 UTC daily (automatic)</li>
          </ul>
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}

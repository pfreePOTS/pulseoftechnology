"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeader(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("pulse_admin_token") ?? "")
      : "";
  return { Authorization: `Bearer ${token}` };
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export default function NewsletterPreviewPage() {
  const [html, setHtml] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadPreview = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`${API_BASE}/api/admin/newsletter/preview`, {
        headers: authHeader(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawHtml = await res.text();
      setHtml(rawHtml);
      setLastRefreshed(new Date());
      setState("loaded");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return (
    <div className="flex flex-col h-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl flex flex-col flex-1">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Newsletter Preview
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Rendered for a dummy subscriber: Jane Executive · Technology ·
              AI, Security, Cloud
            </p>
            {lastRefreshed && (
              <p className="mt-0.5 text-xs text-gray-600">
                Last refreshed{" "}
                {lastRefreshed.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <button
            onClick={loadPreview}
            disabled={state === "loading"}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {state === "loading" && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {state === "loading" ? "Loading…" : "Refresh Preview"}
          </button>
        </div>

        {/* Content area */}
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
                onClick={loadPreview}
                className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
              >
                Try again
              </button>
            </div>
          </div>
        ) : state === "loading" && !html ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-sm text-gray-500">Loading preview…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden rounded-xl border border-gray-800 shadow-xl"
               style={{ minHeight: "600px" }}>
            <iframe
              srcDoc={html}
              title="Newsletter Preview"
              className="h-full w-full"
              style={{ minHeight: "600px", border: "none" }}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}

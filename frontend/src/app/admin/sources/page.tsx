"use client";

import { useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Source {
  id: number;
  name: string;
  url: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadSources() {
    const res = await adminFetch(`${API_BASE}/api/admin/sources`);
    if (res.ok) setSources(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function toggleActive(source: Source) {
    await adminFetch(`${API_BASE}/api/admin/sources/${source.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: !source.is_active }),
    });
    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id ? { ...s, is_active: !s.is_active } : s,
      ),
    );
  }

  async function deleteSource(id: number) {
    if (!confirm("Delete this source? This cannot be undone.")) return;
    await adminFetch(`${API_BASE}/api/admin/sources/${id}`, {
      method: "DELETE",
    });
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setFormError("");
    const res = await adminFetch(`${API_BASE}/api/admin/sources`, {
      method: "POST",
      body: JSON.stringify({ name: newName, url: newUrl, type: "rss" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: "Failed to add source" }));
      setFormError(body.detail ?? "Failed to add source");
    } else {
      const created: Source = await res.json();
      setSources((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewUrl("");
      setShowForm(false);
    }
    setAdding(false);
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Manage Sources
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              RSS feeds the ingestion engine pulls from.
            </p>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            {showForm ? "Cancel" : "+ New Source"}
          </button>
        </div>

        {/* Add-source form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mb-6 rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              New RSS Source
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. Wired Tech"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Feed URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                  placeholder="https://example.com/feed"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add Source"}
            </button>
          </form>
        )}

        {/* Sources table */}
        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Loading sources…</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">No sources yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Run the seed script or add a source above.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-400">URL</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-400">
                    Active
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className={`transition-colors hover:bg-gray-800/40 ${
                      source.is_active ? "" : "opacity-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {source.name}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate block text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        {source.url}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                        {source.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleActive(source)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          source.is_active ? "bg-indigo-600" : "bg-gray-700"
                        }`}
                        title={source.is_active ? "Deactivate" : "Activate"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            source.is_active ? "translate-x-4" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="text-xs text-gray-600 transition-colors hover:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600">
          {sources.length} source{sources.length !== 1 ? "s" : ""} total ·{" "}
          {sources.filter((s) => s.is_active).length} active
        </p>
      </div>
    </div>
  );
}

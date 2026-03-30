"use client";

import { useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Subscriber {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  industry: string | null;
  domains: string[] | null;
  is_active: boolean;
  created_at: string;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminFetch(`${API_BASE}/api/admin/subscribers`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubscribers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.industry ?? "").toLowerCase().includes(q) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q),
    );
  }, [subscribers, query]);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Subscribers
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {subscribers.length} total ·{" "}
              {subscribers.filter((s) => s.is_active).length} active
            </p>
          </div>
          <input
            type="search"
            placeholder="Search by name, email, or industry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none sm:w-72"
          />
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Loading subscribers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">
              {subscribers.length === 0 ? "No subscribers yet" : "No matches"}
            </p>
            {query && (
              <p className="mt-1 text-sm text-gray-500">
                Try a different search term.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Industry</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Domains</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                    Join Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="transition-colors hover:bg-gray-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      {sub.first_name} {sub.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{sub.email}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {sub.industry ?? (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.domains && sub.domains.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.domains.map((d) => (
                            <span
                              key={d}
                              className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/25"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.is_active ? (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/25">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-500/25">
                          Unsubscribed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(sub.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

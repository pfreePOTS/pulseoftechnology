"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";
import { useDomains } from "@/lib/useDomains";

/** Match public subscribe wizard — domain filters + newsletter assembly. */
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

interface Subscriber {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  industries: string[] | null;
  domains: string[] | null;
  role_ids: number[] | null;
  is_active: boolean;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
}

type SubscriberForm = {
  email: string;
  first_name: string;
  last_name: string;
  industries: string[];
  role_ids: number[];
  domains: string[];
  is_active: boolean;
};

const emptyForm = (): SubscriberForm => ({
  email: "",
  first_name: "",
  last_name: "",
  industries: [],
  role_ids: [],
  domains: [],
  is_active: true,
});

function subscriberToForm(s: Subscriber): SubscriberForm {
  return {
    email: s.email,
    first_name: s.first_name,
    last_name: s.last_name,
    industries: s.industries ? [...s.industries] : [],
    role_ids: s.role_ids ? [...s.role_ids] : [],
    domains: s.domains ? [...s.domains] : [],
    is_active: s.is_active,
  };
}

function parseApiError(res: Response, fallback: string): Promise<string> {
  return res.text().then((t) => {
    try {
      const j = JSON.parse(t) as { detail?: unknown };
      if (typeof j.detail === "string") return j.detail;
      if (Array.isArray(j.detail)) {
        const first = j.detail[0] as { msg?: string } | undefined;
        if (first?.msg) return first.msg;
      }
    } catch {
      /* ignore */
    }
    return t || fallback;
  });
}

function roleNames(roles: Role[], roleIds: number[] | null): string {
  if (!roleIds || roleIds.length === 0) return "—";
  const names = roleIds
    .map((id) => roles.find((r) => r.id === id)?.name)
    .filter(Boolean) as string[];
  return names.length > 0 ? names.join(", ") : "—";
}

function downloadSubscribersCsv(rows: Subscriber[], roles: Role[]) {
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = [
    "id",
    "email",
    "first_name",
    "last_name",
    "industries",
    "domains",
    "roles",
    "is_active",
    "created_at",
  ];
  const lines = rows.map((s) =>
    [
      s.id,
      esc(s.email),
      esc(s.first_name),
      esc(s.last_name),
      esc((s.industries ?? []).join("; ")),
      esc((s.domains ?? []).join("; ")),
      esc(roleNames(roles, s.role_ids) === "—" ? "" : roleNames(roles, s.role_ids)),
      s.is_active ? "true" : "false",
      esc(s.created_at),
    ].join(","),
  );
  const csv = "\ufeff" + [header.join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SubscribersPage() {
  const { domains: domainOptions } = useDomains();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /** add | edit (editId set) | null */
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SubscriberForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [viewSub, setViewSub] = useState<Subscriber | null>(null);

  const load = useCallback(async () => {
    const [subRes, roleRes] = await Promise.all([
      adminFetch(`${API_BASE}/api/admin/subscribers`),
      adminFetch(`${API_BASE}/api/admin/roles`),
    ]);
    if (subRes.ok) setSubscribers(await subRes.json());
    if (roleRes.ok) setRoles(await roleRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm(emptyForm());
    setFormError(null);
    setEditId(null);
    setDialog("add");
  }

  function openEdit(sub: Subscriber) {
    setForm(subscriberToForm(sub));
    setFormError(null);
    setEditId(sub.id);
    setDialog("edit");
    setViewSub(null);
  }

  function closeDialog() {
    if (formSubmitting) return;
    setDialog(null);
    setEditId(null);
  }

  function openView(sub: Subscriber) {
    setViewSub(sub);
  }

  function closeView() {
    setViewSub(null);
  }

  function toggleDomain(value: string) {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(value)
        ? prev.domains.filter((d) => d !== value)
        : [...prev.domains, value],
    }));
  }

  function toggleIndustry(ind: string) {
    setForm((prev) => ({
      ...prev,
      industries: prev.industries.includes(ind)
        ? prev.industries.filter((x) => x !== ind)
        : [...prev.industries, ind],
    }));
  }

  function toggleRoleId(id: number) {
    setForm((prev) => ({
      ...prev,
      role_ids: prev.role_ids.includes(id)
        ? prev.role_ids.filter((x) => x !== id)
        : [...prev.role_ids, id],
    }));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (form.role_ids.length === 0 || form.industries.length === 0 || form.domains.length === 0) {
      setFormError("Select at least one title, one industry, and one topic domain.");
      return;
    }
    setFormSubmitting(true);
    try {
      const body = {
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        industries: form.industries,
        domains: form.domains,
        role_ids: form.role_ids,
        is_active: form.is_active,
      };
      if (dialog === "add") {
        const r = await adminFetch(`${API_BASE}/api/admin/subscribers`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          setFormError(await parseApiError(r, "Could not create subscriber"));
          return;
        }
      } else if (dialog === "edit" && editId !== null) {
        const r = await adminFetch(`${API_BASE}/api/admin/subscribers/${editId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          setFormError(await parseApiError(r, "Could not save subscriber"));
          return;
        }
      }
      setDialog(null);
      setEditId(null);
      setForm(emptyForm());
      await load();
    } catch {
      setFormError("Request failed");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(sub: Subscriber) {
    if (
      !window.confirm(
        `Remove subscriber ${sub.email}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(sub.id);
    try {
      const r = await adminFetch(`${API_BASE}/api/admin/subscribers/${sub.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        window.alert(await parseApiError(r, "Delete failed"));
        return;
      }
      setViewSub(null);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.industries ?? []).some((i) => i.toLowerCase().includes(q)) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q),
    );
  }, [subscribers, query]);

  const exportRows = query.trim() ? filtered : subscribers;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Subscribers</h1>
          <p className="mt-1 text-sm text-gray-400">
            {subscribers.length} total · {subscribers.filter((s) => s.is_active).length} active
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => downloadSubscribersCsv(exportRows, roles)}
            disabled={subscribers.length === 0}
            title={
              query.trim()
                ? "Download CSV of filtered rows"
                : "Download CSV of all subscribers"
            }
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-[#019E7C] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
          >
            Add subscriber
          </button>
          <input
            type="search"
            placeholder="Search by name, email, or industry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none sm:w-72"
          />
        </div>
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
          {query ? (
            <p className="mt-1 text-sm text-gray-500">Try a different search term.</p>
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 rounded-lg bg-[#019E7C] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Add your first subscriber
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-400">Role</th>
                <th className="px-4 py-3 font-medium text-gray-400">Industry</th>
                <th className="px-4 py-3 font-medium text-gray-400">Domains</th>
                <th className="px-4 py-3 font-medium text-gray-400">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-400">Join Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((sub) => (
                <tr key={sub.id} className="transition-colors hover:bg-gray-800/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                    {sub.first_name} {sub.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{sub.email}</td>
                  <td
                    className="max-w-[200px] truncate px-4 py-3 text-gray-400"
                    title={roleNames(roles, sub.role_ids)}
                  >
                    {roleNames(roles, sub.role_ids)}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-gray-400">
                    {sub.industries && sub.industries.length > 0 ? (
                      sub.industries.join(", ")
                    ) : (
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
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {new Date(sub.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openView(sub)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(sub)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-500/15"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === sub.id}
                        onClick={() => void handleDelete(sub)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        {deletingId === sub.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {dialog !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscriber-form-title"
          onClick={closeDialog}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 id="subscriber-form-title" className="text-lg font-semibold text-white">
                {dialog === "add" ? "Add subscriber" : "Edit subscriber"}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Same fields as the public signup — used for newsletter matching and HubSpot sync.
              </p>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-4">
              {formError && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {formError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-400">
                  First name *
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-400">
                  Last name *
                  <input
                    required
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-400">
                Email *
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
              </label>
              <div>
                <span className="text-xs font-medium text-gray-400">Industry * (multi)</span>
                <p className="mb-2 mt-0.5 text-[11px] text-gray-600">
                  Select at least one sector; used for radar copy and HubSpot.
                </p>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((ind) => {
                    const on = form.industries.includes(ind);
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => toggleIndustry(ind)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-[#019E7C]/25 text-[#019E7C] ring-[#019E7C]/50"
                            : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                        }`}
                      >
                        {ind}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400">Job title / role * (multi)</span>
                <p className="mb-2 mt-0.5 text-[11px] text-gray-600">
                  Select at least one title. Roles personalize context, not topic selection.
                </p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const on = form.role_ids.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRoleId(r.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-indigo-500/25 text-indigo-300 ring-indigo-500/50"
                            : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400">Domains of interest *</span>
                <p className="mb-2 mt-0.5 text-[11px] text-gray-600">
                  Select at least one topic domain for newsletter matching.
                </p>
                <div className="flex flex-wrap gap-2">
                  {domainOptions.map((d) => {
                    const on = form.domains.includes(d.slug);
                    return (
                      <button
                        key={d.slug}
                        type="button"
                        onClick={() => toggleDomain(d.slug)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          on
                            ? "bg-[#019E7C]/25 text-[#019E7C] ring-[#019E7C]/50"
                            : "bg-gray-800 text-gray-400 ring-gray-700 hover:bg-gray-700/50"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-[#019E7C] focus:ring-[#019E7C]/40"
                />
                Active (receives mail when newsletter is enabled)
              </label>
              <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={formSubmitting}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-[#019E7C] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {formSubmitting ? "Saving…" : dialog === "add" ? "Create subscriber" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscriber-view-title"
          onClick={closeView}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 id="subscriber-view-title" className="text-lg font-semibold text-white">
                Subscriber
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Name</span>
                <p className="mt-0.5 text-white">
                  {viewSub.first_name} {viewSub.last_name}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
                <p className="mt-0.5 text-gray-300">{viewSub.email}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Role</span>
                <p className="mt-0.5 text-gray-300">{roleNames(roles, viewSub.role_ids)}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Industry</span>
                <p className="mt-0.5 text-gray-300">
                  {viewSub.industries && viewSub.industries.length > 0
                    ? viewSub.industries.join(", ")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Domains</span>
                <p className="mt-0.5 text-gray-300">
                  {viewSub.domains && viewSub.domains.length > 0
                    ? viewSub.domains.join(", ")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</span>
                <p className="mt-0.5">
                  {viewSub.is_active ? (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/25">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-500/25">
                      Unsubscribed
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Join date</span>
                <p className="mt-0.5 text-gray-400">
                  {new Date(viewSub.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-800 px-5 py-4">
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = viewSub;
                  closeView();
                  openEdit(s);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={deletingId === viewSub.id}
                onClick={() => void handleDelete(viewSub)}
                className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { INVITABLE_NAV } from "@/lib/admin-nav";
import { adminFetch, adminResponseErrorDetail, API_BASE } from "@/lib/api";

type AdminUserRow = {
  id: number;
  email: string;
  is_superuser?: boolean;
  is_active: boolean;
  must_change_password: boolean;
  page_permissions: string[];
};

const actionBtn =
  "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#019E7C]/60";

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePages, setInvitePages] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const n of INVITABLE_NAV) o[n.href] = false;
    return o;
  });
  const [inviteIsSuperuser, setInviteIsSuperuser] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editPages, setEditPages] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/me`);
      if (!res.ok) return;
      const d = (await res.json()) as { id: number };
      setMeId(d.id);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users`);
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as AdminUserRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMe();
  }, [load, loadMe]);

  useEffect(() => {
    if (!editingUser) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingUser(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingUser]);

  function openEdit(u: AdminUserRow) {
    const next: Record<string, boolean> = {};
    for (const n of INVITABLE_NAV) {
      next[n.href] = (u.page_permissions || []).includes(n.slug);
    }
    setEditPages(next);
    setEditingUser(u);
  }

  async function saveEdit() {
    if (!editingUser) return;
    const page_permissions = Array.from(
      new Set(INVITABLE_NAV.filter((n) => editPages[n.href]).map((n) => n.slug)),
    );
    if (page_permissions.length === 0) {
      alert("Select at least one page for this user.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_permissions }),
      });
      if (!res.ok) {
        alert(await adminResponseErrorDetail(res));
        return;
      }
      setEditingUser(null);
      await load();
    } catch {
      alert("Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  function togglePageByHref(href: string) {
    setInvitePages((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMessage(null);
    const page_permissions = Array.from(
      new Set(
        INVITABLE_NAV.filter((n) => invitePages[n.href]).map((n) => n.slug),
      ),
    );
    if (!inviteIsSuperuser && page_permissions.length === 0) {
      setInviteMessage("Select at least one page for this user.");
      return;
    }
    setInviting(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          page_permissions: inviteIsSuperuser ? [] : page_permissions,
          is_superuser: inviteIsSuperuser,
          send_email: sendEmail,
        }),
      });
      const data = (await res.json()) as {
        detail?: string;
        temporary_password?: string;
        email_sent?: boolean;
      };
      if (!res.ok) {
        setInviteMessage(typeof data.detail === "string" ? data.detail : "Invite failed");
        return;
      }
      const parts = [
        `Created ${inviteIsSuperuser ? "admin" : "login"} for ${inviteEmail.trim()}.`,
        data.email_sent
          ? "Invitation email was sent."
          : "Email was not sent (SendGrid may be unset or failed).",
        `Temporary password: ${data.temporary_password}`,
      ];
      setInviteMessage(parts.join(" "));
      setInviteEmail("");
      setInvitePages((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = false;
        return next;
      });
      setInviteIsSuperuser(false);
      await load();
    } catch {
      setInviteMessage("Invite request failed.");
    } finally {
      setInviting(false);
    }
  }

  async function resetPassword(id: number) {
    if (!confirm("Generate a new temporary password for this user? They must change it on next login.")) return;
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/${id}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      const data = (await res.json()) as { temporary_password?: string };
      alert(`Temporary password: ${data.temporary_password ?? "(unknown)"}`);
      await load();
    } catch {
      alert("Reset failed.");
    }
  }

  async function setActive(id: number, is_active: boolean) {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await load();
    } catch {
      alert("Update failed.");
    }
  }

  async function makeAdmin(id: number, email: string) {
    if (!confirm(`Make ${email} an Admin? Admins get access to every admin area all the time.`)) return;
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_superuser: true }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await load();
    } catch {
      alert("Update failed.");
    }
  }

  async function removeUser(id: number, email: string, is_superuser: boolean) {
    if (is_superuser) return;
    if (!confirm(`Delete admin user ${email}? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await load();
    } catch {
      alert("Delete failed.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl text-gray-400">
        Loading users…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-gray-400">
          Invite users by email with a temporary password. Choose which admin areas they can access.
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

      <section className="mb-10 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
          Invite user
        </h2>
        <form onSubmit={(e) => void invite(e)} className="space-y-4">
          <label className="block max-w-md text-sm">
            <span className="text-gray-400">Email</span>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
              placeholder="colleague@company.com"
            />
          </label>
          <fieldset>
            <legend className="text-sm text-gray-400 mb-2">Pages they can access</legend>
            <label className="mb-3 flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={inviteIsSuperuser}
                onChange={(e) => setInviteIsSuperuser(e.target.checked)}
                className="mt-1 rounded border-gray-600"
              />
              <span>
                <span className="block font-semibold text-teal-300">Admin</span>
                <span className="text-gray-400">
                  Access to every admin page now and in the future, including Users and Settings.
                </span>
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {INVITABLE_NAV.map((n) => (
                <label
                  key={n.href}
                  className={`flex items-center gap-2 text-sm ${
                    inviteIsSuperuser ? "text-gray-600" : "text-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={invitePages[n.href] ?? false}
                    disabled={inviteIsSuperuser}
                    onChange={() => togglePageByHref(n.href)}
                    className="rounded border-gray-600"
                  />
                  {n.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-600"
            />
            Send invitation email (requires SendGrid)
          </label>
          {inviteMessage && (
            <p className="text-sm text-amber-200/90" role="status">
              {inviteMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={inviting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#019E7C" }}
          >
            {inviting ? "Sending…" : "Invite user"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-800 overflow-hidden">
        <h2 className="px-5 py-3 text-sm font-semibold uppercase tracking-widest text-gray-400 border-b border-gray-800 bg-gray-900/50">
          Accounts
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((u) => {
                const isSuperuser = Boolean(u.is_superuser);
                return (
                <tr key={u.id} className="text-gray-200">
                  <td className="px-4 py-3 font-mono text-xs sm:text-sm">{u.email}</td>
                  <td className="px-4 py-3">{isSuperuser ? "Superuser" : "User"}</td>
                  <td className="px-4 py-3 max-w-xs text-xs text-gray-400">
                    {isSuperuser
                      ? "All pages"
                      : (u.page_permissions || []).length
                        ? (u.page_permissions || []).join(", ")
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.must_change_password ? (
                      <span className="text-amber-400">Must change password</span>
                    ) : u.is_active ? (
                      <span className="text-gray-400">Active</span>
                    ) : (
                      <span className="text-red-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isSuperuser && (
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className={`${actionBtn} border-[#019E7C]/45 bg-[#019E7C]/10 text-[#019E7C] hover:bg-[#019E7C]/18`}
                        >
                          Edit pages
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void resetPassword(u.id)}
                        className={`${actionBtn} border-[#019E7C]/45 bg-[#019E7C]/10 text-[#019E7C] hover:bg-[#019E7C]/18`}
                      >
                        Reset password
                      </button>
                      {!isSuperuser && (
                        <>
                          <button
                            type="button"
                            onClick={() => void setActive(u.id, !u.is_active)}
                            className={`${actionBtn} border-gray-600 bg-gray-800/50 text-gray-200 hover:bg-gray-800`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void makeAdmin(u.id, u.email)}
                            className={`${actionBtn} border-teal-500/35 bg-teal-950/40 text-teal-200 hover:bg-teal-950/70`}
                          >
                            Make admin
                          </button>
                          {meId !== null && u.id !== meId && (
                            <button
                              type="button"
                              onClick={() => void removeUser(u.id, u.email, isSuperuser)}
                              className={`${actionBtn} border-red-500/40 bg-red-950/25 text-red-300 hover:bg-red-950/45`}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {isSuperuser && (
                      <p className="mt-2 max-w-[260px] text-[10px] leading-snug text-gray-500 ml-auto text-right">
                        Superuser: use <strong className="text-gray-400">Reset password</strong> if locked out.
                        Page access is fixed for this role.
                      </p>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-user-title" className="text-lg font-semibold text-white">
              Edit pages
            </h2>
            <p className="mt-1 text-sm text-gray-400 font-mono break-all">{editingUser.email}</p>
            <p className="mt-2 text-xs text-gray-500">
              Choose which admin areas this user can open. Users and Settings stay superuser-only.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {INVITABLE_NAV.map((n) => (
                <label key={n.href} className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editPages[n.href] ?? false}
                    onChange={() =>
                      setEditPages((prev) => ({ ...prev, [n.href]: !prev[n.href] }))
                    }
                    className="rounded border-gray-600"
                  />
                  {n.label}
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void saveEdit()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#019E7C" }}
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

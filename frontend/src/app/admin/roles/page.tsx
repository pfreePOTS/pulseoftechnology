"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeader(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("pulse_admin_token") ?? "")
      : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface Role {
  id: number;
  name: string;
  tags: string[] | null;
}

const DOMAIN_OPTIONS = ["AI", "Security", "Cloud", "Finance", "Leadership", "Other"];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function fetchRoles() {
    const r = await fetch(`${API_BASE}/api/admin/roles`, { headers: authHeader() });
    if (r.ok) setRoles(await r.json());
    setLoading(false);
  }

  useEffect(() => { fetchRoles(); }, []);

  function toggleTag(tag: string, current: string[], set: (v: string[]) => void) {
    set(current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    const r = await fetch(`${API_BASE}/api/admin/roles`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ name: newName.trim(), tags: newTags.length ? newTags : null }),
    });
    if (r.ok) {
      setNewName("");
      setNewTags([]);
      await fetchRoles();
    } else {
      const data = await r.json().catch(() => ({}));
      setCreateError(data.detail ?? "Failed to create role");
    }
    setCreating(false);
  }

  async function handleSave(id: number) {
    setSaving(true);
    const r = await fetch(`${API_BASE}/api/admin/roles/${id}`, {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({ name: editName.trim(), tags: editTags.length ? editTags : null }),
    });
    if (r.ok) {
      setEditingId(null);
      await fetchRoles();
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this role? Subscribers assigned to it will be unassigned.")) return;
    await fetch(`${API_BASE}/api/admin/roles/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    await fetchRoles();
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditName(role.name);
    setEditTags(role.tags ?? []);
  }

  return (
    <div className="px-6 pt-8 pb-12 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-white">Role Profiles</h1>
      <p className="mt-1 mb-8 text-sm text-gray-400">
        Define C-level personas (CEO, CTO, CFO…) with domain tags. Subscribers assigned a role
        receive article summaries matched to those tags.
      </p>

      {/* ── Create form ── */}
      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-xl border border-gray-700 bg-gray-900 p-5"
      >
        <h2 className="mb-4 text-sm font-semibold text-gray-300 uppercase tracking-wide">
          New Role
        </h2>
        <div className="mb-4">
          <label className="block mb-1 text-xs font-medium text-gray-400">Role Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. CTO, CFO, CISO"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-2 text-xs font-medium text-gray-400">Content Tags</label>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag, newTags, setNewTags)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  newTags.includes(tag)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        {createError && <p className="mb-3 text-xs text-red-400">{createError}</p>}
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create Role"}
        </button>
      </form>

      {/* ── Role list ── */}
      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-gray-500">No roles yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) =>
            editingId === role.id ? (
              <div key={role.id} className="rounded-xl border border-indigo-500/40 bg-gray-900 p-5">
                <div className="mb-3">
                  <label className="block mb-1 text-xs font-medium text-gray-400">Role Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block mb-2 text-xs font-medium text-gray-400">Content Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAIN_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag, editTags, setEditTags)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          editTags.includes(tag)
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(role.id)}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={role.id}
                className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-white">{role.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {role.tags && role.tags.length > 0 ? (
                      role.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-600">No tags</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(role)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-gray-800 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

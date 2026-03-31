"use client";

import { useEffect, useRef, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

interface Role {
  id: number;
  name: string;
  tags: string[] | null;
}

// ── Tag chip input ────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const value = raw.trim().replace(/,+$/, "").trim();
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...tags, value]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input);
  }

  return (
    <div
      className="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-500/25 px-2 py-0.5 text-xs font-medium text-indigo-300"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="leading-none text-indigo-400 hover:text-white"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? "Type a tag and press Enter or ," : ""}
        className="min-w-[8rem] flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    const r = await adminFetch(`${API_BASE}/api/admin/roles`);
    if (r.ok) setRoles(await r.json());
    setLoading(false);
  }

  useEffect(() => { fetchRoles(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    const r = await adminFetch(`${API_BASE}/api/admin/roles`, {
      method: "POST",
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
    const r = await adminFetch(`${API_BASE}/api/admin/roles/${id}`, {
      method: "PUT",
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
    await adminFetch(`${API_BASE}/api/admin/roles/${id}`, {
      method: "DELETE",
    });
    await fetchRoles();
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditName(role.name);
    setEditTags(role.tags ?? []);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-white">Role Profiles</h1>
      <p className="mt-1 mb-8 text-sm text-gray-400">
        Define C-level personas (CEO, CTO, CFO…) with content tags. Subscribers assigned a role
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
          <label className="block mb-2 text-xs font-medium text-gray-400">
            Content Tags
            <span className="ml-2 font-normal text-gray-600">— press Enter or , to add</span>
          </label>
          <TagInput tags={newTags} onChange={setNewTags} />
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
                  <label className="block mb-2 text-xs font-medium text-gray-400">
                    Content Tags
                    <span className="ml-2 font-normal text-gray-600">— press Enter or , to add</span>
                  </label>
                  <TagInput tags={editTags} onChange={setEditTags} />
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
                  <div className="mt-1.5 flex flex-wrap gap-1">
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
                <div className="flex gap-2 shrink-0 ml-4">
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

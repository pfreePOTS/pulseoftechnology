"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminFetch, API_BASE } from "@/lib/api";

type ContentType = "article" | "video" | "landing_page";

interface ContentItem {
  id: string;
  title: string;
  url: string;
  type: ContentType;
  summary: string | null;
  tags: string[];
  is_active: boolean;
}

const EMPTY_FORM = {
  title: "",
  url: "",
  type: "landing_page" as ContentType,
  summary: "",
  tagsRaw: "",
};

const CONTENT_DRAG_TYPE = "application/x-pulse-content-id";

export default function WorkbenchPromotionTab() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [promoteDropActive, setPromoteDropActive] = useState(false);
  const [availableDropActive, setAvailableDropActive] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const r = await adminFetch(`${API_BASE}/api/admin/content`);
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!libraryModalOpen) return;
    let cancelled = false;
    (async () => {
      setLibraryLoading(true);
      const r = await adminFetch(`${API_BASE}/api/admin/content`);
      if (!cancelled && r.ok) setItems(await r.json());
      if (!cancelled) setLibraryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryModalOpen]);

  function openAdd() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      url: item.url,
      type: item.type,
      summary: item.summary ?? "",
      tagsRaw: item.tags.join(", "),
    });
    setSaveError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      type: form.type,
      summary: form.summary.trim() || null,
      tags: form.tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (!payload.title || !payload.url) {
      setSaveError("Title and URL are required.");
      setSaving(false);
      return;
    }

    const url = editingItem
      ? `${API_BASE}/api/admin/content/${editingItem.id}`
      : `${API_BASE}/api/admin/content`;
    const method = editingItem ? "PUT" : "POST";

    const r = await adminFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      setModalOpen(false);
      await fetchItems();
    } else {
      const data = await r.json().catch(() => ({}));
      setSaveError((data as { detail?: string }).detail ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleToggleActive(item: ContentItem) {
    await adminFetch(`${API_BASE}/api/admin/content/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    await fetchItems();
  }

  async function setItemPromoted(item: ContentItem, promoted: boolean) {
    if (item.is_active === promoted) return;
    setTogglingId(item.id);
    try {
      await adminFetch(`${API_BASE}/api/admin/content/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: promoted }),
      });
      await fetchItems();
    } finally {
      setTogglingId(null);
    }
  }

  function readDraggedId(e: React.DragEvent): string | null {
    return e.dataTransfer.getData(CONTENT_DRAG_TYPE) || e.dataTransfer.getData("text/plain") || null;
  }

  async function handleDropPromote(e: React.DragEvent) {
    e.preventDefault();
    setPromoteDropActive(false);
    const id = readDraggedId(e);
    if (!id) return;
    const item = items.find((i) => i.id === id);
    if (item) await setItemPromoted(item, true);
  }

  async function handleDropAvailable(e: React.DragEvent) {
    e.preventDefault();
    setAvailableDropActive(false);
    const id = readDraggedId(e);
    if (!id) return;
    const item = items.find((i) => i.id === id);
    if (item) await setItemPromoted(item, false);
  }

  const libraryHref = "/admin/library?from=workbench&step=promotion";

  const promotedInModal = items.filter((i) => i.is_active);
  const availableInModal = items.filter((i) => !i.is_active);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Promotion</h2>
          <p className="mt-1 text-sm text-gray-400">
            Choose which first-party assets appear in the newsletter &ldquo;Recommended Resources&rdquo; block (matched by
            role tags). New assets are saved to the same{" "}
            <Link href={libraryHref} className="text-indigo-400 hover:underline">
              Content Library
            </Link>{" "}
            — add them here or there.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            + Add asset
          </button>
          <button
            type="button"
            onClick={() => setLibraryModalOpen(true)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Add from library
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-700 bg-gray-900/50 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No content assets yet.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            + Add your first link or asset
          </button>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-400 hover:underline"
                >
                  {item.title}
                </a>
                <p className="text-xs text-gray-500">
                  {item.type.replace("_", " ")}
                  {item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="text-xs font-medium text-gray-400 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.is_active
                      ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                      : "bg-gray-700 text-gray-500"
                  }`}
                >
                  {item.is_active ? "Promoted" : "Off"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {libraryModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-picker-title"
        >
          <div className="flex max-h-[min(560px,85vh)] w-full max-w-xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 px-5 py-4">
              <div>
                <h3 id="library-picker-title" className="text-lg font-bold text-white">
                  Add from library
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Drag assets into the newsletter list, or use Promote. Manage full details on{" "}
                  <Link href={libraryHref} className="text-indigo-400 hover:underline">
                    Content Library
                  </Link>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {libraryLoading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading library…</p>
              ) : (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    In newsletter
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setPromoteDropActive(true);
                    }}
                    onDragLeave={() => setPromoteDropActive(false)}
                    onDrop={handleDropPromote}
                    className={`mb-5 min-h-[88px] rounded-lg border-2 border-dashed px-3 py-2 transition-colors ${
                      promoteDropActive
                        ? "border-green-500/60 bg-green-500/10"
                        : "border-gray-700 bg-gray-950/80"
                    }`}
                  >
                    {promotedInModal.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-600">
                        Drop assets here or click Promote below
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {promotedInModal.map((item) => (
                          <li
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(CONTENT_DRAG_TYPE, item.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="flex cursor-grab items-center justify-between gap-2 rounded-md bg-gray-900 px-2 py-1.5 active:cursor-grabbing"
                          >
                            <span className="min-w-0 truncate text-sm text-indigo-300">{item.title}</span>
                            <button
                              type="button"
                              disabled={togglingId === item.id}
                              onClick={() => setItemPromoted(item, false)}
                              className="shrink-0 text-xs text-gray-500 hover:text-amber-400"
                            >
                              {togglingId === item.id ? "…" : "Remove"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Available
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setAvailableDropActive(true);
                    }}
                    onDragLeave={() => setAvailableDropActive(false)}
                    onDrop={handleDropAvailable}
                    className={`rounded-lg border-2 border-dashed transition-colors ${
                      availableDropActive ? "border-amber-500/50 bg-amber-500/5" : "border-transparent"
                    }`}
                  >
                    {availableInModal.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-600">
                        Everything in the library is already in the newsletter, or add a new asset with{" "}
                        <span className="text-gray-500">+ Add asset</span>.
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800 bg-gray-950">
                        {availableInModal.map((item) => (
                          <li
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(CONTENT_DRAG_TYPE, item.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="flex cursor-grab flex-wrap items-center justify-between gap-2 px-3 py-2.5 active:cursor-grabbing"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-200">{item.title}</p>
                              <p className="text-xs text-gray-500">
                                {item.type.replace("_", " ")}
                                {item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={togglingId === item.id}
                              onClick={() => setItemPromoted(item, true)}
                              className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                              {togglingId === item.id ? "…" : "Promote"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-800 px-5 py-3">
              <button
                type="button"
                onClick={() => setLibraryModalOpen(false)}
                className="w-full rounded-lg border border-gray-700 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">
              {editingItem ? "Edit asset" : "Add asset"}
            </h3>
            <p className="mb-5 text-xs text-gray-500">
              Paste any HTTPS link (article, video, landing page). Tags help match this asset to subscriber roles in the
              newsletter.
            </p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. AI consulting services"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">URL *</label>
                <input
                  required
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ContentType })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="article">Article</option>
                  <option value="video">Video</option>
                  <option value="landing_page">Landing Page</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Tags <span className="text-gray-600">(comma-separated; match subscriber role tags)</span>
                </label>
                <input
                  value={form.tagsRaw}
                  onChange={(e) => setForm({ ...form, tagsRaw: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="AI, Security, Cloud"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Summary</label>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Short line for the newsletter promo block…"
                />
              </div>

              {saveError && (
                <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{saveError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingItem ? "Save" : "Add to library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

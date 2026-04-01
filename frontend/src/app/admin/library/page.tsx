"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { adminFetch, API_BASE } from "@/lib/api";

type WorkbenchStepQuery =
  | "signals"
  | "research"
  | "impact"
  | "selection"
  | "positioning"
  | "promotion"
  | "preview_publish";

type ContentType = "article" | "video" | "landing_page";

interface ContentItem {
  id: string;
  title: string;
  url: string;
  type: ContentType;
  summary: string | null;
  image_url: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

const TYPE_LABELS: Record<ContentType, string> = {
  article: "Article",
  video: "Video",
  landing_page: "Landing Page",
};

const TYPE_COLORS: Record<ContentType, string> = {
  article: "bg-blue-500/20 text-blue-300",
  video: "bg-red-500/20 text-red-300",
  landing_page: "bg-purple-500/20 text-purple-300",
};

const EMPTY_FORM = {
  title: "",
  url: "",
  type: "article" as ContentType,
  summary: "",
  imageUrl: "",
  tagsRaw: "",
};

const STEP_LABEL: Partial<Record<WorkbenchStepQuery, string>> = {
  signals: "Signals",
  research: "Research",
  impact: "Impact",
  selection: "Selection",
  positioning: "Positioning",
  promotion: "Promotion",
  preview_publish: "Preview & Publish",
};

const WORKBENCH_STEP_IDS: readonly WorkbenchStepQuery[] = [
  "signals",
  "research",
  "impact",
  "selection",
  "positioning",
  "promotion",
  "preview_publish",
];

function isWorkbenchStep(q: string | null): q is WorkbenchStepQuery {
  return q !== null && (WORKBENCH_STEP_IDS as readonly string[]).includes(q);
}

function workbenchReturnHref(step: WorkbenchStepQuery | null): string {
  const s = step && STEP_LABEL[step] ? step : "promotion";
  return `/admin?step=${s}`;
}

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const fromWorkbench = searchParams.get("from") === "workbench";
  const rawStep = searchParams.get("step");
  const stepParam = isWorkbenchStep(rawStep) ? rawStep : null;
  const stepLabel =
    stepParam && STEP_LABEL[stepParam] ? STEP_LABEL[stepParam] : "Promotion";

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function fetchItems() {
    const r = await adminFetch(`${API_BASE}/api/admin/content`);
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

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
      imageUrl: item.image_url ?? "",
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
      image_url: form.imageUrl.trim() || null,
      tags: form.tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

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
      setSaveError(data.detail ?? "Failed to save");
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

  async function handleDelete(item: ContentItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await adminFetch(`${API_BASE}/api/admin/content/${item.id}`, {
      method: "DELETE",
    });
    await fetchItems();
  }

  const backHref = workbenchReturnHref(stepParam);

  return (
    <div className="mx-auto max-w-5xl">
      {fromWorkbench && (
        <nav className="mb-4 text-xs text-gray-500" aria-label="Breadcrumb">
          <Link href="/admin" className="text-indigo-400/90 hover:text-indigo-300">
            Marketer&apos;s Workbench
          </Link>
          <span className="mx-2 text-gray-600">/</span>
          <Link href={backHref} className="text-indigo-400/90 hover:text-indigo-300">
            {stepLabel}
          </Link>
          <span className="mx-2 text-gray-600">/</span>
          <span className="text-gray-300">Content Library</span>
        </nav>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {fromWorkbench && (
            <Link
              href={backHref}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              <span aria-hidden>←</span> Back to {stepLabel}
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white">Content Library</h1>
          <p className="mt-1 text-sm text-gray-400">
            First-party assets promoted in subscriber newsletters based on role tags.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add Content
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
          <p className="text-sm text-gray-500">No content yet. Add your first asset above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tags
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {items.map((item) => (
                <tr key={item.id} className={item.is_active ? "" : "opacity-50"}>
                  <td className="max-w-xs px-4 py-3">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {item.title}
                    </a>
                    {item.summary && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.summary}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[item.type]}`}>
                      {TYPE_LABELS[item.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.length > 0 ? (
                        item.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.is_active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="mr-3 text-xs text-gray-400 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-xs text-red-500 hover:text-red-400"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-bold text-white">
              {editingItem ? "Edit Content" : "Add Content"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. The AI Readiness Playbook"
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
                  Tags <span className="text-gray-600">(comma-separated, matches subscriber role tags)</span>
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
                  placeholder="One-line description shown in the newsletter…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Hero image URL <span className="text-gray-600">(optional, newsletter promo)</span>
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://…"
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
                  {saving ? "Saving…" : editingItem ? "Save Changes" : "Add Content"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryFallback() {
  return (
    <div className="mx-auto max-w-5xl py-16 text-center text-sm text-gray-500">Loading…</div>
  );
}

export default function ContentLibraryPage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <LibraryPageContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";

const NAV = [
  { label: "Marketer's Workbench", href: "/admin" },
  { label: "Newsletter preview", href: "/admin/newsletter" },
  { label: "Radar preview", href: "/admin/radar-preview" },
  { label: "Manage Sources", href: "/admin/sources" },
  { label: "Subscribers", href: "/admin/subscribers" },
  { label: "Role Profiles", href: "/admin/roles" },
  { label: "Content Library", href: "/admin/library" },
  { label: "System Jobs", href: "/admin/jobs" },
] as const;

type NavItem = (typeof NAV)[number];

const NAV_ORDER_KEY = "pulseone-admin-nav-order";

function normalizeOrder(savedHrefs: string[] | undefined, defaults: readonly NavItem[]): NavItem[] {
  if (!savedHrefs?.length) return [...defaults];
  const byHref = new Map<string, NavItem>(defaults.map((n) => [n.href, n]));
  const ordered: NavItem[] = [];
  for (const href of savedHrefs) {
    const item = byHref.get(href);
    if (item) ordered.push(item);
  }
  for (const item of defaults) {
    if (!ordered.some((o) => o.href === item.href)) ordered.push(item);
  }
  return ordered;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

function DragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      className="cursor-grab shrink-0 touch-none rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300 active:cursor-grabbing"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="inline-block" aria-hidden>
        <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" className="opacity-80">
          <circle cx="4" cy="3" r="1.6" />
          <circle cx="10" cy="3" r="1.6" />
          <circle cx="4" cy="9" r="1.6" />
          <circle cx="10" cy="9" r="1.6" />
          <circle cx="4" cy="15" r="1.6" />
          <circle cx="10" cy="15" r="1.6" />
        </svg>
      </span>
    </button>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  /** null = not checked yet (protected routes only) */
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>(() => [...NAV]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY);
      if (raw) setNavItems(normalizeOrder(JSON.parse(raw) as string[], NAV));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/admin/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { authenticated?: boolean }) => {
        if (cancelled) return;
        if (!data.authenticated) router.replace("/admin/login");
        else setAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoginPage, router]);

  async function handleLogout() {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
    setAuthenticated(null);
    router.replace("/admin/login");
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="text-sm text-gray-600">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
        {/* Brand */}
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#E91D24" }}
          />
          <span className="text-sm font-bold tracking-wide">PulseOne</span>
        </div>

        {/* Nav — order persisted in localStorage */}
        <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Admin navigation">
          {navItems.map(({ label, href }, index) => {
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <div
                key={href}
                data-nav-row
                className={`flex items-stretch gap-0.5 rounded-lg pl-0.5 transition-opacity ${
                  draggingIndex === index ? "opacity-50" : ""
                } ${dragOverIndex === index && draggingIndex !== index ? "ring-1 ring-indigo-500/40 bg-gray-800/30" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggingIndex !== null && draggingIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw =
                    e.dataTransfer.getData("application/x-nav-index") ||
                    e.dataTransfer.getData("text/plain");
                  const from = raw === "" ? Number.NaN : Number(raw);
                  if (Number.isNaN(from)) return;
                  setNavItems((prev) => {
                    const next = arrayMove(prev, from, index);
                    try {
                      localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next.map((n) => n.href)));
                    } catch {
                      /* ignore */
                    }
                    return next;
                  });
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
              >
                <DragHandle
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-nav-index", String(index));
                    e.dataTransfer.setData("text/plain", String(index));
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingIndex(index);
                  }}
                  onDragEnd={() => {
                    setDraggingIndex(null);
                    setDragOverIndex(null);
                  }}
                />
                <Link
                  href={href}
                  draggable={false}
                  className={`flex min-w-0 flex-1 items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-800 px-3 py-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-800 hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main: consistent inset from sidebar (extra pl so content clears the rail) ── */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full py-10 pl-8 pr-6 sm:pl-10 sm:pr-8 lg:pl-12 lg:pr-10">
          {children}
        </div>
      </main>
    </div>
  );
}

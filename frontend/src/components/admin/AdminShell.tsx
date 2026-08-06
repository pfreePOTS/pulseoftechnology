"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { PulseOneOfficialLogo } from "@/components/PulseOneOfficialLogo";
import {
  ADMIN_NAV,
  canAccessAdminPath,
  navAllowedForUser,
  type AdminNavItem,
  type SessionUser,
} from "@/lib/admin-nav";
import { apiOriginForBrowser } from "@/lib/api";

/** Remove legacy "1. " prefixes so list position is the only numbering (handles stale caches). */
function navLabelText(label: string): string {
  return label.replace(/^\d+\.\s*/, "").trim();
}

const NAV_ORDER_KEY = "pulseone-admin-nav-order";

function normalizeOrder(savedHrefs: string[] | undefined, defaults: readonly AdminNavItem[]): AdminNavItem[] {
  if (!savedHrefs?.length) return [...defaults];
  const byHref = new Map<string, AdminNavItem>(defaults.map((n) => [n.href, n]));
  const ordered: AdminNavItem[] = [];
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

function firstAllowedHref(user: SessionUser): string {
  if (user.is_superuser) return "/admin";
  for (const item of ADMIN_NAV) {
    if (user.page_permissions.includes(item.slug)) return item.href;
  }
  return "/admin/login";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Stable ref so effects can navigate without re-running on every router identity change.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const isLoginPage = pathname === "/admin/login";
  const isChangePasswordPage = pathname === "/admin/change-password";
  /** null = not checked yet (protected routes only) */
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [navItems, setNavItems] = useState<AdminNavItem[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    const allowed = ADMIN_NAV.filter((n) => navAllowedForUser(n, sessionUser));
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY);
      if (raw) {
        setNavItems(normalizeOrder(JSON.parse(raw) as string[], allowed));
        return;
      }
    } catch {
      /* ignore */
    }
    setNavItems(allowed);
  }, [sessionUser]);

  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    const timeoutMs = 12_000;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    fetch(`${apiOriginForBrowser()}/api/admin/session`, { credentials: "include", signal: controller.signal })
      .then(async (r) => {
        if (cancelled) return null;
        if (!r.ok) {
          routerRef.current.replace("/admin/login");
          return null;
        }
        return (await r.json()) as { authenticated?: boolean; user?: SessionUser };
      })
      .then((data) => {
        if (cancelled || data === null) return;
        if (!data.authenticated || !data.user) {
          routerRef.current.replace("/admin/login");
          return;
        }
        setSessionUser(data.user);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled) routerRef.current.replace("/admin/login");
      })
      .finally(() => {
        window.clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isLoginPage]);

  useEffect(() => {
    if (!sessionUser || isLoginPage || isChangePasswordPage) return;
    if (sessionUser.must_change_password) {
      routerRef.current.replace("/admin/change-password");
      return;
    }
    if (!canAccessAdminPath(pathname, sessionUser)) {
      routerRef.current.replace(firstAllowedHref(sessionUser));
    }
  }, [sessionUser, pathname, isLoginPage, isChangePasswordPage]);

  async function handleLogout() {
    await fetch(`${apiOriginForBrowser()}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
    setAuthenticated(null);
    setSessionUser(null);
    routerRef.current.replace("/admin/login");
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isChangePasswordPage) {
    if (authenticated === null) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <span className="text-sm text-gray-600">Loading…</span>
        </div>
      );
    }
    if (!sessionUser) {
      return null;
    }
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-md px-4 py-16">{children}</div>
      </div>
    );
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
        {/* Brand — same asset as GlobalHeader; inverted like GlobalFooter for dark rail */}
        <div className="border-b border-gray-800 px-4 py-4">
          <Link href="/admin" className="inline-block shrink-0" aria-label="PulseOne admin">
            <PulseOneOfficialLogo variant="onDark" size="sm" />
          </Link>
        </div>

        {/* Nav — order persisted in localStorage */}
        <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Admin navigation">
          {navItems.map((item, index) => {
            const { label, href } = item;
            const isActive =
              href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
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
                  <span
                    className={`shrink-0 tabular-nums ${isActive ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {index + 1}.
                  </span>
                  <span className="ml-1.5 min-w-0">{navLabelText(label)}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-800 px-3 py-4">
          {sessionUser && (
            <p className="mb-2 truncate px-1 text-xs text-gray-500" title={sessionUser.email}>
              {sessionUser.email}
            </p>
          )}
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

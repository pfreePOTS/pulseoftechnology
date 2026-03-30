"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";

const NAV = [
  { label: "Curate Topics", href: "/admin" },
  { label: "Manage Sources", href: "/admin/sources" },
  { label: "Subscribers", href: "/admin/subscribers" },
  { label: "Role Profiles", href: "/admin/roles" },
  { label: "Content Library", href: "/admin/library" },
  { label: "Signal Intelligence", href: "/admin/signals" },
  { label: "System Jobs", href: "/admin/jobs" },
  { label: "Radar Preview", href: "/admin/radar-preview" },
  { label: "Newsletter Preview", href: "/admin/newsletter" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  /** null = not checked yet (protected routes only) */
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

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

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ label, href }) => {
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                }`}
              >
                {label}
              </Link>
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

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

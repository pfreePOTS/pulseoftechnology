"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { label: "Curate Topics", href: "/admin" },
  { label: "Manage Sources", href: "/admin/sources" },
  { label: "Subscribers", href: "/admin/subscribers" },
  { label: "System Jobs", href: "/admin/jobs" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setReady(true);
      return;
    }
    const token = localStorage.getItem("pulse_admin_token");
    if (!token) {
      router.replace("/admin/login");
    } else {
      setReady(true);
    }
  }, [isLoginPage, router]);

  // Login page renders without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="text-sm text-gray-600">Loading…</span>
      </div>
    );
  }

  function handleLogout() {
    localStorage.removeItem("pulse_admin_token");
    document.cookie =
      "pulse_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.replace("/admin/login");
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
            onClick={handleLogout}
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

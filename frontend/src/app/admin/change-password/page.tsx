"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PulseOneWordmark } from "@/components/PulseOneWordmark";
import { adminFetch, API_BASE } from "@/lib/api";
import type { SessionUser } from "@/lib/admin-nav";

export default function AdminChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/admin/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { authenticated?: boolean; user?: SessionUser }) => {
        if (cancelled) return;
        if (!data.authenticated || !data.user) {
          router.replace("/admin/login");
          return;
        }
        setSessionUser(data.user);
        if (!data.user.must_change_password) {
          router.replace("/admin");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/me/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Could not update password.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Request failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionUser) {
    return (
      <div className="text-center text-sm text-gray-500 py-12">
        Loading…
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 flex flex-col items-center text-center">
        <Link
          href="/"
          className="mb-5 inline-block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#019E7C] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          aria-label="PulseOne — home"
        >
          <PulseOneWordmark variant="dark" className="text-[1.625rem] leading-none opacity-95" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
        <p className="mt-2 text-sm text-gray-400">
          Signed in as <span className="text-gray-300">{sessionUser.email}</span>. Replace your temporary password
          before continuing.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block text-sm">
          <span className="text-gray-400">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-400">New password (min. 8 characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-400">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
          />
        </label>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#019E7C" }}
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

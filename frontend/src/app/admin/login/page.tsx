"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError("Invalid email or password. Please try again.");
        return;
      }
      const data = (await res.json()) as { must_change_password?: boolean };
      if (data.must_change_password) {
        router.replace("/admin/change-password");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Login failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            className="inline-block h-3 w-3 rounded-full mb-4"
            style={{ backgroundColor: "#E91D24" }}
          />
          <h1 className="text-2xl font-bold text-white">PulseOne Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with your admin email and password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (e.g. pulseoneadmin)"
            required
            autoFocus
            suppressHydrationWarning
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            suppressHydrationWarning
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || password.length === 0 || email.trim().length === 0}
            className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#E91D24" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <p className="mt-6 rounded-lg border border-dashed border-gray-700 bg-gray-900/50 px-3 py-2 text-center text-xs text-gray-500">
            Dev: first admin is <code className="text-gray-400">pulseoneadmin@pulseone.local</code>{" "}
            (or type <code className="text-gray-400">pulseoneadmin</code>) with password from{" "}
            <code className="text-gray-400">ADMIN_PASSWORD</code> in <code className="text-gray-400">.env</code>{" "}
            (default <code className="text-gray-400">pulseadmin</code>).
          </p>
        )}
      </div>
    </div>
  );
}

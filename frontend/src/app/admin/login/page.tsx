"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PulseOneOfficialLogo } from "@/components/PulseOneOfficialLogo";
import { API_BASE, apiBaseLooksUnsetForProductionDeploy } from "@/lib/api";

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
      const mis = apiBaseLooksUnsetForProductionDeploy();
      setError(
        mis
          ? "Cannot reach API: NEXT_PUBLIC_API_URL was not baked into this build (still localhost). On Railway, set NEXT_PUBLIC_API_URL and SERVER_API_URL to your backend HTTPS URL, enable them during the Docker/build step, redeploy Frontend, hard-refresh the browser."
          : `Cannot contact the login API at ${API_BASE}. Confirm NEXT_PUBLIC_API_URL matches your live backend URL (rebuild frontend if wrong) and add ${typeof window !== "undefined" ? window.location.origin : "this site's origin"} to CORS_ORIGINS on the backend (comma-separated HTTPS origins).`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            className="mb-5 inline-block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#019E7C] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            aria-label="PulseOne — home"
          >
            <PulseOneOfficialLogo variant="onDark" size="md" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
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

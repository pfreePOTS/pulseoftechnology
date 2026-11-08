"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PulseOneOfficialLogo } from "@/components/PulseOneOfficialLogo";
import { adminResponseErrorDetail, absoluteApiUrl, apiBaseLooksUnsetForProductionDeploy } from "@/lib/api";

type Step = "credentials" | "mfa";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  function contactErrorMessage(): string {
    const mis = apiBaseLooksUnsetForProductionDeploy();
    return mis
      ? "Cannot reach API: NEXT_PUBLIC_API_URL was not baked into this build (still localhost). On Railway, set NEXT_PUBLIC_API_URL and SERVER_API_URL to your backend HTTPS URL, enable them during the Docker/build step, redeploy Frontend, hard-refresh the browser."
      : `Cannot contact the login API at ${absoluteApiUrl("/")}. Confirm NEXT_PUBLIC_API_URL matches your live backend URL (rebuild frontend if wrong) and add ${typeof window !== "undefined" ? window.location.origin : "this site's origin"} to CORS_ORIGINS on the backend (comma-separated HTTPS origins).`;
  }

  async function finishAfterSession(res: Response) {
    const data = (await res.json()) as { must_change_password?: boolean };
    if (data.must_change_password) {
      router.replace("/admin/change-password");
      return;
    }
    router.replace("/admin");
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(absoluteApiUrl("/api/admin/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const detail = (await adminResponseErrorDetail(res)).trim();
        if (res.status === 401) {
          setError(
            detail && !/^HTTP \d+$/i.test(detail)
              ? detail
              : "Invalid email or password. Please try again.",
          );
        } else if (res.status === 503) {
          setError(
            detail && !/^HTTP \d+$/i.test(detail)
              ? detail
              : "Could not send verification email. Try again shortly.",
          );
        } else {
          setError(detail || `Sign-in failed (HTTP ${res.status}). Please try again.`);
        }
        return;
      }
      const data = (await res.json()) as { mfa_required?: boolean; mfa_token?: string };
      if (!data.mfa_required || !data.mfa_token) {
        setError("Unexpected login response. Please try again.");
        return;
      }
      setMfaToken(data.mfa_token);
      setMfaCode("");
      setStep("mfa");
    } catch {
      setError(contactErrorMessage());
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(absoluteApiUrl("/api/admin/login/mfa"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_token: mfaToken, code: mfaCode.trim() }),
      });
      if (!res.ok) {
        const detail = (await adminResponseErrorDetail(res)).trim();
        setError(
          detail && !/^HTTP \d+$/i.test(detail)
            ? detail
            : "Invalid or expired verification code. Please try again.",
        );
        return;
      }
      await finishAfterSession(res);
    } catch {
      setError(contactErrorMessage());
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    try {
      const res = await fetch(absoluteApiUrl("/api/admin/login/mfa/resend"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_token: mfaToken }),
      });
      if (!res.ok) {
        const detail = (await adminResponseErrorDetail(res)).trim();
        setError(
          detail && !/^HTTP \d+$/i.test(detail)
            ? detail
            : "Could not resend the code. Start over and try again.",
        );
        return;
      }
      const data = (await res.json()) as { mfa_token?: string };
      if (data.mfa_token) {
        setMfaToken(data.mfa_token);
      }
      setMfaCode("");
    } catch {
      setError(contactErrorMessage());
    } finally {
      setResending(false);
    }
  }

  function handleBack() {
    setStep("credentials");
    setMfaToken("");
    setMfaCode("");
    setError("");
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
          {step === "mfa" && (
            <p className="text-sm text-gray-500">Enter the verification code we emailed you.</p>
          )}
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="email"
              autoComplete="username"
              data-testid="admin-login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoFocus
              suppressHydrationWarning
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
            />
            <input
              type="password"
              autoComplete="current-password"
              data-testid="admin-login-password"
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
              data-testid="admin-login-submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#E91D24" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              data-testid="admin-login-mfa-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code"
              required
              autoFocus
              suppressHydrationWarning
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 tracking-widest focus:border-[#019E7C] focus:outline-none focus:ring-1 focus:ring-[#019E7C]"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              data-testid="admin-login-mfa-submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#E91D24" }}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <div className="flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                data-testid="admin-login-mfa-back"
                onClick={handleBack}
                className="text-gray-400 hover:text-gray-300"
              >
                Back
              </button>
              <button
                type="button"
                data-testid="admin-login-mfa-resend"
                onClick={handleResend}
                disabled={resending}
                className="text-[#019E7C] hover:text-[#01b58d] disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <details className="mt-6 rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2 text-left">
          <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-300">
            Trouble signing in?
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-gray-500">
            <li>
              After your password is accepted, we email a one-time code to your account address.
              Check spam if it does not arrive within a minute.
            </li>
            <li>
              If someone used <strong className="text-gray-400">Reset password</strong> for your account, your{" "}
              <strong className="text-gray-400">previous password stops working</strong>. You must use the{" "}
              <strong className="text-gray-400">temporary password</strong> from that step, then choose a new password.
            </li>
            <li>
              If your account was <strong className="text-gray-400">deactivated</strong>, ask a superuser to activate you
              under <strong className="text-gray-400">Users</strong> before sign-in works again.
            </li>
          </ul>
        </details>

        {process.env.NODE_ENV === "development" && (
          <p className="mt-6 rounded-lg border border-dashed border-gray-700 bg-gray-900/50 px-3 py-2 text-center text-xs text-gray-500">
            Dev: first admin is <code className="text-gray-400">pulseoneadmin@pulseone.local</code>{" "}
            (or type <code className="text-gray-400">pulseoneadmin</code>) with password from{" "}
            <code className="text-gray-400">ADMIN_PASSWORD</code> in <code className="text-gray-400">.env</code>{" "}
            (default <code className="text-gray-400">pulseadmin</code>). MFA uses{" "}
            <code className="text-gray-400">ADMIN_MFA_DEV_CODE</code> when set (Compose default{" "}
            <code className="text-gray-400">246801</code>).
          </p>
        )}
      </div>
    </div>
  );
}

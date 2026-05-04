/**
 * Browser-facing API base (Compose maps backend to host port 8100).
 * Admin calls use credentials: "include" for httpOnly JWT cookie.
 *
 * Note: `??` does not treat "" as missing — an empty env var would break URLs. We normalize that.
 *
 * Paths in the app assume `${API_BASE}/api/...`. If callers set `NEXT_PUBLIC_API_URL`
 * with a trailing `/api` by mistake (`http://localhost:8100/api`), strip it to avoid `/api/api/...`.
 */
function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return "http://localhost:8100";
  const noSlash = raw.replace(/\/+$/, "");
  return noSlash.replace(/\/api$/i, "");
}

export const API_BASE = resolveApiBase();

/** `NEXT_PUBLIC_*` baked at build — unset on Railway ⇒ browser still hits localhost → login fetch fails. */
export function apiBaseLooksUnsetForProductionDeploy(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return /\blocalhost\b|^http:\/\/127\./i.test(API_BASE);
}

/** Parse FastAPI `{ "detail": ... }` or plain text from a failed admin response. */
export async function adminResponseErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    const d = parsed?.detail;
    if (typeof d === "string") return d;
    if (d !== undefined && d !== null) return JSON.stringify(d);
  } catch {
    /* not JSON */
  }
  const t = raw.trim();
  if (t) return t.length > 220 ? `${t.slice(0, 220)}…` : t;
  return `HTTP ${res.status}`;
}

/**
 * Authenticated admin fetch — sends httpOnly cookie set by POST /api/admin/login.
 */
export function adminFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}


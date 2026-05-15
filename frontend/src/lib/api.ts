/**
 * Browser-facing API base (Compose maps backend to host port 8100).
 * Admin calls use credentials: include for httpOnly JWT cookie from POST /api/admin/login.
 *
 * Note: unset NEXT_PUBLIC_API_URL ⇒ default `http://localhost:8100`. Trailing `/` and `/api` suffixes normalize.
 */

/**
 * `STATIC_API_ORIGIN` comes from NEXT_PUBLIC_API_URL at build — usually `http://localhost:8100`.
 *
 * Browsers treat `localhost` vs `127.0.0.1` as different hosts. Serving the Next app on `127.0.0.1`
 * while the env still points at `localhost` breaks credentialed fetches: SameSite=Lax cookies are not
 * sent on that cross-site pairing. **`apiOriginForBrowser()`** rewrites loopback origins to match
 * `window.location.hostname` so admin cookie auth works whichever loopback hostname you use.
 */

function normalizeApiOrigin(raw?: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "http://localhost:8100";
  const noSlash = trimmed.replace(/\/+$/, "");
  return noSlash.replace(/\/api$/i, "");
}

const STATIC_API_ORIGIN = normalizeApiOrigin(process.env.NEXT_PUBLIC_API_URL);

/**
 * When `"1"` and `BACKEND_PROXY_TARGET` is configured in Compose, browsers call
 * `{page origin}/__pulse_api/...` (same-origin proxy) instead of `:8100` directly.
 */
const USE_RELATIVE_API =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_RELATIVE_API === "1";

/** Build-time/server default backend origin — SSR, Vitest, error strings. */
export const API_BASE = STATIC_API_ORIGIN;

function alignsMixedLoopbacks(pageHost: string, apiHostname: string): boolean {
  return (
    (pageHost === "localhost" || pageHost === "127.0.0.1") &&
    (apiHostname === "localhost" || apiHostname === "127.0.0.1") &&
    pageHost !== apiHostname
  );
}

/** Backend origin aligned with page hostname inside the browser when both sides use IPv4/name loopbacks. */
export function apiOriginForBrowser(): string {
  if (typeof window === "undefined") return STATIC_API_ORIGIN;
  if (USE_RELATIVE_API) {
    return `${window.location.origin}/__pulse_api`;
  }
  try {
    const u = new URL(STATIC_API_ORIGIN);
    if (alignsMixedLoopbacks(window.location.hostname, u.hostname)) {
      u.hostname = window.location.hostname;
      return u.origin;
    }
  } catch {
    /* noop */
  }
  return STATIC_API_ORIGIN;
}

/** Rewrite absolute URLs that start with the static origin to the browser-aligned origin. */
function alignCredentialedUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (!url.startsWith(STATIC_API_ORIGIN)) return url;
  const live = apiOriginForBrowser();
  if (live === STATIC_API_ORIGIN) return url;
  return `${live}${url.slice(STATIC_API_ORIGIN.length)}`;
}

/** Absolute `/api/...` URL with loopback alignment in the browser. */
export function absoluteApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = typeof window === "undefined" ? STATIC_API_ORIGIN : apiOriginForBrowser();
  return `${origin}${p}`;
}

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
 * Rewrites `http://localhost:8100` ↔ `http://127.0.0.1:8100` in the browser so cookies stay same-site.
 */
export function adminFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const urlStr = typeof input === "string" ? input : input.href;
  return fetch(alignCredentialedUrl(urlStr), {
    ...init,
    credentials: "include",
    headers,
  });
}

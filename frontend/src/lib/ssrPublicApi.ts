import { API_BASE } from "./api";

/**
 * FastAPI URL for **server-side** fetches during RSC/SSR (`cache: no-store`).
 *
 * In Docker Compose the frontend must call the backend container by hostname
 * (`SERVER_API_URL`, e.g. `http://backend:8000`). `NEXT_PUBLIC_*` / `localhost`
 * is for the browser on the host and is wrong inside the Next.js container —
 * SSR would hang connecting to localhost:8100 unless overridden.
 *
 * Fallback order mirrors previous inline usage in `/radar`, `/everyone`,
 * `/recommended-path`.
 */
export const SSR_PUBLIC_API_BASE = (
  process.env.SERVER_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  API_BASE
).replace(/\/$/, "");

/** Default ceiling so a dead/miswired API cannot block SSR indefinitely (page stuck “rendering”). */
const SSR_FETCH_DEADLINE_MS = 15_000;

/**
 * Bounded `fetch` for public JSON routes on the Pulse API — returns `null` on
 * HTTP errors, timeouts, abort, or invalid JSON handlers.
 *
 * @param deadlineMs — override for slow AI routes (e.g. `/api/recommended-path`).
 */
export async function ssrFetchJsonUnknown(
  pathname: string,
  init?: Omit<RequestInit, "signal" | "cache">,
  deadlineMs: number = SSR_FETCH_DEADLINE_MS,
): Promise<unknown | null> {
  const url = pathname.startsWith("http")
    ? pathname
    : `${SSR_PUBLIC_API_BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), deadlineMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

export async function ssrFetchJson<T>(
  pathname: string,
  init?: Omit<RequestInit, "signal" | "cache">,
  deadlineMs?: number,
): Promise<T | null> {
  const data = await ssrFetchJsonUnknown(
    pathname,
    init,
    deadlineMs ?? SSR_FETCH_DEADLINE_MS,
  );
  return data !== null ? (data as T) : null;
}

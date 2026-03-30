/**
 * Browser-facing API base (Compose maps backend to host port 8100).
 * Admin calls use credentials: "include" for httpOnly JWT cookie.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

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


import type { NextConfig } from "next";

/** Dev: proxy `/__pulse_api/*` → Compose backend URL so credentialed fetches stay same-origin with the Next app (cookies, Playwright/Chromium reliability). Production: omit `BACKEND_PROXY_TARGET`. */
const backendProxyTarget = process.env.BACKEND_PROXY_TARGET?.trim();

const nextConfig: NextConfig = {
  // Smaller Railway image and default `frontend/Dockerfile.prod` runner.
  output: "standalone",
  /**
   * When `BACKEND_PROXY_TARGET` is set, `/__pulse_api/*` is proxied through the
   * Next dev server. The built-in http-proxy timeout defaults to **30s**; slow
   * routes like `GET /api/recommended-path` (LLM) exceed that and surface as
   * `ECONNRESET` / `Failed to proxy … socket hang up` while the FastAPI log
   * still shows `200` for a later `skip_ai=true` retry.
   */
  experimental: {
    proxyTimeout: Number(process.env.NEXT_PROXY_TIMEOUT_MS ?? 180_000),
  },
  async rewrites() {
    if (!backendProxyTarget) return [];
    const base = backendProxyTarget.replace(/\/$/, "");
    return [{ source: "/__pulse_api/:path*", destination: `${base}/:path*` }];
  },
};

export default nextConfig;

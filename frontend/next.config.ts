import type { NextConfig } from "next";

/** Dev: proxy `/__pulse_api/*` → Compose backend URL so credentialed fetches stay same-origin with the Next app (cookies, Playwright/Chromium reliability). Production: omit `BACKEND_PROXY_TARGET`. */
const backendProxyTarget = process.env.BACKEND_PROXY_TARGET?.trim();

const nextConfig: NextConfig = {
  // Smaller Railway image and default `frontend/Dockerfile.prod` runner.
  output: "standalone",
  async rewrites() {
    if (!backendProxyTarget) return [];
    const base = backendProxyTarget.replace(/\/$/, "");
    return [{ source: "/__pulse_api/:path*", destination: `${base}/:path*` }];
  },
};

export default nextConfig;

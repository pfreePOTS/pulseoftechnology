import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller Railway image and default `frontend/Dockerfile.prod` runner.
  output: "standalone",
};

export default nextConfig;

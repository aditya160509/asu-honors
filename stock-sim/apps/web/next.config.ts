import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Default proxy timeout for rewrites is 30s — a large sim advance (e.g. 30
  // days x 150 companies) legitimately takes longer than that to compute and
  // commit server-side. Without this, the rewrite gives up and returns a
  // synthetic 500 to the client while the backend keeps running and commits
  // successfully anyway — the request didn't actually fail, the proxy just
  // stopped waiting for it.
  experimental: {
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;

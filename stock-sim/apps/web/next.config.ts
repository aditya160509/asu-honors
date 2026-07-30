import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    // Local dev should work with `./start.sh` out of the box. Production can
    // still provide API_PROXY_TARGET explicitly for its deployed API.
    const apiOrigin = process.env.API_PROXY_TARGET ||
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : undefined);
    if (!apiOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

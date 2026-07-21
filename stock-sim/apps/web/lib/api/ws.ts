/** Builds an absolute ws(s):// URL for a given API-relative path (e.g.
 * "/ws/notifications"), mirroring client.ts's BASE resolution: an absolute
 * NEXT_PUBLIC_API_URL is used as-is (http->ws, https->wss); otherwise the
 * app is assumed to be served from the same origin as the API (Next.js
 * rewrites proxy /api/v1/*), so the browser's own location supplies the
 * scheme/host. */
export function buildWsUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    const wsBase = configured.replace(/^http/, "ws");
    return `${wsBase}${path}`;
  }
  if (typeof window === "undefined") return "";
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/api/v1${path}`;
}

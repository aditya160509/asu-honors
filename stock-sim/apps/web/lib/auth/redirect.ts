/** Open-redirect protection: only same-origin relative paths pass through. */
export function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes(":")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}

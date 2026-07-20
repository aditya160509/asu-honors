import { cn } from "@/lib/utils";

export interface AvatarProps {
  displayName: string;
  className?: string;
  /** When provided, derives a deterministic color variant from this string instead of the
   * default accent color — e.g. a company ticker, so distinct companies read as visually
   * distinct at a glance rather than every avatar sharing one identical color. */
  colorSeed?: string;
}

// A fixed hue palette (same family used for sector bars elsewhere) -- the color is a
// deterministic hash of the seed string, not a fabricated per-company "brand" color.
const COLOR_VARIANTS = [
  { bg: "rgba(14,165,233,0.16)", fg: "#0ea5e9" },
  { bg: "rgba(139,92,246,0.16)", fg: "#8b5cf6" },
  { bg: "rgba(245,158,11,0.16)", fg: "#f59e0b" },
  { bg: "rgba(16,185,129,0.16)", fg: "#10b981" },
  { bg: "rgba(239,68,68,0.16)", fg: "#ef4444" },
  { bg: "rgba(236,72,153,0.16)", fg: "#ec4899" },
  { bg: "rgba(249,115,22,0.16)", fg: "#f97316" },
  { bg: "rgba(20,184,166,0.16)", fg: "#14b8a6" },
  { bg: "rgba(99,102,241,0.16)", fg: "#6366f1" },
  { bg: "rgba(132,204,22,0.16)", fg: "#84cc16" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Initials-in-a-rounded-div — no profile photos (SKILL.md anti-slop). */
export function Avatar({ displayName, className, colorSeed }: AvatarProps) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const variant = colorSeed ? COLOR_VARIANTS[hashString(colorSeed) % COLOR_VARIANTS.length] : null;

  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-sm text-small font-medium",
        !variant && "bg-accent-dim text-accent",
        className
      )}
      style={variant ? { backgroundColor: variant.bg, color: variant.fg } : undefined}
    >
      {initials || "?"}
    </div>
  );
}

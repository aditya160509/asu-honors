import { cn } from "@/lib/utils";

export interface AvatarProps {
  displayName: string;
  className?: string;
}

/** Initials-in-a-rounded-div — no profile photos (SKILL.md anti-slop). */
export function Avatar({ displayName, className }: AvatarProps) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-sm bg-accent-dim text-accent text-small font-medium",
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLarge, formatPct, formatPrice, trendColorClass } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  format?: "price" | "pct" | "large" | "text";
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

const VALUE_SIZE: Record<NonNullable<StatCardProps["size"]>, string> = {
  sm: "text-base",
  md: "text-h2",
  lg: "text-h1",
};

const LABEL_SIZE: Record<NonNullable<StatCardProps["size"]>, string> = {
  sm: "text-micro",
  md: "text-small",
  lg: "text-body",
};

function formatValue(value: string | number, format?: StatCardProps["format"]): string {
  if (typeof value === "string") return value;
  if (format === "price") return formatPrice(value);
  if (format === "pct") return formatPct(value);
  if (format === "large") return formatLarge(value);
  return String(value);
}

export function StatCard({ label, value, format = "text", trend, icon: Icon, loading, size = "md" }: StatCardProps) {
  return (
    <div className="card-flat p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-text-secondary">
        {Icon && <Icon size={13} />}
        <span className={LABEL_SIZE[size]}>{label}</span>
      </div>
      {loading ? (
        <Skeleton width={80} height={size === "lg" ? 28 : size === "md" ? 20 : 16} />
      ) : (
        <span
          className={cn(
            "num font-semibold",
            VALUE_SIZE[size],
            trend ? trendColorClass(trend === "up" ? 1 : trend === "down" ? -1 : 0) : "text-text-primary"
          )}
        >
          {formatValue(value, format)}
        </span>
      )}
    </div>
  );
}

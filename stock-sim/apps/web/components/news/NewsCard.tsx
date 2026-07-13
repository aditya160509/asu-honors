import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { NewsItem } from "@/lib/api/types";

export interface NewsCardProps {
  item: NewsItem;
}

const SENTIMENT_VARIANT: Record<string, "positive" | "negative" | "default"> = {
  positive: "positive",
  negative: "negative",
  neutral: "default",
};

// Backend severity is a 0-100 scale (see db/seeds/seed_events.py severity_range, e.g. "10..50").
function severityLabel(severity: number): string {
  if (severity >= 75) return "Critical";
  if (severity >= 50) return "High";
  if (severity >= 25) return "Med";
  return "Low";
}

function severityVariant(severity: number): "default" | "warning" | "negative" {
  if (severity >= 75) return "negative";
  if (severity >= 25) return "warning";
  return "default";
}

export function NewsCard({ item }: NewsCardProps) {
  return (
    <div className="card-flat p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="num text-micro text-text-tertiary">{formatDate(item.sim_date)}</span>
        <Badge variant={SENTIMENT_VARIANT[item.sentiment] ?? "default"}>{item.sentiment}</Badge>
        <Badge variant={severityVariant(item.severity)}>{severityLabel(item.severity)}</Badge>
        {(item.company_name || item.industry_name) && (
          <Badge variant="accent">{item.company_name ?? item.industry_name}</Badge>
        )}
      </div>
      <p className="text-body font-medium text-text-primary">{item.headline}</p>
      <p className="text-small text-text-secondary line-clamp-2">{item.body}</p>
    </div>
  );
}

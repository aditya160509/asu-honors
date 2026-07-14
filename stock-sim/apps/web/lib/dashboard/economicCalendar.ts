import type { NewsItem } from "@/lib/api/types";
import type { CalendarDay } from "@/lib/dashboard/types";

/** 0-100 magnitude scale (see components/news/NewsCard.tsx) — abs() because resolved_severity can carry a sign. */
export function impactDotCount(severity: number): 1 | 2 | 3 {
  const magnitude = Math.abs(severity);
  if (magnitude >= 50) return 3;
  if (magnitude >= 25) return 2;
  return 1;
}

/**
 * Reframes market/industry-wide news (company_name == null) as a dated
 * "calendar" of real scheduled events — no invented earnings/economic feed
 * exists in this backend, so this is the closest honest analog built from
 * real NewsItem rows.
 */
export function groupMacroNewsByDate(news: NewsItem[], maxDays = 6): CalendarDay[] {
  const macro = news.filter((n) => !n.company_name);
  const byDate = new Map<string, NewsItem[]>();
  for (const item of macro) {
    const list = byDate.get(item.sim_date) ?? [];
    list.push(item);
    byDate.set(item.sim_date, list);
  }

  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, maxDays)
    .map(([simDate, items]) => ({
      simDate,
      items: items.map((item) => ({
        id: item.id,
        headline: item.headline,
        sentiment: item.sentiment,
        severity: item.severity,
        scopeLabel: item.industry_name ?? "Market-wide",
      })),
    }));
}

import type { CompanyGridItem } from "@/lib/api/types";

export interface SectorStat {
  industry: string;
  avgChangePct: number;
  totalMarketCap: number;
  companyCount: number;
  companies: CompanyGridItem[];
}

export type InsightTone = "positive" | "negative" | "neutral" | "warning";

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
  sourceLabel: string;
}

export interface CalendarDay {
  simDate: string;
  items: {
    id: number;
    headline: string;
    sentiment: string;
    severity: number;
    scopeLabel: string;
  }[];
}

export interface WatchlistPreviewRow {
  companyId: number;
  ticker: string;
  name: string;
  price: number | null;
  dayChangePct: number | null;
}

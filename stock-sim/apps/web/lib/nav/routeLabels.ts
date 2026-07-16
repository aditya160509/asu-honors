import { formatTicker } from "@/lib/utils";

/** Shared route → label mapping, consumed by Breadcrumbs and the route-change activity logger. */
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  market: "Market",
  portfolio: "Portfolio",
  leaderboard: "Leaderboard",
  news: "News",
  simulation: "Simulation",
  admin: "Admin",
  companies: "Market",
  holdings: "Holdings",
  analytics: "Analytics",
  dividends: "Dividends",
  goals: "Goals",
  watchlists: "Watchlists",
  allocation: "Allocation",
  performance: "Performance",
  transactions: "Transactions",
};

/** Single "current page" label for a pathname — used by the activity logger. */
export function getPageLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];
  if (prev === "companies") return formatTicker(last);
  return ROUTE_LABELS[last] ?? last;
}

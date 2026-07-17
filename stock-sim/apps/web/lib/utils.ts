import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Prices — always 2 decimal places, $ prefix, thousands separators, minus before the $ for negatives. */
export function formatPrice(price: number | string | null | undefined): string {
  if (price == null) return "N/A";
  const num = Number(price);
  if (Number.isNaN(num)) return "N/A";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}$${abs}`;
}

/** Percentages — always show sign, 2 decimal places. */
export function formatPct(value: number | string | null | undefined): string {
  if (value == null) return "N/A";
  const num = Number(value);
  if (Number.isNaN(num)) return "N/A";
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

/** Large numbers — abbreviate with B/M/K; below that, same rules as formatPrice. */
export function formatLarge(value: number | string | null | undefined): string {
  if (value == null) return "N/A";
  const num = Number(value);
  if (Number.isNaN(num)) return "N/A";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const withSeparators = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 1e9) return `${sign}$${withSeparators(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${withSeparators(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return formatPrice(num);
}

/** Compact dates in tables — YYYY-MM-DD. */
export function formatDate(ts: number | string | null | undefined): string {
  if (ts == null) return "N/A";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toISOString().slice(0, 10);
}

/** Full date in headers — "July 11, 2026". */
export function formatDateFull(ts: number | string | null | undefined): string {
  if (ts == null) return "N/A";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Tickers — always uppercase. */
export function formatTicker(s: string | null | undefined): string {
  return (s ?? "").toUpperCase();
}

/** Marketing hero numbers — oversized display + suffix. Marketing surfaces only. */
export function formatHeroNumber(value: number): { display: string; suffix: string } {
  if (value >= 1000) return { display: (value / 1000).toFixed(1), suffix: "K" };
  return { display: value.toString(), suffix: "" };
}

export function trendFromValue(value: number | null | undefined): "up" | "down" | "neutral" {
  if (value == null || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
}

export function trendColorClass(value: number | null | undefined): string {
  const t = trendFromValue(value);
  if (t === "up") return "text-positive";
  if (t === "down") return "text-negative";
  return "text-neutral";
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#000';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

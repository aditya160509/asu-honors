"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ExternalLink, Star } from "lucide-react";
import { PriceChart } from "@/components/charts/PriceChart";
import { useCompany, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { useNews } from "@/lib/api/hooks/useNews";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface DetailPanelProps {
  ticker: string;
  watched: boolean;
  onToggleWatch: (ticker: string) => void;
  onClose: () => void;
  /** 52-week range lives on the market-grid row, not the company-detail
   * response — reuse what the table already fetched instead of a second call. */
  gridRow?: EnrichedCompany;
}

const BLOCKS = "▁▂▃▄▅▆▇█";

/** Text-drawn 52-week range slider — Bloomberg-style ASCII gauge instead of
 * a graphical progress bar, consistent with the all-mono terminal aesthetic. */
function RangeGauge({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (low == null || high == null || current == null || high <= low) {
    return <span className="text-[var(--term-ink-tertiary)]">—</span>;
  }
  const pct = Math.max(0, Math.min(1, (current - low) / (high - low)));
  const steps = 24;
  const filled = Math.round(pct * steps);
  const bar = Array.from({ length: steps }, (_, i) => (i < filled ? BLOCKS[Math.min(7, Math.floor(((i + 1) / steps) * 8))] : "·")).join("");
  return (
    <span className="tabular-nums">
      <span className="text-[var(--term-ink-tertiary)]">{formatPrice(low)} </span>
      <span className="text-[var(--term-accent)]">{bar}</span>
      <span className="text-[var(--term-ink-tertiary)]"> {formatPrice(high)}</span>
    </span>
  );
}

function Field({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">{label}</span>
      <span
        className={cn(
          "num text-right text-[13px] tabular-nums",
          tone === "up" ? "text-[var(--term-up)]" : tone === "down" ? "text-[var(--term-down)]" : "text-[var(--term-ink)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DetailPanel({ ticker, watched, onToggleWatch, onClose, gridRow }: DetailPanelProps) {
  const company = useCompany(ticker);
  const history = usePriceHistory(ticker);
  const valuation = useValuation(ticker);
  const news = useNews({ companyId: company.data?.id, limit: 3 });

  const price = company.data?.latest_price != null ? Number(company.data.latest_price) : null;
  const dayChangePct =
    history.data && history.data.length >= 2
      ? ((Number(history.data[history.data.length - 1].close) - Number(history.data[history.data.length - 2].close)) /
          Number(history.data[history.data.length - 2].close)) *
        100
      : null;
  const dayChangeAbs =
    history.data && history.data.length >= 2 && price != null
      ? price - Number(history.data[history.data.length - 2].close)
      : null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-l border-[var(--term-hairline)] bg-[var(--term-bg)] font-mono">
      <div className="flex items-center justify-between border-b border-[var(--term-divider)] px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-[var(--term-ink)]">{ticker}</span>
          <span className="truncate text-[12px] text-[var(--term-ink-secondary)]" style={{ fontFamily: "var(--font-sans)" }}>
            {company.data?.name ?? "…"}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close detail panel (Esc)" className="text-[11px] uppercase text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink)]">
          Esc ×
        </button>
      </div>

      <div className="border-b border-[var(--term-hairline)] px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[20px] font-semibold tabular-nums text-[var(--term-ink)]">{price != null ? formatPrice(price) : "—"}</span>
          {dayChangePct != null && (
            <span className={cn("tabular-nums text-[13px]", dayChangePct >= 0 ? "text-[var(--term-up)]" : "text-[var(--term-down)]")}>
              {dayChangePct >= 0 ? "▲" : "▼"} {formatPct(dayChangePct)}
            </span>
          )}
        </div>
      </div>

      <div className="h-44 border-b border-[var(--term-hairline)] px-2">
        <PriceChart data={history.data ?? []} loading={history.isLoading} error={history.isError} onRetry={() => history.refetch()} ticker={ticker} height={176} />
      </div>

      <div className="border-b border-[var(--term-hairline)] px-4 py-2">
        <Field label="Price" value={price != null ? formatPrice(price) : "—"} />
        <Field label="Chg" value={dayChangeAbs != null ? formatPrice(dayChangeAbs) : "—"} tone={dayChangeAbs != null ? (dayChangeAbs >= 0 ? "up" : "down") : undefined} />
        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Range 52W</span>
          <RangeGauge low={gridRow?.low_52w != null ? Number(gridRow.low_52w) : null} high={gridRow?.high_52w != null ? Number(gridRow.high_52w) : null} current={price} />
        </div>
        <Field label="Mkt Cap" value={formatLarge(company.data?.market_cap ?? null)} />
        <Field label="P/E" value={company.data?.pe_ratio != null ? Number(company.data.pe_ratio).toFixed(2) : "—"} />
        <Field
          label="IV Gap"
          value={
            company.data?.latest_iv && Number(company.data.latest_iv) > 0 && price != null
              ? formatPct(((price - Number(company.data.latest_iv)) / Number(company.data.latest_iv)) * 100)
              : "—"
          }
        />
        <Field label="Intr Val" value={formatPrice(company.data?.latest_iv ?? null)} />
        {valuation.data && (
          <>
            <Field label="Intr Score" value={valuation.data.intrinsic_score.toFixed(1)} />
            <Field label="Moat" value={valuation.data.moat_score.toFixed(1)} />
          </>
        )}
      </div>

      <div className="flex-1 border-b border-[var(--term-hairline)] px-4 py-2">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">News</div>
        {news.isLoading ? (
          <div className="text-[12px] text-[var(--term-ink-tertiary)]">…</div>
        ) : news.data && news.data.length > 0 ? (
          <div className="flex flex-col gap-2">
            {news.data.map((n) => (
              <div key={n.id} className="text-[12px] leading-snug" style={{ fontFamily: "var(--font-sans)" }}>
                <span className="text-[var(--term-ink-tertiary)]">{n.sim_date} </span>
                <span className="text-[var(--term-ink-secondary)]">{n.headline}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--term-ink-tertiary)]">No news yet.</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Link
          href={`/companies/${ticker}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-sm border border-[var(--term-divider)] text-[13px] font-medium text-[var(--term-ink)] transition-colors hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]"
        >
          <ExternalLink size={15} />
          Open Full
        </Link>
        <button
          type="button"
          onClick={() => onToggleWatch(ticker)}
          aria-pressed={watched}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-sm border text-[13px] font-medium transition-colors",
            watched
              ? "border-[var(--term-amber)] bg-[var(--term-amber)]/10 text-[var(--term-amber)]"
              : "border-[var(--term-divider)] text-[var(--term-ink)] hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]"
          )}
        >
          <Star size={15} fill={watched ? "currentColor" : "none"} />
          {watched ? "Watching" : "Watch"}
        </button>
        <button
          type="button"
          disabled
          title="Price alerts are coming soon"
          className="flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-sm border border-[var(--term-divider)] text-[13px] font-medium text-[var(--term-ink-tertiary)] opacity-50"
        >
          <Bell size={15} />
          Alert
        </button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { scaleIn } from "@/lib/motion";
import type { EnrichedCompany } from "@/lib/market/types";

export interface CompareDrawerProps {
  open: boolean;
  onClose: () => void;
  tickers: string[];
  companies: EnrichedCompany[];
  onRemove: (ticker: string) => void;
}

interface MetricRow {
  label: string;
  render: (c: EnrichedCompany) => React.ReactNode;
  best?: (c: EnrichedCompany) => number | null;
}

const METRICS: MetricRow[] = [
  {
    label: "Price",
    render: (c) => formatPrice(c.current_price),
  },
  {
    label: "Day Change",
    render: (c) =>
      c.day_change_pct == null ? (
        "N/A"
      ) : (
        <span className={cn("flex items-center justify-end gap-0.5", Number(c.day_change_pct) >= 0 ? "text-positive" : "text-negative")}>
          {Number(c.day_change_pct) >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {formatPct(c.day_change_pct)}
        </span>
      ),
    best: (c) => (c.day_change_pct == null ? null : Number(c.day_change_pct)),
  },
  { label: "Market Cap", render: (c) => formatLarge(c.market_cap), best: (c) => (c.market_cap == null ? null : Number(c.market_cap)) },
  {
    label: "Volatility",
    render: (c) => (c.volatility == null ? "N/A" : `${Number(c.volatility).toFixed(2)}%`),
    best: (c) => (c.volatility == null ? null : -Number(c.volatility)),
  },
  {
    label: "IV Gap %",
    render: (c) =>
      c.ivGapPct == null ? (
        "N/A"
      ) : (
        <span className={c.ivGapPct < 0 ? "text-positive" : c.ivGapPct > 0 ? "text-negative" : "text-neutral"}>
          {formatPct(c.ivGapPct)}
        </span>
      ),
    best: (c) => (c.ivGapPct == null ? null : -c.ivGapPct),
  },
  { label: "Industry", render: (c) => c.industry_name },
];

export function CompareDrawer({ open, onClose, tickers, companies, onRemove }: CompareDrawerProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const selected = tickers.map((t) => companies.find((c) => c.ticker === t)).filter((c): c is EnrichedCompany => Boolean(c));

  React.useEffect(() => {
    if (open && contentRef.current) scaleIn(contentRef.current);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[900px] w-[92vw] p-0 gap-0">
        <div ref={contentRef}>
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <DialogTitle className="mb-0 text-h3 font-semibold">Compare companies</DialogTitle>
          </div>

          {selected.length === 0 ? (
            <div className="px-5 py-10 text-center text-small text-text-secondary">
              Select up to 4 companies from the table to compare them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="w-32 px-5 py-2.5 text-left text-micro font-medium uppercase tracking-wide text-text-secondary">
                      Metric
                    </th>
                    {selected.map((c) => (
                      <th key={c.ticker} className="min-w-[160px] px-4 py-2.5 text-right align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-left">
                            <Link href={`/companies/${c.ticker}`} className="num block truncate font-bold uppercase text-text-primary hover:text-accent">
                              {c.ticker}
                            </Link>
                            <span className="block truncate text-micro font-normal normal-case text-text-tertiary">{c.name}</span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${c.ticker} from comparison`}
                            onClick={() => onRemove(c.ticker)}
                            className="shrink-0 text-text-tertiary hover:text-negative"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((metric) => {
                    const values = metric.best ? selected.map((c) => metric.best!(c)) : [];
                    const bestValue = metric.best && values.some((v) => v != null) ? Math.max(...values.filter((v): v is number => v != null)) : null;
                    return (
                      <tr key={metric.label} className="border-b border-border/60 last:border-b-0">
                        <td className="px-5 py-2 text-small text-text-secondary">{metric.label}</td>
                        {selected.map((c) => {
                          const isBest = metric.best && bestValue != null && metric.best(c) === bestValue;
                          return (
                            <td
                              key={c.ticker}
                              className={cn(
                                "num px-4 py-2 text-right text-body",
                                isBest && "bg-positive-dim/25 font-semibold"
                              )}
                            >
                              {metric.render(c)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

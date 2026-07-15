"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowDown, Star } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PriceChart } from "@/components/charts/PriceChart";
import { useCompany, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { panelSlideIn } from "@/lib/motion";

export interface PreviewDrawerProps {
  ticker: string | null;
  onClose: () => void;
  watched: boolean;
  onToggleWatch: (ticker: string) => void;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-small text-text-secondary">{label}</span>
      <span className="num text-body text-text-primary">{value}</span>
    </div>
  );
}

export function PreviewDrawer({ ticker, onClose, watched, onToggleWatch }: PreviewDrawerProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const company = useCompany(ticker ?? "");
  const history = usePriceHistory(ticker ?? "");
  const valuation = useValuation(ticker ?? "");

  React.useEffect(() => {
    if (ticker && contentRef.current) {
      panelSlideIn(contentRef.current, "x", 16);
    }
  }, [ticker]);

  const price = company.data?.latest_price != null ? Number(company.data.latest_price) : null;
  const dayChangePct =
    history.data && history.data.length >= 2
      ? ((Number(history.data[history.data.length - 1].close) - Number(history.data[history.data.length - 2].close)) /
          Number(history.data[history.data.length - 2].close)) *
        100
      : null;

  return (
    <Drawer open={ticker != null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent side="right" className="w-full max-w-[440px] gap-0 p-0">
        <div ref={contentRef} className="flex h-full flex-col">
          {ticker && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border py-4 pl-5 pr-9">
                <div className="min-w-0">
                  <DrawerTitle className="num mb-0 flex items-center gap-2 text-h3 font-bold uppercase">
                    {ticker}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                      onClick={() => onToggleWatch(ticker)}
                    >
                      <Star size={14} fill={watched ? "currentColor" : "none"} className={watched ? "text-warning" : "text-text-tertiary"} />
                    </Button>
                  </DrawerTitle>
                  <p className="truncate text-small text-text-secondary">{company.data?.name ?? "Loading…"}</p>
                </div>
                {company.data && (
                  <Badge variant="default" className="shrink-0">
                    {company.data.industry_name}
                  </Badge>
                )}
              </div>

              <div className="flex items-baseline gap-2 px-5 pt-4">
                <span className="num text-h1 font-semibold text-text-primary">
                  {price != null ? formatPrice(price) : "—"}
                </span>
                {dayChangePct != null && (
                  <span
                    className={cn(
                      "num flex items-center gap-0.5 text-body font-medium",
                      dayChangePct >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {dayChangePct >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    {formatPct(dayChangePct)}
                  </span>
                )}
              </div>

              <div className="px-2 pt-3">
                <PriceChart
                  data={history.data ?? []}
                  loading={history.isLoading}
                  error={history.isError}
                  onRetry={() => history.refetch()}
                  ticker={ticker}
                  height={200}
                />
              </div>

              <Separator className="mt-3" />

              <div className="flex-1 overflow-y-auto px-5 py-3">
                <div className="text-micro font-medium uppercase text-text-tertiary">Key stats</div>
                <div className="mt-1">
                  <StatRow label="Market cap" value={formatLarge(company.data?.market_cap ?? null)} />
                  <StatRow label="P/E ratio" value={company.data?.pe_ratio != null ? Number(company.data.pe_ratio).toFixed(2) : "N/A"} />
                  <StatRow label="Intrinsic value" value={formatPrice(company.data?.latest_iv ?? null)} />
                  {valuation.data && (
                    <>
                      <StatRow label="Intrinsic score" value={valuation.data.intrinsic_score.toFixed(1)} />
                      <StatRow label="Moat score" value={valuation.data.moat_score.toFixed(1)} />
                      <StatRow label="Growth potential" value={valuation.data.growth_potential.toFixed(1)} />
                    </>
                  )}
                </div>

                {company.data?.description && (
                  <>
                    <div className="mt-4 text-micro font-medium uppercase text-text-tertiary">About</div>
                    <p className="mt-1.5 text-small leading-relaxed text-text-secondary">{company.data.description}</p>
                  </>
                )}
              </div>

              <div className="border-t border-border px-5 py-3">
                <Button asChild variant="secondary" className="w-full justify-center gap-1.5">
                  <Link href={`/companies/${ticker}`}>
                    Open full profile
                    <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

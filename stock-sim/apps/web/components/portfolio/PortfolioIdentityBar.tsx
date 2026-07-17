"use client";

import * as React from "react";
import { LiveDot } from "@/components/dashboard/primitives/LiveDot";
import { usePortfolio, usePortfolioAnalytics, useTransactions } from "@/lib/api/hooks/usePortfolio";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { usePortfolioHeader } from "@/components/portfolio/PortfolioHeaderContext";
import { useAnimatedCounter } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPrice } from "@/lib/utils";

const barStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--mer-surface-2) 0%, var(--mer-surface-3) 100%)",
  borderBottom: "1px solid var(--mer-stroke-hairline)",
};

const glowStyle: React.CSSProperties = {
  textShadow: "0 0 40px rgba(62, 111, 224, 0.15), 0 0 80px rgba(62, 111, 224, 0.06)",
};

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: "9999px",
  padding: "4px 12px",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  lineHeight: "1rem",
  letterSpacing: "0.02em",
};

const pillPositive: React.CSSProperties = {
  ...pillBase,
  backgroundColor: "rgba(34, 197, 94, 0.12)",
  color: "var(--positive)",
  border: "1px solid rgba(34, 197, 94, 0.2)",
};

const pillNegative: React.CSSProperties = {
  ...pillBase,
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  color: "var(--negative)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
};

const marketBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "var(--mer-radius-sm)",
  border: "1px solid var(--mer-stroke-hairline)",
  backgroundColor: "var(--mer-surface-3)",
  color: "var(--mer-ink-secondary)",
  padding: "6px 14px",
  fontSize: "var(--fs-micro)",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const secondaryStat: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "12px",
  fontSize: "var(--fs-small)",
  fontFamily: "var(--font-mono)",
  color: "var(--mer-ink-secondary)",
  marginTop: "2px",
};

export function PortfolioIdentityBar() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const transactions = useTransactions(undefined, 1);
  const sim = useSimState();
  const { rangeDelta } = usePortfolioHeader();

  const totalValue = portfolio.data ? Number(portfolio.data.total_value) : 0;
  const display = useAnimatedCounter(totalValue, formatPrice);

  const isBrandNew =
    !portfolio.isLoading &&
    (portfolio.data?.holdings.length ?? 0) === 0 &&
    (transactions.data?.length ?? 0) === 0;

  const delta = rangeDelta ?? {
    label: "since inception",
    deltaValue: analytics.data ? Number(analytics.data.total_value) - totalReturnBase(analytics.data.total_value, analytics.data.total_return_pct) : 0,
    deltaPct: analytics.data?.total_return_pct ?? 0,
  };
  const deltaPositive = delta.deltaPct >= 0;

  const totalReturnPct = analytics.data?.total_return_pct ?? 0;
  const totalReturnPositive = totalReturnPct >= 0;

  return (
    <div style={barStyle} className="flex flex-wrap items-end justify-between gap-6 pb-5 pt-1">
      <div className="flex flex-col gap-1.5">
        <span
          className="font-medium uppercase tracking-wide"
          style={{ fontSize: "var(--fs-micro)", color: "var(--mer-ink-tertiary)", letterSpacing: "0.1em" }}
        >
          Portfolio
        </span>

        {portfolio.isLoading ? (
          <Skeleton width={320} height={52} />
        ) : (
          <span
            className="num font-semibold leading-none"
            style={{
              fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
              color: "var(--mer-ink-primary)",
              fontFamily: "var(--font-mono)",
              ...glowStyle,
            }}
          >
            {display}
          </span>
        )}

        {!portfolio.isLoading && !isBrandNew && analytics.data && (
          <div style={secondaryStat}>
            <span style={{ color: deltaPositive ? "var(--positive)" : "var(--negative)" }}>
              <span style={{ fontSize: "0.65em", marginRight: "2px" }}>{deltaPositive ? "▲" : "▼"}</span>
              {deltaPositive ? "+" : "−"}
              {formatPrice(Math.abs(delta.deltaValue))}
              <span style={{ opacity: 0.7, marginLeft: "4px" }}>
                ({deltaPositive ? "+" : "−"}{Math.abs(delta.deltaPct).toFixed(2)}%)
              </span>
            </span>
            <span style={{ color: "var(--mer-ink-tertiary)", fontFamily: "var(--font-sans)", fontWeight: 400 }}>
              {delta.label}
            </span>

            {!isBrandNew && totalReturnPct !== 0 && rangeDelta == null && (
              <>
                <span style={{ color: "var(--mer-stroke-emphasis)", fontWeight: 300 }}>|</span>
                <span style={{ color: totalReturnPositive ? "var(--positive)" : "var(--negative)", opacity: 0.8 }}>
                  Total: {totalReturnPositive ? "+" : "−"}{Math.abs(totalReturnPct).toFixed(2)}%
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pb-1.5">
        <span style={marketBadge}>
          <LiveDot color={sim.data?.is_running ? "positive" : "warning"} />
          {sim.data?.is_running ? "Market Live" : "Market Paused"}
        </span>
      </div>
    </div>
  );
}

function totalReturnBase(totalValue: number | string, returnPct: number): number {
  const total = Number(totalValue);
  if (returnPct === -100) return total;
  return total / (1 + returnPct / 100);
}

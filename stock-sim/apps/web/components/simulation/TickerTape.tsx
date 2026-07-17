"use client";

import * as React from "react";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { formatPrice } from "@/lib/utils";
import type { CompanyGridItem } from "@/lib/api/types";

export interface TickerTapeProps {
  onSelectTicker?: (ticker: string) => void;
  selectedTicker?: string;
}

export function TickerTape({ onSelectTicker, selectedTicker }: TickerTapeProps) {
  const { data: simState } = useSimState();
  const { data: grid } = useMarketGrid(simState?.timeline_id);

  const topStocks = React.useMemo(() => {
    if (!grid?.companies) return [];
    return [...grid.companies]
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
      .slice(0, 20);
  }, [grid?.companies]);

  if (topStocks.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--mer-surface-1)",
        borderBottom: "1px solid var(--mer-stroke-hairline)",
        height: 32,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          animation: "ticker 40s linear infinite",
          width: "max-content",
        }}
      >
        {[...topStocks, ...topStocks].map((company, i) => (
          <TickerItem
            key={`${company.ticker}-${i}`}
            company={company}
            isSelected={company.ticker === selectedTicker}
            onSelect={onSelectTicker}
          />
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function TickerItem({
  company,
  isSelected,
  onSelect,
}: {
  company: CompanyGridItem;
  isSelected: boolean;
  onSelect?: (ticker: string) => void;
}) {
  const change = company.day_change_pct ?? 0;
  const isPositive = change >= 0;

  return (
    <button
      onClick={() => onSelect?.(company.ticker)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 16px",
        height: "100%",
        borderRight: "1px solid var(--mer-stroke-hairline)",
        background: isSelected ? "var(--mer-surface-2)" : "transparent",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background 120ms",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "var(--mer-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-small)",
          fontWeight: 600,
          color: "var(--mer-ink-primary)",
        }}
      >
        {company.ticker}
      </span>
      <span
        className="num"
        style={{
          fontSize: "var(--fs-small)",
          color: "var(--mer-ink-primary)",
        }}
      >
        {formatPrice(company.current_price)}
      </span>
      <span
        className="num"
        style={{
          fontSize: "var(--fs-micro)",
          color: isPositive ? "var(--positive)" : "var(--negative)",
          fontWeight: 500,
        }}
      >
        {isPositive ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    </button>
  );
}

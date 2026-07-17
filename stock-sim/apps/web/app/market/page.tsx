"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { MarketExplorer } from "@/components/market/MarketExplorer";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";

// Bloomberg-terminal rebuild: no title block, no breadcrumb-adjacent chrome
// above the screener itself — the Command Line + Status Line (66px total)
// are the only chrome above the column headers, per the terminal spec's
// "density is fine, chrome is not" principle.
export default function MarketPage() {
  const { data, isLoading, isError, refetch } = useMarketGrid();

  return (
    <TerminalShell noPadding>
      <MarketExplorer
        companies={data?.companies ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
      />
    </TerminalShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { VirtualGrid } from "@/lib/grid/VirtualGrid";
import type { GridColumn } from "@/lib/grid/types";
import type { HoldingResponse } from "@/lib/api/types";

export interface HoldingsTableProps {
  holdings: HoldingResponse[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const COLUMNS: GridColumn<HoldingResponse>[] = [
  { key: "ticker", header: "Ticker", width: 80, format: "ticker", sortable: true, pin: "left" },
  { key: "company_name", header: "Name", width: "grow", format: "text", sortable: true },
  { key: "quantity", header: "Qty", width: 60, align: "right", format: "text", sortable: true },
  { key: "avg_cost_basis", header: "Avg Cost", width: 90, align: "right", format: "price", sortable: true },
  { key: "current_price", header: "Current Price", width: 100, align: "right", format: "price", sortable: true },
  { key: "market_value", header: "Market Value", width: 100, align: "right", format: "large", sortable: true },
  { key: "unrealized_pnl", header: "Unrealized PnL", width: 110, align: "right", format: "price", sortable: true },
  { key: "unrealized_pnl_pct", header: "PnL %", width: 80, align: "right", format: "pct", sortable: true },
];

export function HoldingsTable({ holdings, loading, error, onRetry }: HoldingsTableProps) {
  const router = useRouter();

  return (
    <VirtualGrid
      data={holdings}
      columns={COLUMNS}
      rowHeight={36}
      height={Math.min(480, Math.max(160, holdings.length * 36 + 40))}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No holdings yet."
      emptyDescription="Start trading on the market page."
      errorMessage="Could not load holdings."
      getRowId={(row) => row.ticker}
      onRowClick={(row) => router.push(`/companies/${row.ticker}`)}
    />
  );
}

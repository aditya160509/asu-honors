"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VirtualGrid } from "@/lib/grid/VirtualGrid";
import type { GridColumn } from "@/lib/grid/types";
import { useGridFilter } from "@/lib/grid/useGridFilter";
import type { CompanyGridItem } from "@/lib/api/types";

export interface MarketGridProps {
  companies: CompanyGridItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const COLUMNS: GridColumn<CompanyGridItem>[] = [
  { key: "ticker", header: "Ticker", width: 80, format: "ticker", sortable: true, pin: "left" },
  { key: "name", header: "Name", width: "grow", format: "text", sortable: true },
  { key: "industry_name", header: "Industry", width: 130, format: "badge", sortable: true },
  { key: "current_price", header: "Price", width: 100, align: "right", format: "price", sortable: true },
  { key: "day_change_pct", header: "Day Chg", width: 90, align: "right", format: "pct", sortable: true, heatCap: 5 },
  {
    key: "iv_gap_pct",
    header: "IV Gap %",
    width: 90,
    align: "right",
    format: "pct",
    sortable: true,
    accessor: (row) =>
      row.intrinsic_value && Number(row.intrinsic_value) > 0
        ? ((Number(row.current_price) - Number(row.intrinsic_value)) / Number(row.intrinsic_value)) * 100
        : null,
  },
  { key: "market_cap", header: "Mcap", width: 100, align: "right", format: "large", sortable: true },
  { key: "volatility", header: "Volatility", width: 90, align: "right", format: "pct", sortable: true },
];

export function MarketGrid({ companies, loading, error, onRetry }: MarketGridProps) {
  const router = useRouter();
  const { filteredData, query, setSearch } = useGridFilter(companies, (row, q) => {
    const t = row.ticker.toLowerCase();
    return t.startsWith(q.toLowerCase()) || row.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Input
            placeholder="Search ticker or name…"
            value={query}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter companies"
          />
          {query && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              aria-label="Clear filter"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {query && (
          <span className="text-small text-text-secondary">
            Showing {filteredData.length} of {companies.length} results
          </span>
        )}
      </div>
      <VirtualGrid
        data={filteredData}
        columns={COLUMNS}
        getRowId={(row) => row.ticker}
        onRowClick={(row) => router.push(`/companies/${row.ticker}`)}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyTitle="No companies loaded."
        emptyDescription="Run seed data first."
        errorMessage="Could not load market data."
        height={720}
      />
    </div>
  );
}

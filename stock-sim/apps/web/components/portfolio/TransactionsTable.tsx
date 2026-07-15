"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, ReceiptText } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/lib/api/hooks/usePortfolio";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { cn, formatPrice } from "@/lib/utils";
import type { TransactionFilters, TransactionItem } from "@/lib/api/types";

const PAGE_SIZE = 50;
type SideFilter = "all" | "buy" | "sell";

const SIDE_OPTIONS: { value: SideFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];

function toCsv(rows: TransactionItem[]): string {
  const header = "date,ticker,side,quantity,price,fees,total,realized_pnl";
  const lines = rows.map((t) => {
    const total = t.quantity * Number(t.price) + (t.side === "buy" ? 1 : -1) * Number(t.fees);
    return [
      t.sim_date,
      t.ticker,
      t.side,
      t.quantity,
      Number(t.price).toFixed(4),
      Number(t.fees).toFixed(4),
      total.toFixed(4),
      t.realized_pnl != null ? Number(t.realized_pnl).toFixed(4) : "",
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

function downloadCsv(rows: TransactionItem[]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** C2 — Transactions: server-side-filtered trade ledger with client CSV export.
 * Side badges are deliberately neutral (side is not a price direction); only
 * Realized P&L carries market color. Status is always "Filled" — historical
 * transactions are by definition completed (Trading Desk is Phase 3). */
export function TransactionsTable() {
  const router = useRouter();
  const [side, setSide] = React.useState<SideFilter>("all");
  const [tickerInput, setTickerInput] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const ticker = useDebouncedValue(tickerInput.trim().toUpperCase(), 300);

  const filters: TransactionFilters = React.useMemo(
    () => ({
      side: side === "all" ? undefined : side,
      ticker: ticker || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [side, ticker, dateFrom, dateTo]
  );

  const transactions = useTransactions(undefined, limit, 0, filters);
  const rows = transactions.data ?? [];
  const hasFilters = side !== "all" || !!ticker || !!dateFrom || !!dateTo;

  return (
    <DashboardPanel
      eyebrow="Trade Ledger"
      title="Transactions"
      icon={ReceiptText}
      noBodyPadding
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          aria-label="Export visible transactions as CSV"
        >
          <Download size={13} className="mr-1" /> Export CSV
        </Button>
      }
    >
      <div className={cn("flex flex-wrap items-center gap-3 border-b px-4 py-2.5", MER_HAIRLINE)}>
        <RangeSelector options={SIDE_OPTIONS} value={side} onChange={setSide} />
        <Input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value)}
          placeholder="Filter by ticker…"
          className="num h-7 w-40 uppercase"
          aria-label="Filter by ticker"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="num h-7 w-36"
            aria-label="From date"
          />
          <span className="text-micro text-mer-ink-tertiary">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="num h-7 w-36"
            aria-label="To date"
          />
        </div>
      </div>

      {transactions.isLoading ? (
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={32} />
          ))}
        </div>
      ) : transactions.isError ? (
        <div className="p-4">
          <ErrorState message="Could not load transactions." onRetry={() => transactions.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={hasFilters ? "No transactions match these filters" : "No transactions yet"}
            description={hasFilters ? "Try widening the date range or clearing the ticker filter." : "Your trade history will show up here."}
            action={hasFilters ? undefined : { label: "Explore the market", onClick: () => router.push("/market") }}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className={cn("border-b bg-mer-surface-3 text-left", MER_HAIRLINE)}>
                <Th>Date</Th>
                <Th>Ticker</Th>
                <Th>Side</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Price</Th>
                <Th align="right">Fees</Th>
                <Th align="right">Total</Th>
                <Th align="right">Realized P&L</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const total = t.quantity * Number(t.price) + (t.side === "buy" ? 1 : -1) * Number(t.fees);
                const pnl = t.realized_pnl != null ? Number(t.realized_pnl) : null;
                return (
                  <tr key={t.id} className={cn("h-10 border-b transition-colors hover:bg-mer-surface-3", MER_HAIRLINE)}>
                    <td className="num whitespace-nowrap px-3 text-micro text-mer-ink-tertiary">{t.sim_date}</td>
                    <td className="px-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/companies/${t.ticker}`)}
                        className="num text-small font-bold uppercase text-mer-ink-primary hover:text-mer-accent-500"
                      >
                        {t.ticker}
                      </button>
                    </td>
                    <td className="px-3">
                      <span className="rounded-mer-xs bg-mer-surface-3 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-mer-ink-secondary">
                        {t.side}
                      </span>
                    </td>
                    <td className="num px-3 text-right text-small text-mer-ink-primary">{t.quantity.toLocaleString()}</td>
                    <td className="num px-3 text-right text-small text-mer-ink-secondary">{formatPrice(t.price)}</td>
                    <td className="num px-3 text-right text-small text-mer-ink-tertiary">{formatPrice(t.fees)}</td>
                    <td className="num px-3 text-right text-small font-medium text-mer-ink-primary">{formatPrice(total)}</td>
                    <td
                      className={cn(
                        "num px-3 text-right text-small font-medium",
                        pnl == null ? "text-mer-ink-tertiary" : pnl >= 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {pnl == null ? "—" : `${pnl >= 0 ? "+" : "−"}${formatPrice(Math.abs(pnl))}`}
                    </td>
                    <td className="px-3">
                      <span className="rounded-mer-xs bg-mer-surface-3 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-mer-ink-secondary">
                        Filled
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length >= limit && (
            <div className="flex justify-center border-t p-2.5" style={{ borderColor: "var(--mer-stroke-hairline)" }}>
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </DashboardPanel>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

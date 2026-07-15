"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioDividends } from "@/lib/api/hooks/usePortfolio";
import { cn, formatPrice } from "@/lib/utils";
import type { UpcomingDividend } from "@/lib/api/types";

/** C6 — Dividend tracker: summary metrics, the named ex-date-timeline pattern
 * for upcoming dividends (amount chips on a hairline), and the received list. */
export function DividendsPanel() {
  const router = useRouter();
  const dividends = usePortfolioDividends();

  if (dividends.isError) {
    return (
      <DashboardPanel eyebrow="Dividends" title="Dividend History" icon={Coins}>
        <ErrorState message="Could not load dividends." onRetry={() => dividends.refetch()} />
      </DashboardPanel>
    );
  }

  const data = dividends.data;
  const loading = dividends.isLoading;
  const isEmpty = !loading && data != null && data.received.length === 0 && data.upcoming.length === 0;

  if (isEmpty) {
    return (
      <DashboardPanel eyebrow="Dividends" title="Dividend History" icon={Coins}>
        <EmptyState
          title="No dividend activity yet"
          description="Dividends from your holdings will appear here as they're paid."
          action={{ label: "Explore the market", onClick: () => router.push("/market") }}
        />
      </DashboardPanel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard label="Total received (all time)" value={data?.total_received} loading={loading} />
        <SummaryCard label="Trailing 12 months" value={data?.trailing_12m_received} loading={loading} />
      </div>

      <DashboardPanel eyebrow="Upcoming" title="Declared Dividends" icon={Coins} noBodyPadding>
        {loading ? (
          <div className="p-4">
            <Skeleton height={72} className="w-full" />
          </div>
        ) : (data?.upcoming.length ?? 0) === 0 ? (
          <p className="p-4 text-small text-mer-ink-tertiary">No declared upcoming dividends for your current holdings.</p>
        ) : (
          <UpcomingTimeline upcoming={data!.upcoming} />
        )}
      </DashboardPanel>

      <DashboardPanel eyebrow="Received" title="Dividend Receipts" icon={Coins} noBodyPadding>
        {loading ? (
          <div className="flex flex-col gap-1.5 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={32} />
            ))}
          </div>
        ) : (data?.received.length ?? 0) === 0 ? (
          <p className="p-4 text-small text-mer-ink-tertiary">Nothing received yet — your first receipt appears after an ex-date passes while you hold the shares.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr className={cn("border-b bg-mer-surface-3 text-left", MER_HAIRLINE)}>
                  <Th>Ticker</Th>
                  <Th>Ex-Date</Th>
                  <Th>Payment</Th>
                  <Th align="right">Per Share</Th>
                  <Th align="right">Shares Held</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {data!.received.map((r) => (
                  <tr key={`${r.ticker}-${r.ex_date}`} className={cn("h-10 border-b transition-colors hover:bg-mer-surface-3", MER_HAIRLINE)}>
                    <td className="px-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/companies/${r.ticker}`)}
                        className="num text-small font-bold uppercase text-mer-ink-primary hover:text-mer-accent-500"
                      >
                        {r.ticker}
                      </button>
                    </td>
                    <td className="num px-3 text-micro text-mer-ink-tertiary">{r.ex_date}</td>
                    <td className="num px-3 text-micro text-mer-ink-tertiary">{r.payment_date}</td>
                    <td className="num px-3 text-right text-small text-mer-ink-secondary">{formatPrice(r.amount_per_share)}</td>
                    <td className="num px-3 text-right text-small text-mer-ink-secondary">{r.shares_held.toLocaleString()}</td>
                    <td className="num px-3 text-right text-small font-medium text-mer-ink-primary">{formatPrice(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className={cn("mer-surface-lit flex flex-col gap-2 rounded-mer-md border bg-mer-surface-2 p-4 shadow-mer-rest", MER_HAIRLINE)}>
      <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">{label}</span>
      {loading ? (
        <Skeleton width={110} height={30} />
      ) : (
        <span className="num text-[1.75rem] font-medium leading-8 text-mer-ink-primary">{formatPrice(value ?? 0)}</span>
      )}
    </div>
  );
}

/** Ex-date timeline on a hairline with muted amount chips (not yet realized). */
function UpcomingTimeline({ upcoming }: { upcoming: UpcomingDividend[] }) {
  const dates = upcoming.map((u) => new Date(u.ex_date).getTime());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const span = max - min || 1;

  return (
    <div className="px-6 py-8">
      <div className="relative h-px w-full bg-[color:var(--mer-stroke-emphasis)]">
        {upcoming.map((u, i) => {
          const leftPct = ((new Date(u.ex_date).getTime() - min) / span) * 100;
          return (
            <Tooltip key={`${u.ticker}-${u.ex_date}`}>
              <TooltipTrigger asChild>
                <div
                  className="absolute -translate-x-1/2 cursor-default"
                  style={{ left: `${Math.min(Math.max(leftPct, 2), 98)}%`, top: i % 2 === 0 ? "-2.4rem" : "0.6rem" }}
                >
                  <span className={cn("flex flex-col items-center gap-0.5 rounded-mer-xs border bg-mer-surface-3 px-2 py-1 opacity-80", MER_HAIRLINE)}>
                    <span className="num text-micro font-bold uppercase text-mer-ink-secondary">{u.ticker}</span>
                    <span className="num text-micro text-mer-ink-tertiary">{formatPrice(u.estimated_total)}</span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {u.ticker} · ex {u.ex_date} · pays {u.payment_date} · {formatPrice(u.amount_per_share)}/sh × {u.shares_held}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {upcoming.map((u) => {
          const leftPct = ((new Date(u.ex_date).getTime() - min) / span) * 100;
          return (
            <span
              key={`dot-${u.ticker}-${u.ex_date}`}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mer-accent-500"
              style={{ left: `${Math.min(Math.max(leftPct, 2), 98)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn("px-3 py-2 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary", align === "right" && "text-right")}>
      {children}
    </th>
  );
}

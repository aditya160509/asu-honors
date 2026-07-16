"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, X } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders, useCancelOrder } from "@/lib/api/hooks/useOrders";
import { cn, formatPrice } from "@/lib/utils";
import type { OrderStatus } from "@/lib/api/types";

type StatusFilter = OrderStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "filled", label: "Filled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

/** Phase 3 — Trading Desk: Open/Filled/Cancelled are all one endpoint with a status
 * filter (GET /orders?status=), same "one query shape, not four endpoints" pattern
 * used by the Transactions ledger. */
export function OrdersPanel() {
  const router = useRouter();
  const [status, setStatus] = React.useState<StatusFilter>("open");
  const orders = useOrders(status === "all" ? undefined : status);
  const cancelOrder = useCancelOrder();
  const rows = orders.data ?? [];

  return (
    <DashboardPanel eyebrow="Order Lifecycle" title="Orders" icon={ListOrdered} noBodyPadding>
      <div className={cn("flex items-center gap-3 border-b px-4 py-2.5", MER_HAIRLINE)}>
        <RangeSelector options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>

      {orders.isLoading ? (
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={32} />
          ))}
        </div>
      ) : orders.isError ? (
        <div className="p-4">
          <ErrorState message="Could not load orders." onRetry={() => orders.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={status === "open" ? "No open orders" : "No orders yet"}
            description={
              status === "open"
                ? "Orders you place will show here until they fill or you cancel them."
                : "Place a trade from the ticket to see it here."
            }
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
                <Th>Type</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Limit</Th>
                <Th align="right">Fill Price</Th>
                <Th>Status</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={cn("h-10 border-b transition-colors hover:bg-mer-surface-3", MER_HAIRLINE)}>
                  <td className="num whitespace-nowrap px-3 text-micro text-mer-ink-tertiary">{o.sim_date}</td>
                  <td className="px-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/companies/${o.ticker}`)}
                      className="num text-small font-bold uppercase text-mer-ink-primary hover:text-mer-accent-500"
                    >
                      {o.ticker}
                    </button>
                  </td>
                  <td className="px-3">
                    <span className="rounded-mer-xs bg-mer-surface-3 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-mer-ink-secondary">
                      {o.side}
                    </span>
                  </td>
                  <td className="px-3 text-small text-mer-ink-secondary">{o.order_type === "limit" ? "Limit" : "Market"}</td>
                  <td className="num px-3 text-right text-small text-mer-ink-primary">{o.quantity.toLocaleString()}</td>
                  <td className="num px-3 text-right text-small text-mer-ink-secondary">
                    {o.limit_price != null ? formatPrice(o.limit_price) : "—"}
                  </td>
                  <td className="num px-3 text-right text-small text-mer-ink-primary">
                    {o.price != null ? formatPrice(o.price) : "—"}
                  </td>
                  <td className="px-3">
                    <span
                      className={cn(
                        "rounded-mer-xs px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide",
                        o.status === "open" && "bg-accent-dim text-accent",
                        o.status === "filled" && "bg-mer-surface-3 text-mer-ink-secondary",
                        o.status === "cancelled" && "bg-mer-surface-3 text-mer-ink-tertiary"
                      )}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 text-right">
                    {o.status === "open" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Cancel order ${o.id}`}
                        disabled={cancelOrder.isPending}
                        onClick={() => cancelOrder.mutate(o.id)}
                      >
                        <X size={13} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

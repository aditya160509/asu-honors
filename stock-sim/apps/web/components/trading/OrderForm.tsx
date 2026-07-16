"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePlaceOrder } from "@/lib/api/hooks/useOrders";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import type { OrderSide, OrderType } from "@/lib/api/types";

export interface OrderFormProps {
  ticker: string;
  currentPrice: number | null;
  cashBalance: number;
  sharesHeld?: number;
  isPortfolioLoading?: boolean;
  onOrderPlaced?: () => void;
}

const SELL_PRESETS = [0.25, 0.5, 0.75, 1] as const;

export function OrderForm({
  ticker,
  currentPrice,
  cashBalance,
  sharesHeld = 0,
  isPortfolioLoading = false,
  onOrderPlaced,
}: OrderFormProps) {
  const [side, setSide] = React.useState<OrderSide>("buy");
  const [orderType, setOrderType] = React.useState<OrderType>("market");
  const [quantity, setQuantity] = React.useState(0);
  const [limitPrice, setLimitPrice] = React.useState<number | "">("");
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pulse, setPulse] = React.useState(false);
  const placeOrder = usePlaceOrder();

  const priceUnavailable = currentPrice == null || currentPrice <= 0;
  // Limit orders are evaluated against the limit price itself (the worst case
  // the user has committed to) once one is entered — matches how the backend
  // pre-validates a non-crossing limit order's buying power.
  const referencePrice = orderType === "limit" && limitPrice ? limitPrice : currentPrice;

  const maxBuyQty = priceUnavailable || !referencePrice ? 0 : Math.floor(cashBalance / referencePrice);
  const maxQty = isPortfolioLoading ? Number.MAX_SAFE_INTEGER : side === "buy" ? maxBuyQty : sharesHeld;

  const estimatedTotal = referencePrice ? quantity * referencePrice : 0;
  const limitPriceMissing = orderType === "limit" && (limitPrice === "" || limitPrice <= 0);
  const insufficientFunds = !isPortfolioLoading && side === "buy" && estimatedTotal > cashBalance;
  const noSharesToSell = !isPortfolioLoading && side === "sell" && sharesHeld <= 0;

  const disabled =
    priceUnavailable ||
    quantity <= 0 ||
    limitPriceMissing ||
    insufficientFunds ||
    noSharesToSell ||
    isPortfolioLoading ||
    placeOrder.isPending;

  function clampQty(n: number) {
    return Math.max(0, Math.min(maxQty, n));
  }

  function handleSubmitClick() {
    if (disabled) return;
    setShowConfirm(true);
  }

  function handleConfirm() {
    placeOrder.mutate(
      {
        ticker,
        side,
        order_type: orderType,
        quantity,
        limit_price: orderType === "limit" ? Number(limitPrice) : undefined,
      },
      {
        onSuccess: () => {
          setPulse(true);
          setTimeout(() => setPulse(false), 200);
          setQuantity(0);
          setLimitPrice("");
          setShowConfirm(false);
          onOrderPlaced?.();
        },
      }
    );
  }

  return (
    <DashboardPanel eyebrow="Trade" title={`Order Ticket — ${ticker}`}>
      <div className="flex flex-col gap-3">
        <div className={cn("flex overflow-hidden rounded-mer-sm border", MER_HAIRLINE)}>
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn(
              "h-8 flex-1 text-body font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]",
              side === "buy" ? "bg-positive text-white" : "bg-mer-surface-3 text-mer-ink-secondary"
            )}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "h-8 flex-1 text-body font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]",
              side === "sell" ? "bg-negative text-white" : "bg-mer-surface-3 text-mer-ink-secondary"
            )}
          >
            Sell
          </button>
        </div>

        <div className={cn("flex overflow-hidden rounded-mer-sm border", MER_HAIRLINE)}>
          <button
            type="button"
            onClick={() => setOrderType("market")}
            className={cn(
              "h-7 flex-1 text-small font-medium transition-colors",
              orderType === "market" ? "bg-mer-surface-4 text-mer-ink-primary" : "text-mer-ink-tertiary hover:text-mer-ink-secondary"
            )}
          >
            Market
          </button>
          <button
            type="button"
            onClick={() => setOrderType("limit")}
            className={cn(
              "h-7 flex-1 text-small font-medium transition-colors",
              orderType === "limit" ? "bg-mer-surface-4 text-mer-ink-primary" : "text-mer-ink-tertiary hover:text-mer-ink-secondary"
            )}
          >
            Limit
          </button>
        </div>

        {priceUnavailable ? (
          <p className="text-small text-mer-ink-tertiary">No price available.</p>
        ) : (
          <>
            {orderType === "limit" && (
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={`Limit price (current ${formatPrice(currentPrice)})`}
                  className="num"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setQuantity((q) => clampQty(q - 1))}>
                −
              </Button>
              <Input
                type="number"
                min={0}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(clampQty(Number(e.target.value) || 0))}
                className="num text-center"
              />
              <Button variant="outline" size="icon" onClick={() => setQuantity((q) => clampQty(q + 1))}>
                +
              </Button>
            </div>

            {side === "sell" && sharesHeld > 0 && (
              <div className="flex gap-1.5">
                {SELL_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setQuantity(clampQty(Math.floor(sharesHeld * pct)))}
                    className={cn(
                      "h-6 flex-1 rounded-mer-sm border text-micro text-mer-ink-secondary transition-colors hover:bg-mer-surface-3",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-1",
                      MER_HAIRLINE
                    )}
                  >
                    {pct === 1 ? "Max" : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1 text-small">
              <div className="flex justify-between">
                <span className="text-mer-ink-secondary">{orderType === "limit" ? "Limit price" : "Est. price"}</span>
                <span className="num text-mer-ink-primary">{formatPrice(referencePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mer-ink-secondary">Total</span>
                <span
                  className={cn(
                    "num text-base font-semibold text-mer-ink-primary transition-transform",
                    pulse && "scale-105"
                  )}
                >
                  {formatPrice(estimatedTotal)}
                </span>
              </div>
            </div>

            {insufficientFunds && (
              <p className="text-micro text-negative">
                Need {formatPrice(estimatedTotal - cashBalance)} more. Cash: {formatPrice(cashBalance)}
              </p>
            )}
            {noSharesToSell && <p className="text-micro text-negative">You don&apos;t hold any {ticker}</p>}
            {quantity >= maxQty && maxQty > 0 && <p className="text-micro text-mer-ink-tertiary">Max: {maxQty}</p>}

            {placeOrder.isError && <p className="text-micro text-negative">{(placeOrder.error as Error)?.message ?? "Order failed"}</p>}

            <Button variant={side === "buy" ? "buy" : "sell"} disabled={disabled} onClick={handleSubmitClick}>
              {`${side === "buy" ? "Buy" : "Sell"} ${quantity || ""} ${ticker}`}
            </Button>
          </>
        )}
      </div>

      {/* Spec-mandated "institutional read-back" pattern: restate the trade in a
          raised well with mono figures before it actually submits. */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogTitle>Confirm {side === "buy" ? "Buy" : "Sell"} Order</DialogTitle>
          <DialogDescription>Review the order before it&apos;s placed.</DialogDescription>
          <div className={cn("mt-3 flex flex-col gap-2 rounded-mer-sm border bg-mer-surface-3 p-3 text-small", MER_HAIRLINE)}>
            <div className="flex justify-between">
              <span className="text-mer-ink-secondary">Ticker</span>
              <span className="num font-semibold text-mer-ink-primary">{ticker}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mer-ink-secondary">Side</span>
              <span className={cn("num font-semibold", side === "buy" ? "text-positive" : "text-negative")}>
                {side === "buy" ? "Buy" : "Sell"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mer-ink-secondary">Type</span>
              <span className="num text-mer-ink-primary">{orderType === "market" ? "Market" : "Limit"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mer-ink-secondary">Quantity</span>
              <span className="num text-mer-ink-primary">{quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mer-ink-secondary">{orderType === "limit" ? "Limit price" : "Est. price"}</span>
              <span className="num text-mer-ink-primary">{formatPrice(referencePrice)}</span>
            </div>
            <div className={cn("flex justify-between border-t pt-2", MER_HAIRLINE)}>
              <span className="text-mer-ink-secondary">Est. total</span>
              <span className="num text-base font-semibold text-mer-ink-primary">{formatPrice(estimatedTotal)}</span>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant={side === "buy" ? "buy" : "sell"}
              className="flex-1"
              disabled={placeOrder.isPending}
              onClick={handleConfirm}
            >
              {placeOrder.isPending ? "Submitting…" : `Confirm ${side === "buy" ? "Buy" : "Sell"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardPanel>
  );
}

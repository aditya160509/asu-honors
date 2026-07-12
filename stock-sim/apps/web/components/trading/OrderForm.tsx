"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlaceOrder } from "@/lib/api/hooks/useOrders";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { OrderSide } from "@/lib/api/types";

export interface OrderFormProps {
  ticker: string;
  currentPrice: number | null;
  cashBalance: number;
  sharesHeld?: number;
  onOrderPlaced?: () => void;
}

const SELL_PRESETS = [0.25, 0.5, 0.75, 1] as const;

export function OrderForm({ ticker, currentPrice, cashBalance, sharesHeld = 0, onOrderPlaced }: OrderFormProps) {
  const [side, setSide] = React.useState<OrderSide>("buy");
  const [quantity, setQuantity] = React.useState(0);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pulse, setPulse] = React.useState(false);
  const placeOrder = usePlaceOrder();

  const priceUnavailable = currentPrice == null || currentPrice <= 0;
  const maxBuyQty = priceUnavailable ? 0 : Math.floor(cashBalance / currentPrice);
  const maxQty = side === "buy" ? maxBuyQty : sharesHeld;

  const estimatedTotal = currentPrice ? quantity * currentPrice : 0;
  const insufficientFunds = side === "buy" && estimatedTotal > cashBalance;
  const noSharesToSell = side === "sell" && sharesHeld <= 0;

  const disabled =
    priceUnavailable || quantity <= 0 || insufficientFunds || noSharesToSell || placeOrder.isPending;

  function clampQty(n: number) {
    return Math.max(0, Math.min(maxQty, n));
  }

  function handleSubmit() {
    if (disabled) return;
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    placeOrder.mutate(
      { ticker, side, quantity },
      {
        onSuccess: () => {
          setPulse(true);
          setTimeout(() => setPulse(false), 200);
          setQuantity(0);
          setShowConfirm(false);
          onOrderPlaced?.();
        },
      }
    );
  }

  return (
    <div className="card-flat p-4 flex flex-col gap-3">
      <div className="flex rounded-sm overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => {
            setSide("buy");
            setShowConfirm(false);
          }}
          className={cn("flex-1 h-8 text-body font-medium", side === "buy" ? "bg-positive text-white" : "bg-bg-tertiary text-text-secondary")}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => {
            setSide("sell");
            setShowConfirm(false);
          }}
          className={cn("flex-1 h-8 text-body font-medium", side === "sell" ? "bg-negative text-white" : "bg-bg-tertiary text-text-secondary")}
        >
          Sell
        </button>
      </div>

      {priceUnavailable ? (
        <p className="text-small text-text-tertiary">No price available.</p>
      ) : (
        <>
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
              className="text-center num"
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
                  className="flex-1 h-6 text-micro rounded-sm border border-border text-text-secondary hover:bg-bg-hover"
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 text-small">
            <div className="flex justify-between">
              <span className="text-text-secondary">Est. price</span>
              <span className="num text-text-primary">{formatPrice(currentPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Total</span>
              <span className={cn("num text-text-primary font-semibold text-base transition-transform", pulse && "scale-105")}>
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
          {quantity >= maxQty && maxQty > 0 && <p className="text-micro text-text-tertiary">Max: {maxQty}</p>}

          {showConfirm && !disabled && (
            <div className="rounded-sm border border-border bg-bg-tertiary p-2 text-small animate-in fade-in slide-in-from-bottom-1 duration-150">
              Confirm: {side === "buy" ? "Buy" : "Sell"} {quantity} {ticker} @ {formatPrice(currentPrice)} ={" "}
              {formatPrice(estimatedTotal)}
            </div>
          )}

          {placeOrder.isError && <p className="text-micro text-negative">{(placeOrder.error as Error)?.message ?? "Order failed"}</p>}

          <Button
            variant={side === "buy" ? "buy" : "sell"}
            disabled={disabled}
            onClick={handleSubmit}
          >
            {placeOrder.isPending
              ? "Submitting…"
              : showConfirm
                ? `Confirm ${side === "buy" ? "Buy" : "Sell"}`
                : `${side === "buy" ? "Buy" : "Sell"} ${quantity || ""} ${ticker}`}
          </Button>
        </>
      )}
    </div>
  );
}

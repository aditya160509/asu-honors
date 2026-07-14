"use client";

import * as React from "react";
import gsap from "gsap";
import { MktSkeleton } from "@/components/marketing/MktSkeleton";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

/**
 * Illustrative product-shot only — no submit handler, no order routing, not
 * wired to any backend. Its container (DashboardMockSection) is aria-hidden,
 * and every interactive element here also carries tabIndex={-1}: aria-hidden
 * alone doesn't reliably remove focusable descendants from the tab order in
 * every browser, and a keyboard user tabbing into a "Buy" button that submits
 * nothing would be a worse experience than skipping it entirely.
 */
export function OrderTicketMock({ simulatedLoadMs = 850 }: { simulatedLoadMs?: number }) {
  const [loading, setLoading] = React.useState(true);
  const [quantity, setQuantity] = React.useState("100");
  const [limitPrice, setLimitPrice] = React.useState("187.42");
  const [side, setSide] = React.useState<"buy" | "sell">("buy");
  const formRef = React.useRef<HTMLFormElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), simulatedLoadMs);
    return () => window.clearTimeout(t);
  }, [simulatedLoadMs]);

  React.useEffect(() => {
    if (loading || !formRef.current) return;
    if (reduceMotion) {
      gsap.set(formRef.current, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(formRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: EASE_OUT_EXPO });
  }, [loading, reduceMotion]);

  if (loading) {
    return (
      <div className="flex flex-col gap-grid-3 bg-mkt-bg-void p-grid-4">
        <MktSkeleton width="100%" height={16} />
        <MktSkeleton width="100%" height={40} />
        <MktSkeleton width="100%" height={40} />
        <MktSkeleton width="100%" height={40} />
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-grid-3 bg-mkt-bg-void p-grid-4"
      aria-label="Illustrative order ticket — not a live trading form"
    >
      <div className="flex" role="group" aria-label="Side">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setSide("buy")}
          className={`mkt-press num h-grid-8 flex-1 border border-white/10 text-small font-semibold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-[-2px] ${
            side === "buy" ? "bg-positive text-black" : "text-mkt-text-muted"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setSide("sell")}
          className={`mkt-press num h-grid-8 flex-1 border border-l-0 border-white/10 text-small font-semibold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-[-2px] ${
            side === "sell" ? "bg-negative text-black" : "text-mkt-text-muted"
          }`}
        >
          Sell
        </button>
      </div>

      <label className="flex flex-col gap-grid-1">
        <span className="text-micro uppercase tracking-wide text-mkt-text-muted">Quantity</span>
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="numeric"
          tabIndex={-1}
          className="num h-grid-8 border border-white/10 bg-transparent px-grid-3 text-right text-body text-mkt-text-hero outline-none transition-colors focus-visible:border-mkt-action"
        />
      </label>

      <label className="flex flex-col gap-grid-1">
        <span className="text-micro uppercase tracking-wide text-mkt-text-muted">Limit Price</span>
        <input
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          inputMode="decimal"
          tabIndex={-1}
          className="num h-grid-8 border border-white/10 bg-transparent px-grid-3 text-right text-body text-mkt-text-hero outline-none transition-colors focus-visible:border-mkt-action"
        />
      </label>

      <button type="submit" tabIndex={-1} className="mkt-action-button mkt-press h-grid-8 w-full">
        Route Order
      </button>

      <style jsx>{`
        .mkt-press {
          transition: transform 100ms cubic-bezier(0.19, 1, 0.22, 1);
        }
        .mkt-press:active {
          transform: scale(0.97);
        }
        @media (prefers-reduced-motion: reduce) {
          .mkt-press {
            transition: none;
          }
          .mkt-press:active {
            transform: none;
          }
        }
      `}</style>
    </form>
  );
}

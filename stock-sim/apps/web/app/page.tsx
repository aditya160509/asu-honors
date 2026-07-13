"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroMarketPulse } from "@/components/marketing/HeroMarketPulse";
import { PriceTickerTape } from "@/components/marketing/PriceTickerTape";
import { usePublicMarketSnapshot } from "@/lib/api/hooks/usePublicMarket";

export default function LandingPage() {
  const { data } = usePublicMarketSnapshot();
  const companies = data?.companies ?? [];

  return (
    <main className="min-h-screen bg-mkt-bg-void">
      <PriceTickerTape companies={companies} />

      <section className="relative h-[calc(100vh-36px)] flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <HeroMarketPulse companies={companies} height={800} />
        </div>

        <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 max-w-4xl">
          <h1 className="mkt-headline text-mkt-text-hero font-semibold mb-6">
            A simulated market.
            <br />
            150 companies. Real math.
          </h1>
          <p className="text-mkt-fs-subhead text-mkt-text-muted mb-8 max-w-xl">
            Trade against a fully modeled economy — PEG-based valuation, mean-reverting price
            drivers, simulated economic cycles, and a Kyle-lambda order impact model. No real
            money, no real risk, real market mechanics.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/register" className="mkt-button">
              Start trading
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-mkt-text-hero h-14 px-2">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 md:px-16 py-20 border-t border-white/10" style={{ contentVisibility: "auto" }}>
        <div className="max-w-5xl flex flex-col">
          {[
            {
              n: "01",
              title: "Intrinsic value engine",
              body: "Every company has a real fundamentals chain — financial statements, factor scores, and a PEG-based fair value that drifts with growth expectations and economic sentiment.",
            },
            {
              n: "02",
              title: "Seven price drivers",
              body: "Price moves on value gap, earnings surprises, news sentiment, economic outlook, guidance, technical momentum, and institutional buying pressure — mean-reverting toward intrinsic value.",
            },
            {
              n: "03",
              title: "Branch the timeline",
              body: "Fork the simulation at any point to test a different scenario, with its own seeded randomness and event overrides.",
            },
          ].map((item, i) => (
            <div
              key={item.n}
              className={`grid grid-cols-[64px_1fr] md:grid-cols-[96px_280px_1fr] gap-x-6 gap-y-2 py-8 ${
                i > 0 ? "border-t border-white/10" : ""
              }`}
            >
              <span className="num text-mkt-signature-dim text-h1 font-semibold leading-none">{item.n}</span>
              <h3 className="text-mkt-text-hero text-h2 font-semibold col-span-1">{item.title}</h3>
              <p className="text-mkt-text-muted text-body max-w-lg md:col-start-3">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-8 md:px-16 py-8 border-t border-white/10 text-mkt-text-muted text-small">
        © Stock Sim
      </footer>
    </main>
  );
}

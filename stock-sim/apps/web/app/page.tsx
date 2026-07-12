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

        <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 max-w-3xl">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl">
          <div>
            <h3 className="text-mkt-text-hero text-h2 font-semibold mb-2">Intrinsic value engine</h3>
            <p className="text-mkt-text-muted text-body">
              Every company has a real fundamentals chain — financial statements, factor scores,
              and a PEG-based fair value that drifts with growth expectations and economic
              sentiment.
            </p>
          </div>
          <div>
            <h3 className="text-mkt-text-hero text-h2 font-semibold mb-2">Seven price drivers</h3>
            <p className="text-mkt-text-muted text-body">
              Price moves on value gap, earnings surprises, news sentiment, economic outlook,
              guidance, technical momentum, and institutional buying pressure — mean-reverting
              toward intrinsic value.
            </p>
          </div>
          <div>
            <h3 className="text-mkt-text-hero text-h2 font-semibold mb-2">Branch the timeline</h3>
            <p className="text-mkt-text-muted text-body">
              Fork the simulation at any point to test a different scenario, with its own
              seeded randomness and event overrides.
            </p>
          </div>
        </div>
      </section>

      <footer className="px-8 md:px-16 py-8 border-t border-white/10 text-mkt-text-muted text-small">
        © Stock Sim
      </footer>
    </main>
  );
}

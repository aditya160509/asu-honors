"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { PriceTickerTape } from "@/components/marketing/PriceTickerTape";
import { LayoutEngine } from "@/components/marketing/LayoutEngine";
import { AiHero } from "@/components/marketing/AiHero";
import { ScrollProgressBar } from "@/components/marketing/ScrollProgressBar";
import { usePublicMarketSnapshot } from "@/lib/api/hooks/usePublicMarket";

// Both are client-only (WebGL / ScrollTrigger) and below- or at-the-fold-adjacent — code-splitting
// them out of the main chunk means the hero's headline/CTA can paint before the Three.js and GSAP
// ScrollTrigger bundles finish downloading, instead of blocking on them.
const OrderFlowTape = dynamic(
  () => import("@/components/marketing/OrderFlowTape").then((m) => m.OrderFlowTape),
  { ssr: false, loading: () => <div className="pointer-events-none fixed inset-0 -z-10 bg-mkt-bg-void" /> }
);
const DashboardMockSection = dynamic(
  () => import("@/components/marketing/DashboardMockSection").then((m) => m.DashboardMockSection),
  { ssr: false }
);

export default function LandingPage() {
  const { data } = usePublicMarketSnapshot();
  const companies = data?.companies ?? [];

  return (
    <>
      <ScrollProgressBar />

      {/* Persistent full-screen WebGL background — mounted once, outside LayoutEngine, so it can sit
          at negative z-index behind every section without being painted over (see LayoutEngine.tsx). */}
      <OrderFlowTape />

      <LayoutEngine>
        <PriceTickerTape companies={companies} />

        <AiHero />

        <DashboardMockSection />

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

        <section className="flex flex-col items-center gap-grid-4 border-t border-white/10 px-8 py-20 text-center">
          <h2 className="mkt-headline text-h1 text-mkt-text-hero">Ready to see it live?</h2>
          <p className="max-w-md text-body text-mkt-text-muted">
            No real money, no real risk — a fully simulated market with real mechanics underneath.
          </p>
          <div className="mt-grid-2 flex items-center gap-grid-4">
            <Link href="/register" className="mkt-action-button">
              Request Institutional Access
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-mkt-text-hero h-12 px-2">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <footer className="px-8 md:px-16 py-8 border-t border-white/10 text-mkt-text-muted text-small">
          © Stock Sim
        </footer>
      </LayoutEngine>
    </>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PortfolioReviewCard } from "@/components/ai/PortfolioReviewCard";
import { PortfolioQuickStatsPanel } from "@/components/ai/PortfolioQuickStatsPanel";

export default function PortfolioReviewPage() {
  const [count, setCount] = React.useState(0);
  return (
    <TerminalShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ai" className="flex items-center gap-1 text-[13px] text-mer-ink-tertiary transition-colors hover:text-mer-ink-primary">
          <ArrowLeft size={14} /> AI Workspace
        </Link>
      </div>
      <PageHeader title="Portfolio Review" description="A grounded narrative review of your current simulated holdings." icon={Wallet} />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PortfolioReviewCard onGenerated={() => setCount((c) => c + 1)} className="lg:col-span-7" />
        <PortfolioQuickStatsPanel className="lg:col-span-5" />
      </div>
    </TerminalShell>
  );
}

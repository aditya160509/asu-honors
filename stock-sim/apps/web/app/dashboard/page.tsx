"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";

export default function DashboardPage() {
  const { data: cycle } = useCycleState();

  return (
    <TerminalShell>
      <PageHeader
        title="Dashboard"
        description="Your portfolio and the live market, at a glance."
        actions={cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={`Sim date: ${cycle.sim_date}`} />}
      />
      <div className="mb-5 h-px w-full bg-gradient-to-r from-transparent via-mer-accent-500 to-transparent opacity-70" />
      <DashboardGrid />
    </TerminalShell>
  );
}

"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PortfolioHeaderProvider } from "@/components/portfolio/PortfolioHeaderContext";
import { PortfolioIdentityBar } from "@/components/portfolio/PortfolioIdentityBar";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";

/**
 * Shared shell for all 8 /portfolio/* sections (C0): the identity bar and tab
 * row persist across tab switches without remounting, so switching tabs swaps
 * only the section content below — no full page reload feel.
 */
export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalShell>
      <PortfolioHeaderProvider>
        <div className="flex flex-col gap-4">
          <PortfolioIdentityBar />
          <PortfolioTabs />
          <div>{children}</div>
        </div>
      </PortfolioHeaderProvider>
    </TerminalShell>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/transactions", label: "Transactions" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/allocation", label: "Allocation" },
  { href: "/portfolio/analytics", label: "Analytics" },
  { href: "/portfolio/dividends", label: "Dividends" },
  { href: "/portfolio/watchlists", label: "Watchlists" },
  { href: "/portfolio/goals", label: "Goals" },
];

/**
 * Ghost tab row (C0): real <Link>s so Next prefetches adjacent tabs for free,
 * Ledger Line (1px accent gradient, draw-in) marks the active tab, sticky under
 * the app header on scroll. No icons — per Law 1 they'd compete with the data.
 */
export function PortfolioTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portfolio sections"
      className={cn(
        "sticky top-0 z-30 -mx-5 flex items-center gap-1 overflow-x-auto border-b bg-mer-surface-1/95 px-5 backdrop-blur-none",
        MER_HAIRLINE
      )}
    >
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href) ?? false;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-small transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]",
              active ? "font-medium text-mer-ink-primary" : "text-mer-ink-secondary hover:text-mer-ink-primary"
            )}
          >
            {tab.label}
            {active && (
              <span
                aria-hidden
                className="mer-ledger-draw absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-mer-accent-500 to-transparent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

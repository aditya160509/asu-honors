"use client";

import Link from "next/link";
import { BarChart3, Newspaper, Search, Trophy, Wallet, Zap } from "lucide-react";
import { openCommandPalette } from "@/lib/hooks/useCommandPalette";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

const ACTIONS = [
  { label: "Market Screener", href: "/market", icon: BarChart3 },
  { label: "Portfolio", href: "/portfolio", icon: Wallet },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "News", href: "/news", icon: Newspaper },
];

/** Real navigation shortcuts + the existing command palette trigger — no invented actions. */
export function QuickActionsSection() {
  return (
    <DashboardPanel eyebrow="Shortcuts" title="Quick Actions" icon={Zap} className="col-span-full lg:col-span-4" bodyClassName="grid grid-cols-2 gap-2">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex flex-col items-start gap-2 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-3 p-3 transition-colors hover:border-[color:var(--mer-stroke-emphasis)] hover:bg-mer-surface-4"
        >
          <action.icon size={16} className="text-mer-accent-300" />
          <span className="text-small text-mer-ink-primary">{action.label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className="col-span-2 flex items-center justify-between gap-2 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-3 p-3 text-left transition-colors hover:border-[color:var(--mer-stroke-emphasis)] hover:bg-mer-surface-4"
      >
        <span className="flex items-center gap-2">
          <Search size={16} className="text-mer-accent-300" />
          <span className="text-small text-mer-ink-primary">Search pages or companies</span>
        </span>
        <span className="font-mono text-micro text-mer-ink-tertiary">⌘K</span>
      </button>
    </DashboardPanel>
  );
}

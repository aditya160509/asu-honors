"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Activity, BookOpenText, Building2, MessageSquare, Newspaper, 
  ShieldAlert, Sparkles, Wallet, ChevronRight 
} from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { cn } from "@/lib/utils";

interface CapabilityTile {
  href: string;
  icon: typeof Sparkles;
  label: string;
  description: string;
  badge?: string;
}

const CAPABILITIES: CapabilityTile[] = [
  { href: "/ai/chat", icon: MessageSquare, label: "Chat", description: "Ask about your portfolio or the market, streamed in real time." },
  { href: "/ai/portfolio-review", icon: Wallet, label: "Portfolio Review", description: "Grounded narrative review of your current holdings." },
  { href: "/ai/company-review", icon: Building2, label: "Company Analysis", description: "Search any ticker for valuation & fundamentals." },
  { href: "/ai/news-take", icon: Newspaper, label: "News Take", description: "What happened + why it might matter on recent headlines." },
  { href: "/ai/strategy-builder", icon: ShieldAlert, label: "Strategy Builder", description: "Allocation suggestion for a stated goal." },
  { href: "/ai/explain-metrics", icon: BookOpenText, label: "Explain Metrics", description: "Clickable glossary of financial terms." },
];

export default function AiWorkspacePage() {
  return (
    <TerminalShell>
      <PageHeader
        title="AI Workspace"
        description="AI-generated, grounded in your real simulated data — never real financial advice."
        icon={Sparkles}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((cap) => (
          <Link
            key={cap.href}
            href={cap.href}
            className={cn(
              "group relative flex flex-col gap-3 rounded-lg border p-5 transition-all duration-200",
              "border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)]",
              "hover:border-[#8b7cf6]/50 hover:bg-[var(--mer-surface-2)] hover:shadow-[0_0_20px_rgba(139,124,246,0.08)]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-2)] transition-colors group-hover:border-[#8b7cf6]/30 group-hover:bg-[#8b7cf6]/10">
                <cap.icon size={18} className="text-[#8b7cf6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--mer-ink-primary)]">{cap.label}</span>
                  <ChevronRight size={14} className="text-[var(--mer-ink-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[#8b7cf6]" />
                </div>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--mer-ink-tertiary)]">{cap.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-1.5 text-[11px] text-[var(--mer-ink-tertiary)]">
        <Sparkles size={11} className="text-[#8b7cf6]" />
        Every AI feature also lives inline where it&apos;s contextually useful — metric tooltips, Company pages, and News cards.
      </div>
    </TerminalShell>
  );
}

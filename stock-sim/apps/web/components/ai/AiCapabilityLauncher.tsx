"use client";

import { BookOpenText, Building2, MessageSquare, Newspaper, ShieldAlert, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { cn } from "@/lib/utils";

interface Tile {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

const TILES: Tile[] = [
  { key: "chat", icon: MessageSquare, label: "Chat", description: "Ask about your portfolio or the market." },
  { key: "portfolio-review", icon: Wallet, label: "Portfolio Review", description: "Grounded narrative over your real holdings." },
  { key: "company-review", icon: Building2, label: "Company Analysis", description: "Search any ticker, get a grounded review." },
  { key: "news-take", icon: Newspaper, label: "News Take", description: "What happened + why it might matter." },
  { key: "strategy-builder", icon: ShieldAlert, label: "Strategy Builder", description: "Illustrative allocation suggestion for a goal." },
  { key: "explain-metrics", icon: BookOpenText, label: "Explain Metrics", description: "A clickable glossary of financial terms." },
];

const TILE_BASE =
  "group flex flex-col gap-1.5 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-1 p-3 text-left transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[#8b7cf6] hover:bg-mer-surface-2 hover:shadow-mer-raised active:scale-[0.98]";

/** All 6 AI capabilities as real, in-page tabs -- no more "click here to
 * leave the workspace." Company Review and News Take used to link out to
 * the Company/News pages; they're now fully functional here too (a ticker
 * search and a recent-news list respectively), so the launcher's only job
 * is switching which one is active. */
export function AiCapabilityLauncher({
  activeTab,
  onSelectTab,
  className,
}: {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  className?: string;
}) {
  return (
    <DashboardPanel
      eyebrow="Capabilities"
      title="Ask the Advisor"
      icon={Sparkles}
      className={className}
      bodyClassName="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
    >
      {TILES.map((tile) => {
        const isActive = tile.key === activeTab;
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelectTab(tile.key)}
            className={cn(TILE_BASE, isActive && "border-[#8b7cf6] shadow-mer-raised ring-1 ring-[#8b7cf6]/20")}
          >
            <tile.icon size={16} className={cn(isActive ? "text-[#8b7cf6]" : "text-mer-ink-tertiary", "transition-colors duration-200 group-hover:text-[#8b7cf6]")} />
            <span className={cn("text-small font-medium transition-colors duration-200", isActive ? "text-[#8b7cf6]" : "text-mer-ink-primary")}>{tile.label}</span>
            <span className="text-micro leading-normal text-mer-ink-tertiary">{tile.description}</span>
          </button>
        );
      })}
    </DashboardPanel>
  );
}

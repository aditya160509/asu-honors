"use client";

import * as React from "react";
import { Search } from "lucide-react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { CvdModeSelector } from "@/components/layout/CvdModeSelector";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { RecentActivity } from "@/components/layout/RecentActivity";
import { SidebarMobileTrigger } from "@/components/layout/Sidebar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { openCommandPalette } from "@/lib/hooks/useCommandPalette";
import { DURATION_BASE, EASE_OUT_EXPO } from "@/lib/motion";
import { formatDateFull, cn } from "@/lib/utils";

if (typeof window !== "undefined") gsap.registerPlugin(Flip);

/**
 * Three stacked layers per DESIGN_SPEC.md:
 *   utility layer   — workspace switcher, search, activity, CVD mode
 *   navigation layer — the live cycle/session status strip ("index tape")
 *   breadcrumb layer — derived automatically from the route
 */
export function Header() {
  const { data: cycle } = useCycleState();

  return (
    <header className="flex flex-col shrink-0">
      <div className="mer-surface-lit flex h-11 items-center gap-2 border-b border-mer-hairline bg-mer-surface-1 px-4">
        <SidebarMobileTrigger />
        <WorkspaceSwitcher />
        <div className="flex-1" />
        <ExpandingSearchTrigger />
        <RecentActivity />
        <CvdModeSelector />
      </div>

      <div className="flex h-8 items-center gap-3 border-b border-mer-hairline bg-mer-surface-1 px-4 text-micro">
        {cycle ? (
          <>
            <CycleIndicator phase={cycle.cycle_phase} />
            <span className="font-mono text-mer-ink-tertiary">{formatDateFull(cycle.sim_date)}</span>
          </>
        ) : (
          <span className="text-mer-ink-tertiary">Loading session…</span>
        )}
      </div>

      <Breadcrumbs />

      {/* Dialog only — trigger buttons live above and in the Sidebar */}
      <CommandPalette />
    </header>
  );
}

function ExpandingSearchTrigger() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState(false);

  function handleClick() {
    const el = containerRef.current;
    if (!el) {
      openCommandPalette();
      return;
    }
    const state = Flip.getState(el);
    setExpanded(true);
    requestAnimationFrame(() => {
      Flip.from(state, { duration: DURATION_BASE, ease: EASE_OUT_EXPO });
    });
    window.setTimeout(() => {
      openCommandPalette();
      setExpanded(false);
    }, 180);
  }

  return (
    <button type="button" onClick={handleClick} aria-label="Search pages or companies">
      <div
        ref={containerRef}
        className={cn(
          "flex h-8 items-center gap-2 overflow-hidden rounded-mer-sm border border-mer-hairline bg-mer-surface-2 text-mer-ink-tertiary transition-colors",
          expanded ? "w-56 justify-start px-3" : "w-8 justify-center"
        )}
      >
        <Search size={14} className="shrink-0" />
        {expanded && <span className="truncate text-small">Searching…</span>}
      </div>
    </button>
  );
}

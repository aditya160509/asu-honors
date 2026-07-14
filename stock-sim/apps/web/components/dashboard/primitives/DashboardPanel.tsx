"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLift } from "@/lib/motion";
import { LiveDot } from "@/components/dashboard/primitives/LiveDot";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";

export interface DashboardPanelProps {
  eyebrow: string;
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  live?: boolean;
  /** "accent" = the Ledger Line; "iris" = the AI-card exception (DESIGN_SPEC: reserved for AI content markers). */
  edge?: "none" | "accent" | "iris";
  glass?: boolean;
  noBodyPadding?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

const EDGE_GRADIENT: Record<NonNullable<DashboardPanelProps["edge"]>, string> = {
  none: "",
  accent: "from-transparent via-mer-accent-500 to-transparent",
  iris: "from-transparent via-[#8b7cf6] to-transparent",
};

/**
 * The one card shape every dashboard section is built from — mirrors
 * DESIGN_SPEC's "module header pattern" (eyebrow + title left, actions
 * right, half-strength divider) and five-layer elevation model (Level 2:
 * mer-surface-2 + hairline + top-light gradient). Sections differentiate
 * themselves through content and the optional `edge`/`live` accents, not
 * through one-off card chrome — keeps 15 sections visually coherent instead
 * of each reinventing a card.
 */
export function DashboardPanel({
  eyebrow,
  title,
  icon: Icon,
  actions,
  live,
  edge = "none",
  glass = false,
  noBodyPadding,
  className,
  bodyClassName,
  children,
}: DashboardPanelProps) {
  const panelRef = React.useRef<HTMLElement>(null);
  useLift(panelRef, 2);

  return (
    <section
      ref={panelRef}
      data-dashboard-panel
      className={cn(
        "mer-surface-lit relative flex flex-col overflow-hidden rounded-mer-md border",
        MER_HAIRLINE,
        "shadow-mer-rest transition-colors hover:border-[color:var(--mer-stroke-emphasis)]",
        glass ? "mer-glass" : "bg-mer-surface-2",
        className
      )}
    >
      {edge !== "none" && (
        <span
          className={cn("absolute inset-x-0 top-0 z-10 mx-auto h-px w-3/5 bg-gradient-to-r", EDGE_GRADIENT[edge])}
        />
      )}

      <header className={cn("flex items-center justify-between gap-3 border-b px-4 py-3", MER_HAIRLINE)}>
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
            {Icon && <Icon size={11} className="shrink-0" />}
            {eyebrow}
            {live && <LiveDot />}
          </span>
          <h2 className="truncate text-body font-semibold text-mer-ink-primary">{title}</h2>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>

      <div className={cn("flex-1", !noBodyPadding && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

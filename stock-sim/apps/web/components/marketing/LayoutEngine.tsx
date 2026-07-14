import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LayoutEngineProps {
  children: ReactNode;
  className?: string;
}

/**
 * Root wrapper for the AI-fintech landing direction. Enforces, at the single
 * point every section mounts under:
 *   - default text as high-contrast desaturated gray (--mkt-text-desat)
 *   - tabular-nums globally, via `.num` on any descendant numeral — this
 *     component doesn't force `.num` onto text it doesn't own, callers apply
 *     it to actual numeric content
 *   - zero outer margin — the canvas owns full viewport width with no
 *     browser-default body margin bleeding through
 *
 * Deliberately transparent, not `bg-mkt-bg-void` itself: <OrderFlowTape />
 * is meant to render as this component's sibling (mounted once, before
 * LayoutEngine, in app/page.tsx) and owns the pure-black canvas paint layer
 * at negative z-index. If LayoutEngine painted its own opaque background, a
 * plain `position: static` div with a background-color paints ABOVE a
 * `position: fixed; z-index: -10` descendant in the same stacking context —
 * it would silently hide the WebGL layer behind an opaque black div instead
 * of letting it show through the gaps between UI elements, which defeats
 * the point of a persistent background.
 *
 * Distinct from TerminalShell (components/layout/TerminalShell.tsx), which
 * governs authenticated TERMINAL routes and must not be touched by this
 * surface or vice versa.
 */
export function LayoutEngine({ children, className }: LayoutEngineProps) {
  return (
    <div className={cn("relative m-0 min-h-screen w-full overflow-x-hidden text-mkt-text-desat antialiased", className)}>
      {children}
    </div>
  );
}

export interface LayoutGridProps {
  children: ReactNode;
  columns?: number;
  className?: string;
}

/**
 * Zero-margin, 4px-grid-snapped CSS grid for high-density module layouts
 * (the dashboard mock section). Gap is fixed to the `grid-*` spacing scale
 * (tailwind.config.ts) so every gutter is a strict multiple of 4 — never an
 * arbitrary value at the call site.
 */
export function LayoutGrid({ children, columns = 12, className }: LayoutGridProps) {
  return (
    <div
      className={cn("grid w-full gap-grid-4 p-0", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

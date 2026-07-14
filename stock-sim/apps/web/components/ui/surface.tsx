import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Shared elevation system for every panel/card/floating surface.
 * flat    — dense in-grid surfaces (default, matches prior `.card-flat`)
 * raised  — page-level panels/cards: subtle gradient wash + shadow-md
 * glass   — floating/overlay UI (modals, dropdowns, command palette, toasts):
 *           translucent + backdrop-blur + shadow-lg
 */
export const surfaceVariants = cva("", {
  variants: {
    variant: {
      flat: "card-flat",
      raised: "surface-raised",
      glass: "surface-glass",
    },
  },
  defaultVariants: { variant: "flat" },
});

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(surfaceVariants({ variant, className }))} {...props} />
  )
);
Surface.displayName = "Surface";

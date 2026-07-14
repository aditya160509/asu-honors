import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Interactive/removable pill — distinct from `Badge` (which is a static
 * status indicator). Used for filter UIs (sentiment, industry, tag filters).
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-small font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover",
        selected: "border-accent-dim bg-accent-dim text-accent",
        positive: "border-positive-dim bg-positive-dim text-positive",
        negative: "border-negative-dim bg-negative-dim text-negative",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  onRemove?: () => void;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, variant, onRemove, children, ...props }, ref) => (
    <button ref={ref} type="button" className={cn(chipVariants({ variant, className }))} {...props}>
      {children}
      {onRemove && (
        <X
          size={12}
          className="text-text-tertiary hover:text-text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </button>
  )
);
Chip.displayName = "Chip";

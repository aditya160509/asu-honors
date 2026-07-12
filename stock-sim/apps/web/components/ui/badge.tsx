import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("badge-compact inline-flex items-center", {
  variants: {
    variant: {
      default: "bg-bg-tertiary text-text-secondary",
      positive: "bg-positive-dim text-positive",
      negative: "bg-negative-dim text-negative",
      accent: "bg-accent-dim text-accent",
      warning: "bg-warning/20 text-warning",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

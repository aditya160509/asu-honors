import * as React from "react";
import { cn } from "@/lib/utils";
import { surfaceVariants, type SurfaceProps } from "@/components/ui/surface";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "flat" — pass "raised" for page-level panels that want extra depth */
  variant?: SurfaceProps["variant"];
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "flat", ...props }, ref) => (
    <div ref={ref} className={cn(surfaceVariants({ variant }), className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-4 border-b border-border", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-h3 font-medium text-text-primary", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-4", className)} {...props} />
);
CardContent.displayName = "CardContent";

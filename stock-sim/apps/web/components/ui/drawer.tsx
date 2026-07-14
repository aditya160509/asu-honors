"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Slide-in side panel built on the already-installed Radix Dialog primitive
 * (no new dependency). Glass surface is hand-composed with arbitrary values
 * rather than the shared `surfaceVariants` helper because the flush screen
 * edge needs zero border-radius on that side — mixing in a shared glass
 * class (which sets a radius on all corners) would fight a `rounded-none`
 * override at equal CSS specificity. Uses the Meridian `--mer-glass-*`
 * tokens (DESIGN_SPEC.md) — this component has no other consumers yet, so
 * it's a safe, direct touchpoint for the new Global Layout token set.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const drawerContentVariants = cva(
  "fixed z-50 flex flex-col border-[color:var(--mer-glass-border)] bg-[color:var(--mer-glass-bg)] p-5 shadow-mer-overlay backdrop-blur-mer-glass data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full max-w-sm border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        left:
          "inset-y-0 left-0 h-full w-full max-w-sm border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        bottom:
          "inset-x-0 bottom-0 max-h-[80vh] w-full border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
      },
    },
    defaultVariants: { side: "right" },
  }
);

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerContentVariants> {}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, side, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
    <DialogPrimitive.Content ref={ref} className={cn(drawerContentVariants({ side }), className)} {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary">
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-h3 font-medium mb-3", className)} {...props} />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-small text-text-secondary", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";

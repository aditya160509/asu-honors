"use client";

import * as React from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthBannerProps {
  tone: "accent" | "warn";
  children: React.ReactNode;
  className?: string;
}

/** Full-width inline banner for primary-path auth notices and server errors. */
export function AuthBanner({ tone, children, className }: AuthBannerProps) {
  const Icon = tone === "warn" ? TriangleAlert : CheckCircle2;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-small",
        tone === "warn"
          ? "border-warning/50 bg-warning/5 text-warning"
          : "border-mkt-signature/50 bg-mkt-signature/5 text-mkt-signature",
        className
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="text-mkt-text-hero">{children}</div>
    </div>
  );
}

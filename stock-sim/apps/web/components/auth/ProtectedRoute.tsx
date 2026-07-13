"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 rounded-sm bg-accent skeleton-shimmer" aria-hidden />
        <span className="text-small text-text-tertiary">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}

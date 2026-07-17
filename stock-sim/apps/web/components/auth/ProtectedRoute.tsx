"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isDefinitivelyUnauthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isDefinitivelyUnauthenticated) {
      document.cookie = "mv_session=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [isDefinitivelyUnauthenticated, router]);

  // Not yet authenticated but not confirmed logged-out either (e.g. /auth/me
  // hit a transient 429 and is retrying) — keep waiting, don't redirect.
  if (isLoading || (!isAuthenticated && !isDefinitivelyUnauthenticated)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 rounded-sm bg-accent skeleton-shimmer" aria-hidden />
        <span className="text-small text-text-tertiary">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}

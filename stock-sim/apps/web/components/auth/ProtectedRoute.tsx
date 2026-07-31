"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isDefinitivelyUnauthenticated } = useAuth();
  const router = useRouter();
  React.useEffect(() => {
    if (isDefinitivelyUnauthenticated) router.replace("/login");
  }, [isDefinitivelyUnauthenticated, router]);
  if (isLoading || !isAuthenticated) {
    return <div className="flex h-screen items-center justify-center bg-[#070a0f] font-mono text-xs uppercase tracking-[.16em] text-[#f3b33d]">Loading workspace…</div>;
  }
  return <>{children}</>;
}

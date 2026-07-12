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
      <div className="flex h-[60vh] items-center justify-center text-text-secondary text-body">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

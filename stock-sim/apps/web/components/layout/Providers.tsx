"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/layout/AuthContext";
import { CvdProvider } from "@/lib/theme/cvd-modes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            staleTime: 30_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CvdProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="bottom-right" duration={4000} theme="dark" />
          </TooltipProvider>
        </CvdProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

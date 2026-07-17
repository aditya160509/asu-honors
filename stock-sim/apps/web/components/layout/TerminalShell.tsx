"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar, SidebarProvider } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { logActivity } from "@/lib/activity/useActivityLog";
import { getPageLabel } from "@/lib/nav/routeLabels";
import { cn } from "@/lib/utils";

/**
 * Shared shell for all TERMINAL-surface authenticated routes: Sidebar +
 * 3-layer Header + content + StatusBar, over the ambient mesh canvas.
 *
 * Note: each page currently mounts its own <TerminalShell>, rather than a
 * persistent Next.js route-group layout — so the shell remounts on every
 * navigation (no cross-page shared state beyond localStorage). That's an
 * existing architectural pattern predating this pass; changing it would mean
 * moving every page file into a route group, which is out of scope for a
 * Global-Layout-only change. Flagged as a follow-up recommendation.
 */
export function TerminalShell({
  children,
  noPadding = false,
}: {
  children: React.ReactNode;
  /** Full-bleed mode for pages that manage their own internal scrolling and
   * want to fill the viewport edge-to-edge (e.g. the Bloomberg-terminal
   * screener) — skips the default max-width/padding/page-level scroll. */
  noPadding?: boolean;
}) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="mer-mesh-canvas flex h-screen flex-col">
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <div className={cn("flex flex-1 flex-col", noPadding ? "overflow-hidden" : "overflow-y-auto")}>
              <Header />
              <RouteFadeContent>
                {noPadding ? (
                  <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
                ) : (
                  <main className="mx-auto w-full max-w-[1800px] px-5 py-5">{children}</main>
                )}
              </RouteFadeContent>
            </div>
          </div>
          <StatusBar />
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function RouteFadeContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname) logActivity({ kind: "nav", label: `Visited ${getPageLabel(pathname)}` });
  }, [pathname]);

  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

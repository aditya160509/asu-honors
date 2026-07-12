import { Header } from "@/components/layout/Header";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

/** Shared shell for all TERMINAL-surface authenticated routes. */
export function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-bg-primary">
        <Header />
        <main className="px-5 py-5 max-w-[1800px] mx-auto">{children}</main>
      </div>
    </ProtectedRoute>
  );
}

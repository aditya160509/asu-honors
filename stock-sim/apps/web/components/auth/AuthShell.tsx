import Link from "next/link";

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Shared elevated panel for /login and /register (MARKETING surface). */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-mkt-bg-void flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <span className="h-7 w-7 rounded-sm bg-mkt-signature flex items-center justify-center text-[13px] font-bold text-[#0a0a0b]">
            S
          </span>
          <span className="text-mkt-text-hero text-header font-semibold tracking-tight">Stock Sim</span>
        </Link>

        <div className="w-full rounded-lg border border-white/10 bg-mkt-bg-elevated shadow-xl px-8 py-9">
          <div className="mb-7 flex flex-col gap-1">
            <h1 className="text-mkt-text-hero text-h3 font-semibold">{title}</h1>
            <p className="text-small text-mkt-text-muted">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-small text-mkt-text-muted mt-6">{footer}</p>
      </div>
    </main>
  );
}

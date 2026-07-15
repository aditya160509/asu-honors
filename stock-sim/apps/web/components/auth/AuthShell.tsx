"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { HeroMarketPulse } from "@/components/marketing/HeroMarketPulse";
import { usePublicMarketSnapshot } from "@/lib/api/hooks/usePublicMarket";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  children: React.ReactNode;
}

/** Split-panel auth surface shared by /login and /register (MARKETING surface). */
export function AuthShell({ children }: AuthShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = usePublicMarketSnapshot();
  const companies = data?.companies ?? [];
  const isRegister = pathname === "/register";
  // Secondary auth routes (forgot/reset/verify) drop the tab switcher for a back link.
  const showTabs = pathname === "/login" || pathname === "/register";

  return (
    <main className="min-h-screen bg-mkt-bg-void flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[1040px] rounded-2xl border border-white/10 bg-mkt-bg-elevated shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="relative hidden md:flex flex-col justify-end min-h-[600px] bg-mkt-bg-void overflow-hidden">
          <div className="absolute inset-0">
            <HeroMarketPulse companies={companies} height={600} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-mkt-bg-void via-transparent to-transparent" />

          <Link href="/" className="absolute top-8 left-8 z-10 flex items-center gap-2">
            <span className="h-7 w-7 rounded-sm bg-mkt-signature flex items-center justify-center text-[13px] font-bold text-[#0a0a0b]">
              S
            </span>
            <span className="text-mkt-text-hero text-header font-semibold tracking-tight">
              Stock Sim
            </span>
          </Link>

          <div className="relative z-10 p-10 flex flex-col gap-3">
            <h2 className="text-mkt-text-hero text-h1 font-semibold leading-[0.95] [text-wrap:balance]">
              Trade the market,
              <br />
              not your savings.
            </h2>
            <p className="text-mkt-text-muted text-body max-w-sm">
              A fully simulated economy — 150 companies, real valuation math, zero real-money
              risk. Build your track record before you risk a dollar.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-8 py-10 md:px-12">
          {!showTabs && (
            <Link
              href="/login"
              className="mb-8 flex items-center gap-1 self-start text-body text-mkt-text-muted hover:text-mkt-text-hero transition-colors"
            >
              <ChevronLeft size={14} aria-hidden />
              Back to sign in
            </Link>
          )}
          {showTabs && (
          <div className="flex items-center gap-1 mb-8 self-start rounded-full bg-white/5 p-1">
            <button
              type="button"
              onClick={() => router.push("/register")}
              className={cn(
                "h-9 px-5 rounded-full text-small font-semibold transition-colors",
                isRegister
                  ? "bg-mkt-signature text-[#0a0a0b]"
                  : "text-mkt-text-muted hover:text-mkt-text-hero"
              )}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className={cn(
                "h-9 px-5 rounded-full text-small font-semibold transition-colors",
                !isRegister
                  ? "bg-mkt-signature text-[#0a0a0b]"
                  : "text-mkt-text-muted hover:text-mkt-text-hero"
              )}
            >
              Log In
            </button>
          </div>
          )}

          {children}
        </div>
      </div>
    </main>
  );
}

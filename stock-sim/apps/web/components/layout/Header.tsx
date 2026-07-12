"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/layout/AuthContext";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { Avatar } from "@/components/ui/avatar";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { CvdModeSelector } from "@/components/layout/CvdModeSelector";
import { CommandPalette } from "@/components/layout/CommandPalette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/market", label: "Market" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/news", label: "News" },
  { href: "/simulation", label: "Simulation" },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: cycle } = useCycleState();

  return (
    <header className="h-12 border-b border-border bg-bg-secondary flex items-center px-4 gap-6 sticky top-0 z-40">
      <Link href="/market" className="text-body font-semibold text-text-primary shrink-0">
        Stock Sim
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 h-8 flex items-center text-small rounded-sm transition-colors",
              pathname?.startsWith(link.href)
                ? "text-text-primary bg-bg-hover"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      {cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={cycle.sim_date} />}
      <CvdModeSelector />
      <CommandPalette />
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar displayName={user.display_name} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-small text-text-secondary">{user.email}</div>
            <DropdownMenuSeparator />
            {user.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link href="/admin">Admin</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link href="/login" className="text-small text-text-link">
          Sign in
        </Link>
      )}
    </header>
  );
}

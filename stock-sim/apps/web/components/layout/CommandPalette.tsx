"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BarChart3,
  Home,
  LayoutDashboard,
  LineChart,
  Newspaper,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/lib/hooks/useCommandPalette";
import { openRecentActivity } from "@/components/layout/RecentActivity";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { cn, formatPct, formatPrice, trendColorClass } from "@/lib/utils";

interface NavCommand {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_COMMANDS: NavCommand[] = [
  { label: "Go to Dashboard", href: "/dashboard", icon: Home },
  { label: "Go to Market", href: "/market", icon: BarChart3 },
  { label: "Go to Portfolio", href: "/portfolio", icon: Wallet },
  { label: "Go to Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Go to News", href: "/news", icon: Newspaper },
  { label: "Go to Simulation", href: "/simulation", icon: LineChart },
  { label: "Go to Admin", href: "/admin", icon: LayoutDashboard },
];

/**
 * Reduced-scope command palette (SKILL.md section 17): fuzzy nav + company
 * search. The trigger lives elsewhere now — Header's expanding search
 * button and the Sidebar's search bar both call `openCommandPalette()` —
 * this component owns only the dialog, controlled by that shared toggle.
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const { data } = useMarketGrid();

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    return data.companies
      .filter((c) => c.ticker.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, data]);

  function handleNavigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleOpenActivity() {
    setOpen(false);
    openRecentActivity();
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages or companies…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {matches.length > 0 && (
          <>
            <CommandGroup heading="Companies">
              {matches.map((c) => (
                <CommandItem key={c.ticker} onSelect={() => handleNavigate(`/companies/${c.ticker}`)}>
                  <span className="mr-2 font-mono text-micro text-text-tertiary">{c.ticker}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="ml-2 font-mono text-micro text-text-tertiary">
                    {formatPrice(c.current_price)}
                  </span>
                  <span className={cn("ml-2 font-mono text-micro", trendColorClass(c.day_change_pct))}>
                    {formatPct(c.day_change_pct)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.label} onSelect={() => handleNavigate(cmd.href)}>
              <cmd.icon size={14} className="mr-2 text-text-tertiary" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleOpenActivity}>
            <Bell size={14} className="mr-2 text-text-tertiary" />
            <span>View Recent Activity</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

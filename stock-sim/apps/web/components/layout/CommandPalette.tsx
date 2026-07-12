"use client";

import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LineChart,
  Newspaper,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCommandPalette } from "@/lib/hooks/useCommandPalette";

interface NavCommand {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  shortcut?: string;
}

const NAV_COMMANDS: NavCommand[] = [
  { label: "Go to Market", href: "/market", icon: BarChart3 },
  { label: "Go to Portfolio", href: "/portfolio", icon: Wallet },
  { label: "Go to Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Go to News", href: "/news", icon: Newspaper },
  { label: "Go to Simulation", href: "/simulation", icon: LineChart },
  { label: "Go to Admin", href: "/admin", icon: LayoutDashboard },
  { label: "New alert (stub)", href: "#", icon: Bell },
];

/**
 * Reduced-scope command palette (SKILL.md section 17): fuzzy nav search only —
 * not the full 70+ keybinding system. Trigger: Ctrl/Cmd+` or Ctrl/Cmd+F.
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();

  function handleSelect(href: string) {
    setOpen(false);
    if (href !== "#") router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Go to page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.label} onSelect={() => handleSelect(cmd.href)}>
              <cmd.icon size={14} className="mr-2 text-text-tertiary" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  BarChart3,
  ChevronDown,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthContext";
import { useWatchlist } from "@/lib/api/hooks/useWatchlist";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openCommandPalette } from "@/lib/hooks/useCommandPalette";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { revealStagger, useLift, DURATION_BASE, EASE_OUT_EXPO } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { UserResponse } from "@/lib/api/types";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 72;
const COLLAPSE_STORAGE_KEY = "mer-sidebar-collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}
interface NavGroup {
  eyebrow: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { eyebrow: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: Home }] },
  { eyebrow: "Markets", items: [{ href: "/market", label: "Market", icon: BarChart3 }] },
  {
    eyebrow: "Portfolio",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: Wallet },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  { eyebrow: "Intelligence", items: [{ href: "/news", label: "News", icon: Newspaper }] },
  {
    eyebrow: "Simulation",
    items: [
      { href: "/simulation", label: "Simulation", icon: LineChart },
      { href: "/admin", label: "Admin", icon: LayoutDashboard, adminOnly: true },
    ],
  },
];

const QUICK_JUMPS: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Go to Dashboard", icon: Home, href: "/dashboard" },
  { label: "Go to Market", icon: BarChart3, href: "/market" },
  { label: "Go to Portfolio", icon: Wallet, href: "/portfolio" },
  { label: "Go to Simulation", icon: LineChart, href: "/simulation" },
];

// --- shared collapse/mobile-open state -------------------------------------

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  isDesktop: boolean;
}
const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsedState] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored) setCollapsedState(stored === "1");
  }, []);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, v ? "1" : "0");
  }, []);

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen, isDesktop }),
    [collapsed, setCollapsed, mobileOpen, isDesktop]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function useSidebarState() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarState must be used within SidebarProvider");
  return ctx;
}

/** Header's mobile menu trigger — lives here so it shares context with the drawer below. */
export function SidebarMobileTrigger() {
  const { setMobileOpen, isDesktop } = useSidebarState();
  if (isDesktop) return null;
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label="Open navigation"
      className="flex items-center justify-center h-8 w-8 rounded-mer-sm text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors"
    >
      <Menu size={17} />
    </button>
  );
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen, isDesktop } = useSidebarState();

  if (!isDesktop) {
    return (
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="left" className="w-[280px] max-w-[85vw] p-0">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>
    );
  }

  return <SidebarRail collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />;
}

function SidebarRail({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const ref = React.useRef<HTMLElement>(null);
  const initialWidth = React.useRef(collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (!ref.current) return;
    const target = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    gsap.to(ref.current, { width: target, duration: DURATION_BASE, ease: EASE_OUT_EXPO });
  }, [collapsed]);

  return (
    <aside
      ref={ref}
      style={{ width: initialWidth.current }}
      className="mer-surface-lit shrink-0 h-screen sticky top-0 bg-mer-surface-1 border-r border-mer-hairline flex flex-col overflow-hidden z-20"
    >
      <SidebarBody collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
}

function SidebarBody({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: watchlist, isLoading: watchlistLoading } = useWatchlist();
  const { data: cycle } = useCycleState();
  const navListRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!navListRef.current) return;
    const items = navListRef.current.querySelectorAll("[data-nav-item]");
    if (items.length) revealStagger(items, 30);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center h-14 shrink-0 border-b border-mer-hairline px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/market"
          className={cn(
            "flex items-center gap-2 text-mer-ink-primary font-semibold text-body",
            collapsed && "gap-0"
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-mer-xs bg-mer-accent-500 text-white text-small">
            ◆
          </span>
          {!collapsed && "Stock Sim"}
        </Link>
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="flex items-center justify-center h-7 w-7 rounded-mer-xs text-mer-ink-tertiary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>
      {onToggleCollapse && collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          className="flex items-center justify-center h-8 mx-2 mt-2 rounded-mer-xs text-mer-ink-tertiary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors"
        >
          <PanelLeftOpen size={15} />
        </button>
      )}

      {/* Quick actions: search */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          aria-label="Open command palette"
          className={cn(
            "flex items-center gap-2 w-full h-9 rounded-mer-sm border border-mer-hairline bg-mer-surface-2 text-mer-ink-tertiary hover:border-mer-emphasis hover:text-mer-ink-secondary transition-colors text-small",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Search size={14} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <span className="font-mono text-micro text-mer-ink-tertiary">⌘K</span>
            </>
          )}
        </button>
      </div>

      {/* Quick actions: jumps */}
      <div className={cn("flex gap-1 px-3 pt-2", collapsed && "flex-col items-center")}>
        {QUICK_JUMPS.map((jump) => {
          const Icon = jump.icon;
          return (
            <Tooltip key={jump.href}>
              <TooltipTrigger asChild>
                <Link
                  href={jump.href}
                  onClick={onNavigate}
                  className="flex h-8 w-8 items-center justify-center rounded-mer-sm text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors"
                >
                  <Icon size={15} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "bottom"}>{jump.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Nav groups */}
      <nav ref={navListRef} className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.eyebrow} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
                {group.eyebrow}
              </div>
            )}
            {group.items
              .filter((item) => !item.adminOnly || user?.role === "admin")
              .map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={!!pathname?.startsWith(item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
          </div>
        ))}

        <div className="flex flex-col gap-1">
          {!collapsed && (
            <div className="px-2 pb-1 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
              Watchlist
            </div>
          )}
          {watchlistLoading ? (
            <div className="flex flex-col gap-1.5 px-2">
              <Skeleton width="100%" height={14} />
              <Skeleton width="80%" height={14} />
            </div>
          ) : !watchlist || watchlist.length === 0 ? (
            !collapsed && (
              <p className="px-2 text-micro text-mer-ink-tertiary">No pinned companies. Add from Market.</p>
            )
          ) : (
            watchlist.slice(0, 8).map((item) => (
              <Link
                key={item.company_id}
                href={`/companies/${item.ticker}`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 h-8 rounded-mer-xs px-2 text-small text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors",
                  collapsed && "justify-center px-0"
                )}
              >
                <Star size={13} className="shrink-0 text-mer-ink-tertiary" />
                {!collapsed && (
                  <>
                    <span className="font-mono text-micro shrink-0">{item.ticker}</span>
                    <span className="truncate text-mer-ink-tertiary">{item.name}</span>
                  </>
                )}
              </Link>
            ))
          )}
        </div>
      </nav>

      {cycle && !collapsed && (
        <div className="px-4 py-2 border-t border-mer-hairline">
          <CycleIndicator phase={cycle.cycle_phase} tooltip={cycle.sim_date} />
        </div>
      )}

      <SidebarUserCard collapsed={collapsed} user={user} onLogout={logout} />
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  useLift(ref, 2);
  const Icon = item.icon;
  return (
    <Link
      ref={ref}
      href={item.href}
      data-nav-item
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 h-9 rounded-mer-sm px-2.5 text-small transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-mer-surface-3 text-mer-ink-primary"
          : "text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary"
      )}
    >
      {active && <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-mer-accent-500" />}
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function SidebarUserCard({
  collapsed,
  user,
  onLogout,
}: {
  collapsed: boolean;
  user: UserResponse | undefined;
  onLogout: () => void;
}) {
  if (!user) {
    return (
      <div className="p-3 border-t border-mer-hairline">
        <Skeleton width="100%" height={40} />
      </div>
    );
  }

  return (
    <div className="border-t border-mer-hairline p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2.5 rounded-mer-sm p-2 text-left outline-none hover:bg-mer-surface-3 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <Avatar displayName={user.display_name} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-small font-medium text-mer-ink-primary">{user.display_name}</div>
              <div className="truncate text-micro text-mer-ink-tertiary">{user.email}</div>
            </div>
          )}
          {!collapsed && <ChevronDown size={14} className="shrink-0 text-mer-ink-tertiary" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="truncate text-small text-text-secondary">{user.email}</span>
            {user.role === "admin" && (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-micro text-mer-accent-300">
                <ShieldCheck size={12} /> Admin
              </span>
            )}
          </div>
          <DropdownMenuSeparator />
          {user.role === "admin" && (
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin panel</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onLogout} className="text-negative">
            <LogOut size={13} className="mr-2" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

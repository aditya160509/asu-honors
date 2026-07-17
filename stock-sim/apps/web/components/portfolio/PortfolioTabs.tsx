"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ScrollText,
  TrendingUp,
  PieChart,
  Activity,
  Banknote,
  Eye,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  "/portfolio/holdings": Briefcase,
  "/portfolio/transactions": ScrollText,
  "/portfolio/performance": TrendingUp,
  "/portfolio/allocation": PieChart,
  "/portfolio/analytics": Activity,
  "/portfolio/dividends": Banknote,
  "/portfolio/watchlists": Eye,
  "/portfolio/goals": Target,
} as const;

const TABS = [
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/transactions", label: "Transactions" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/allocation", label: "Allocation" },
  { href: "/portfolio/analytics", label: "Analytics" },
  { href: "/portfolio/dividends", label: "Dividends" },
  { href: "/portfolio/watchlists", label: "Watchlists" },
  { href: "/portfolio/goals", label: "Goals" },
];

const NAV_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: "2px",
  overflowX: "auto",
  borderBottom: "1px solid var(--mer-stroke-hairline)",
  backgroundColor: "rgba(16, 19, 24, 0.92)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  padding: "0 20px",
  marginLeft: "-20px",
  marginRight: "-20px",
};

const TAB_BASE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
  padding: "10px 14px",
  fontSize: "var(--fs-small)",
  fontWeight: 500,
  color: "var(--mer-ink-secondary)",
  transition: "all 0.15s ease",
  borderRadius: "var(--mer-radius-sm)",
  textDecoration: "none",
};

const TAB_ACTIVE: React.CSSProperties = {
  ...TAB_BASE,
  color: "var(--mer-ink-primary)",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
};

const GLOW_LINE: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: "14px",
  right: "14px",
  height: "2px",
  borderRadius: "1px",
  background: "linear-gradient(90deg, transparent, var(--mer-accent-500), transparent)",
  boxShadow: "0 0 8px rgba(62, 111, 224, 0.5), 0 0 16px rgba(62, 111, 224, 0.2)",
};

export function PortfolioTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Portfolio sections" style={NAV_STYLE}>
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href) ?? false;
        const Icon = TAB_ICONS[tab.href as keyof typeof TAB_ICONS];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            style={active ? TAB_ACTIVE : TAB_BASE}
            className={cn(
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]",
              !active && "hover:bg-[rgba(255,255,255,0.04)] hover:text-mer-ink-primary"
            )}
          >
            {Icon && (
              <Icon
                size={13}
                style={{
                  opacity: active ? 0.9 : 0.5,
                  color: active ? "var(--mer-accent-500)" : undefined,
                }}
              />
            )}
            {tab.label}
            {active && <span aria-hidden style={GLOW_LINE} />}
          </Link>
        );
      })}
    </nav>
  );
}

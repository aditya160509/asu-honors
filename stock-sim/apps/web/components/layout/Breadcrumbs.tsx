"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { formatTicker } from "@/lib/utils";
import { ROUTE_LABELS } from "@/lib/nav/routeLabels";

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isTickerSegment = segments[index - 1] === "companies";
    const label = isTickerSegment ? formatTicker(segment) : ROUTE_LABELS[segment] ?? segment;
    // "/companies" itself has no page — point that crumb at /market instead.
    return { href: href === "/companies" ? "/market" : href, label };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 px-5 h-7 text-micro text-mer-ink-tertiary border-b border-[color:var(--mer-stroke-hairline)] shrink-0"
    >
      <Link href="/market" className="flex items-center hover:text-mer-ink-secondary transition-colors">
        <Home size={12} />
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href + i} className="flex items-center gap-1.5">
            <ChevronRight size={11} className="text-mer-ink-tertiary" />
            {isLast ? (
              <span className="text-mer-ink-secondary font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-mer-ink-secondary transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

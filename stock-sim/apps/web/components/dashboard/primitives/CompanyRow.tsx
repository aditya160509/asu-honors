"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";
import { DeltaBar } from "@/components/dashboard/primitives/DeltaBar";

export interface CompanyRowProps {
  ticker: string;
  name: string;
  price: number | null;
  changePct: number | null;
  rightSlot?: React.ReactNode;
}

/** Shared compact row — Trending, Top Movers, and Watchlist Preview all render this same shape. */
export function CompanyRow({ ticker, name, price, changePct, rightSlot }: CompanyRowProps) {
  return (
    <Link
      href={`/companies/${ticker}`}
      className="flex items-center gap-3 rounded-mer-sm px-2 py-2 transition-colors hover:bg-mer-surface-3"
    >
      <Avatar displayName={name} colorSeed={ticker} className="h-7 w-7 shrink-0 text-micro" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="num text-small font-bold uppercase text-mer-ink-primary">{ticker}</span>
          {changePct != null && <DeltaBar value={changePct} />}
        </div>
        <p className="truncate text-micro text-mer-ink-tertiary">{name}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="num text-small text-mer-ink-secondary">{price != null ? formatPrice(price) : "N/A"}</span>
        <DeltaBadge value={changePct} />
      </div>
      {rightSlot}
    </Link>
  );
}

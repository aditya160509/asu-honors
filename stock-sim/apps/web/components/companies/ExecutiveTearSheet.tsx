"use client";

import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter, type KpiCounterProps } from "@/components/dashboard/primitives/KpiCounter";
import type { CompanyDetail, PriceHistoryItem } from "@/lib/api/types";

export interface ExecutiveTearSheetProps {
  company: CompanyDetail;
  latestBar: PriceHistoryItem | undefined;
  dayChangePct: number | null;
  loading?: boolean;
}

/** Renders a KpiCounter, or a plain "N/A" tile when the backend value is null — never fabricates a
 * "0" that would misread as a real measured figure (e.g. a company with no P/E). */
function NullableKpi(props: Omit<KpiCounterProps, "value"> & { value: number | null | undefined; loading?: boolean }) {
  const { value, loading, label, icon: Icon } = props;
  if (!loading && value == null) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-micro font-medium uppercase text-mer-ink-tertiary">
          {Icon && <Icon size={11} />}
          {label}
        </span>
        <span className="num text-h3 font-semibold text-mer-ink-tertiary">N/A</span>
      </div>
    );
  }
  return <KpiCounter {...props} value={value ?? 0} />;
}

/** Single-glance snapshot of the fundamentals already returned by GET /companies/{ticker} plus the
 * latest bar from the price-history endpoint — no fields beyond what the backend already provides. */
export function ExecutiveTearSheet({ company, latestBar, dayChangePct, loading }: ExecutiveTearSheetProps) {
  const ivGap =
    company.latest_iv && Number(company.latest_iv) > 0 && company.latest_price
      ? ((Number(company.latest_price) - Number(company.latest_iv)) / Number(company.latest_iv)) * 100
      : null;

  return (
    <DashboardPanel eyebrow="Snapshot" title="Executive Tear Sheet" edge="accent">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <NullableKpi label="Market Cap" value={company.market_cap} format="large" loading={loading} />
        <NullableKpi label="P/E Ratio" value={company.pe_ratio} format="number" loading={loading} />
        <NullableKpi label="Intrinsic Value" value={company.latest_iv} format="price" loading={loading} />
        <NullableKpi label="IV Gap" value={ivGap} format="pct" tone="auto" loading={loading} />
        <NullableKpi label="Day Change" value={dayChangePct} format="pct" tone="auto" loading={loading} />
        <NullableKpi label="Shares Outstanding" value={company.shares_outstanding} format="large" loading={loading} />
        <NullableKpi label="Free Float" value={company.free_float_pct * 100} format="pct" loading={loading} />
        <NullableKpi label="Day Volume" value={latestBar?.volume} format="large" loading={loading} />
        <NullableKpi label="Day High" value={latestBar ? Number(latestBar.high) : null} format="price" loading={loading} />
        <NullableKpi label="Day Low" value={latestBar ? Number(latestBar.low) : null} format="price" loading={loading} />
      </div>
    </DashboardPanel>
  );
}

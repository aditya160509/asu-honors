"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { FinancialStatementResponse, CompanyDetail } from "@/lib/api/types";

interface FundamentalsPanelProps {
  financials: FinancialStatementResponse | null;
  company: CompanyDetail | null;
  /** Trailing-12m dividend yield (%), from GET /companies/{ticker}/dividends -- there is no
   * `balance_sheet.dividend_yield` field anywhere in the backend, so this must be passed in
   * rather than read off the financials statement. */
  dividendYieldPct?: number | null;
  loading?: boolean;
}

type TabKey = "income" | "balance" | "ratios";

const TABS: { key: TabKey; label: string }[] = [
  { key: "income", label: "Income Statement" },
  { key: "balance", label: "Balance Sheet" },
  { key: "ratios", label: "Key Ratios" },
];

function formatNum(v: unknown): string {
  if (v == null) return "--";
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatPct(v: unknown): string {
  if (v == null) return "--";
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  return `${n.toFixed(1)}%`;
}

function formatRatio(v: unknown): string {
  if (v == null) return "--";
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(2);
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return null;
  const pos = value >= 0;
  return (
    <span
      style={{
        fontSize: "var(--fs-micro)",
        fontWeight: 600,
        color: pos ? "var(--positive)" : "var(--negative)",
      }}
    >
      {pos ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function DataRow({
  label,
  value,
  delta,
  bold,
}: {
  label: string;
  value: string;
  delta?: number | null;
  bold?: boolean;
}) {
  return (
    <div
      className="fundamentals-row"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid var(--mer-stroke-hairline)",
      }}
    >
      <span
        style={{
          fontSize: "var(--fs-small)",
          color: bold ? "var(--mer-ink-primary)" : "var(--mer-ink-secondary)",
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {delta != null && <DeltaBadge value={delta} />}
        <span
          className="num"
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: bold ? 600 : 400,
            color: "var(--mer-ink-primary)",
            minWidth: 70,
            textAlign: "right",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid var(--mer-stroke-hairline)",
      }}
    >
      <div
        style={{ width: 100, height: 12, borderRadius: 3 }}
        className="skeleton-shimmer"
      />
      <div
        style={{ width: 60, height: 12, borderRadius: 3 }}
        className="skeleton-shimmer"
      />
    </div>
  );
}

function RatioCard({
  label,
  value,
  sectorAvg,
}: {
  label: string;
  value: number | null;
  sectorAvg?: number | null;
}) {
  const displayValue = formatRatio(value);
  const sectorDisplay = sectorAvg != null ? formatRatio(sectorAvg) : null;
  const ratio = value != null && sectorAvg != null && sectorAvg > 0 ? value / sectorAvg : null;
  const barPct = ratio != null ? Math.min(100, Math.max(0, (1 / (1 + Math.abs(ratio - 1))) * 100)) : 50;
  const barColor = ratio != null ? (ratio > 1 ? "var(--mer-accent-500)" : "var(--mer-ink-tertiary)") : "var(--mer-ink-tertiary)";

  return (
    <div
      className="fundamentals-ratio-card"
      style={{
        padding: "10px 12px",
        background: "var(--mer-surface-2)",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-sm)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-micro)",
          color: "var(--mer-ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          color: "var(--mer-ink-primary)",
          lineHeight: 1.2,
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          height: 3,
          background: "var(--mer-surface-4)",
          borderRadius: 2,
          marginTop: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barPct}%`,
            background: barColor,
            borderRadius: 2,
            transition: "width 300ms ease",
          }}
        />
      </div>
      {sectorDisplay && (
        <div
          className="num"
          style={{
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-tertiary)",
            marginTop: 4,
          }}
        >
          Sector avg: {sectorDisplay}
        </div>
      )}
    </div>
  );
}

function IncomeStatement({ data, loading }: { data: FinancialStatementResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  const inc = data?.income_statement as Record<string, unknown> | null;
  if (!inc) {
    return (
      <div style={{ padding: "24px 0" }}>
        <EmptyState title="No income statement data" />
      </div>
    );
  }

  return (
    <div>
      <DataRow label="Revenue" value={formatNum(inc.revenue)} bold />
      <DataRow label="Cost of Revenue" value={formatNum(inc.cost_of_revenue)} />
      <DataRow label="Gross Profit" value={formatNum(inc.gross_profit)} />
      <DataRow label="Operating Expenses" value={formatNum(inc.operating_expenses)} />
      <DataRow label="Operating Income" value={formatNum(inc.operating_income)} />
      <DataRow label="Net Income" value={formatNum(inc.net_income)} bold />
      <DataRow label="EPS (Diluted)" value={formatRatio(inc.eps_diluted)} />
      <DataRow
        label="Operating Margin"
        value={formatPct(inc.operating_margin ?? (inc.operating_income != null && inc.revenue ? (Number(inc.operating_income) / Number(inc.revenue)) * 100 : null))}
      />
    </div>
  );
}

function BalanceSheet({ data, loading }: { data: FinancialStatementResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  const bs = data?.balance_sheet as Record<string, unknown> | null;
  if (!bs) {
    return (
      <div style={{ padding: "24px 0" }}>
        <EmptyState title="No balance sheet data" />
      </div>
    );
  }

  const equity = bs.total_shareholders_equity ?? bs.shareholders_equity ?? bs.total_equity;
  const deRatio = bs.debt_to_equity_ratio != null ? Number(bs.debt_to_equity_ratio) : (bs.total_liabilities != null && equity ? Number(bs.total_liabilities) / Number(equity) : null);
  const currentRatio = bs.current_ratio != null ? Number(bs.current_ratio) : (bs.current_assets != null && bs.current_liabilities ? Number(bs.current_assets) / Number(bs.current_liabilities) : null);

  return (
    <div>
      <DataRow label="Total Assets" value={formatNum(bs.total_assets)} bold />
      <DataRow label="Total Liabilities" value={formatNum(bs.total_liabilities)} />
      <DataRow label="Shareholders Equity" value={formatNum(equity)} bold />
      <DataRow label="Debt-to-Equity" value={formatRatio(deRatio)} />
      <DataRow label="Current Ratio" value={formatRatio(currentRatio)} />
      <DataRow label="Cash & Equivalents" value={formatNum(bs.cash_and_equivalents)} />
      <DataRow label="Total Debt" value={formatNum(bs.total_debt)} />
    </div>
  );
}

function KeyRatios({
  company,
  data,
  loading,
  dividendYieldPct,
}: {
  company: CompanyDetail | null;
  data: FinancialStatementResponse | null;
  loading: boolean;
  dividendYieldPct?: number | null;
}) {
  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: "var(--mer-radius-sm)",
              background: "var(--mer-surface-2)",
            }}
            className="skeleton-shimmer"
          />
        ))}
      </div>
    );
  }

  const bs = data?.balance_sheet as Record<string, unknown> | null;
  const inc = data?.income_statement as Record<string, unknown> | null;
  const equity = bs?.total_shareholders_equity ?? bs?.shareholders_equity ?? bs?.total_equity;
  const totalAssets = bs?.total_assets;
  const roe = equity && inc?.net_income ? (Number(inc.net_income) / Number(equity)) * 100 : null;
  const roic = inc?.operating_income && totalAssets ? (Number(inc.operating_income) / Number(totalAssets)) * 100 : null;

  const ratios: { label: string; value: number | null; sectorAvg?: number | null }[] = [
    { label: "P/E Ratio", value: company?.pe_ratio ?? null },
    { label: "P/B Ratio", value: bs?.price_to_book != null ? Number(bs.price_to_book) : null },
    { label: "EV/EBITDA", value: bs?.ev_to_ebitda != null ? Number(bs.ev_to_ebitda) : null },
    { label: "ROE", value: roe },
    { label: "ROIC", value: roic },
    { label: "Dividend Yield", value: dividendYieldPct ?? null },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
      {ratios.map((r) => (
        <RatioCard key={r.label} label={r.label} value={r.value} sectorAvg={r.sectorAvg} />
      ))}
    </div>
  );
}

export function FundamentalsPanel({ financials, company, dividendYieldPct, loading = false }: FundamentalsPanelProps) {
  const [activeTab, setActiveTab] = React.useState<TabKey>("income");

  return (
    <>
      <style>{`
  .fundamentals-tab { transition: background 120ms ease, color 120ms ease, border-color 120ms ease; }
  .fundamentals-tab:hover:not(.fundamentals-tab--active) { background: rgba(255,255,255,0.035); }
  .fundamentals-row:hover { background: rgba(255,255,255,0.015); }
  .fundamentals-ratio-card { transition: border-color 120ms ease; }
  .fundamentals-ratio-card:hover { border-color: var(--mer-stroke-emphasis); }
`}</style>
    <div
      style={{
        background: "var(--mer-surface-1)",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-md)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
        }}
      >
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.key;
          const isLast = i === TABS.length - 1;
          return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={isActive ? "fundamentals-tab fundamentals-tab--active" : "fundamentals-tab"}
            style={{
              flex: 1,
              padding: "10px 12px",
              fontSize: "var(--fs-small)",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--mer-ink-primary)" : "var(--mer-ink-tertiary)",
              background: isActive ? "var(--mer-surface-2)" : "transparent",
              borderBottom: isActive ? "2px solid var(--mer-accent-500)" : "2px solid transparent",
              borderRight: isLast ? "none" : "1px solid var(--mer-stroke-hairline)",
              cursor: "pointer",
              transition: "all 120ms",
              textAlign: "center",
            }}
          >
            {tab.label}
          </button>
        );
        })}
      </div>
      <div style={{ padding: "12px 14px", minHeight: 160 }}>
        {activeTab === "income" && <IncomeStatement data={financials} loading={loading} />}
        {activeTab === "balance" && <BalanceSheet data={financials} loading={loading} />}
        {activeTab === "ratios" && (
          <KeyRatios company={company} data={financials} loading={loading} dividendYieldPct={dividendYieldPct} />
        )}
      </div>
    </div>
    </>
  );
}

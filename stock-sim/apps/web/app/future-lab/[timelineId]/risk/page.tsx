"use client";
import { useParams } from "next/navigation";
import { Metric, ResultShell } from "@/components/future-lab/ResultShell";
import { useTimelineAnalytics } from "@/lib/api/hooks/useSimulation";
import { usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { RiskTelemetry } from "@/components/future-lab/RiskTelemetry";
export default function RiskPage() {
  const id = Number(useParams<{ timelineId: string }>().timelineId);
  const { data } = useTimelineAnalytics(id);
  const { data: portfolio } = usePortfolioAnalytics(id);
  return (
    <ResultShell timelineId={id}>
      <div className="space-y-4"><div className="grid grid-cols-2 gap-px overflow-hidden border border-[#263246] bg-[#263246] lg:grid-cols-4">
        <Metric
          label="Volatility"
          value={
            data?.annualized_volatility_pct == null
              ? "—"
              : `${data.annualized_volatility_pct.toFixed(2)}%`
          }
        />
        <Metric
          label="Drawdown"
          value={
            data?.max_drawdown_pct == null
              ? "—"
              : `${data.max_drawdown_pct.toFixed(2)}%`
          }
        />
        <Metric
          label="Liquidity shift"
          value={
            data?.liquidity_change == null
              ? "—"
              : data.liquidity_change.toFixed(4)
          }
        />
        <Metric
          label="Scenario portfolio"
          value={
            portfolio?.total_value.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }) ?? "—"
          }
        />
        <Metric
          label="Portfolio return"
          value={
            portfolio
              ? `${portfolio.total_return_pct >= 0 ? "+" : ""}${portfolio.total_return_pct.toFixed(2)}%`
              : "—"
          }
        />
        <Metric
          label="Unrealized P&L"
          value={
            portfolio?.unrealized_pnl.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }) ?? "—"
          }
        />
        <Metric
          label="VaR"
          value={
            portfolio?.value_at_risk_pct == null
              ? "—"
              : `${portfolio.value_at_risk_pct.toFixed(2)}%`
          }
        />
        <Metric
          label="Breadth A/D/U"
          value={
            data
              ? `${data.breadth.advancers}/${data.breadth.decliners}/${data.breadth.unchanged}`
              : "—"
          }
        />
      </div>{data&&<RiskTelemetry data={data.market_path}/>}<section className="border border-[#263246] bg-[#070b11] p-4"><h2 className="font-mono text-xs font-semibold uppercase tracking-[.1em] text-white">Risk interpretation</h2><div className="mt-3 grid gap-3 text-[11px] text-[#8290a4] md:grid-cols-3"><p><b className="text-[#dbe5f2]">Volatility</b><br/>Annualized from persisted equal-weight market log returns.</p><p><b className="text-[#dbe5f2]">Drawdown</b><br/>Worst peak-to-trough loss along this exact scenario path.</p><p><b className="text-[#dbe5f2]">Liquidity</b><br/>Volume and signed order imbalance expose stress hidden by price alone.</p></div></section></div>
    </ResultShell>
  );
}

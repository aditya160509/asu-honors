"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn, formatMillions, formatPct, formatPrice } from "@/lib/utils";
import { useConCalls } from "@/lib/api/hooks/useConCalls";
import { useFinancialsHistory, useCompanyDividends } from "@/lib/api/hooks/useCompany";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { nextEarningsDate } from "@/lib/companies/earningsCalendar";
import type { CompanyDetail, ConCallItem, FinancialStatementResponse } from "@/lib/api/types";

export interface FinancialTabsProps {
  ticker: string;
  company: CompanyDetail | undefined;
  financials: FinancialStatementResponse | undefined;
  loading?: boolean;
}

function AboutTab({ company }: { company: CompanyDetail | undefined }) {
  if (!company) {
    return <EmptyState title="Company profile not available." />;
  }

  const facts: { label: string; value: string }[] = [
    { label: "Headquarters", value: company.headquarters ?? "N/A" },
    { label: "Founded", value: company.founded_year ? String(company.founded_year) : "N/A" },
    { label: "CEO", value: company.ceo ?? "N/A" },
    {
      label: "Employees",
      value: company.employee_count != null ? company.employee_count.toLocaleString("en-US") : "N/A",
    },
    { label: "Industry", value: company.industry_name },
  ];

  return (
    <div className="flex flex-col gap-4 py-2">
      {company.description && (
        <p className="text-small leading-relaxed text-mer-ink-secondary">{company.description}</p>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-0.5">
            <span className="text-micro font-medium uppercase text-mer-ink-tertiary">{fact.label}</span>
            <span className="text-small text-mer-ink-primary">{fact.value}</span>
          </div>
        ))}
      </div>

      {company.usp && (
        <div className={cn("flex flex-col gap-1 border-t pt-3", MER_HAIRLINE)}>
          <span className="text-micro font-medium uppercase text-mer-ink-tertiary">Competitive Differentiator</span>
          <p className="text-small leading-relaxed text-mer-ink-secondary">{company.usp}</p>
        </div>
      )}
    </div>
  );
}

function formatStatementValue(key: string, value: unknown): string {
  if (typeof value !== "number") return String(value);
  if (key === "eps") return formatPrice(value);
  if (key === "shares_diluted") return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return formatMillions(value);
}

function StatementTable({ statement }: { statement: Record<string, unknown> | null | undefined }) {
  if (!statement || Object.keys(statement).length === 0) {
    return <p className="py-4 text-small text-mer-ink-tertiary">No data for this statement.</p>;
  }
  return (
    <table className="table-dense w-full">
      <tbody>
        {Object.entries(statement).map(([key, value]) => (
          <tr key={key} className={cn("border-b", MER_HAIRLINE)}>
            <td className="py-1.5 text-mer-ink-secondary">{key.replace(/_/g, " ")}</td>
            <td className="num py-1.5 text-right text-mer-ink-primary">{formatStatementValue(key, value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TONE_VARIANT: Record<ConCallItem["tone"], "positive" | "negative" | "default"> = {
  confident: "positive",
  measured: "default",
  cautious: "default",
  defensive: "negative",
  evasive: "negative",
};

const BUCKET_VARIANT: Record<ConCallItem["performance_bucket"], "positive" | "negative" | "default"> = {
  beat: "positive",
  inline: "default",
  miss: "negative",
};

const STATEMENT_ORDER = ["opening", "revenue", "margins", "guidance", "closing"];

function ConCallTranscript({ call }: { call: ConCallItem }) {
  const sections = Object.entries(call.statements).sort(
    ([a], [b]) => STATEMENT_ORDER.indexOf(a) - STATEMENT_ORDER.indexOf(b),
  );
  return (
    <div className={cn("flex flex-col gap-2 border-b py-3 last:border-b-0", MER_HAIRLINE)}>
      <div className="flex items-center gap-2">
        <span className="text-small font-medium text-mer-ink-primary">{call.fiscal_period}</span>
        <Badge variant={BUCKET_VARIANT[call.performance_bucket]}>{call.performance_bucket}</Badge>
        <Badge variant={TONE_VARIANT[call.tone]}>{call.tone}</Badge>
        <span className="num text-micro text-mer-ink-tertiary">{call.call_date}</span>
        {call.actual_eps != null && call.consensus_eps != null && (
          <span className="num text-micro text-mer-ink-tertiary">
            Actual EPS {formatPrice(call.actual_eps)} vs. Consensus {formatPrice(call.consensus_eps)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {sections.map(([section, text]) => (
          <p key={section} className="text-small text-mer-ink-secondary">
            {text}
          </p>
        ))}
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <span className="text-micro font-medium uppercase text-mer-ink-tertiary">
          Guided Growth (management commentary)
        </span>
        <span className="num text-small font-medium text-mer-ink-primary">
          {formatPct(call.guidance_revenue_growth * 100)}
        </span>
      </div>
    </div>
  );
}

const TREND_METRICS: { key: string; label: string; isEps?: boolean }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "net_profit", label: "Net Profit" },
  { key: "eps", label: "EPS", isEps: true },
];

function pctChange(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function FinancialsTrendTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useFinancialsHistory(ticker, 8);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={16} />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={`No multi-quarter history for ${ticker} yet.`} />;
  }

  // API returns most-recent-first; display oldest -> newest, left to right.
  const periods = [...data].reverse();

  return (
    <div className="overflow-x-auto py-2">
      <table className="table-dense w-full">
        <thead>
          <tr className={cn("border-b", MER_HAIRLINE)}>
            <th className="py-1.5 text-left text-micro font-medium uppercase text-mer-ink-tertiary">Metric</th>
            {periods.map((p) => (
              <th key={p.fiscal_period} className="num py-1.5 text-right text-micro font-medium uppercase text-mer-ink-tertiary">
                {p.fiscal_period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TREND_METRICS.map((metric) => (
            <tr key={metric.key} className={cn("border-b", MER_HAIRLINE)}>
              <td className="py-1.5 text-mer-ink-secondary">{metric.label}</td>
              {periods.map((p, i) => {
                const raw = p.income_statement?.[metric.key];
                const value = typeof raw === "number" ? raw : null;
                const priorQ = i > 0 ? periods[i - 1].income_statement?.[metric.key] : null;
                const priorY = i > 3 ? periods[i - 4].income_statement?.[metric.key] : null;
                const qoq = pctChange(value, typeof priorQ === "number" ? priorQ : null);
                const yoy = pctChange(value, typeof priorY === "number" ? priorY : null);
                return (
                  <td key={p.fiscal_period} className="num py-1.5 text-right text-mer-ink-primary">
                    <div>{value == null ? "—" : metric.isEps ? formatPrice(value) : formatMillions(value)}</div>
                    {(qoq != null || yoy != null) && (
                      <div className="flex justify-end gap-2 text-micro text-mer-ink-tertiary">
                        {qoq != null && <span>QoQ {formatPct(qoq)}</span>}
                        {yoy != null && <span>YoY {formatPct(yoy)}</span>}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NextEarningsBanner() {
  const { data: simState } = useSimState();
  if (!simState) return null;
  const next = nextEarningsDate(simState.tick_count, simState.current_sim_date);
  return (
    <div className={cn("flex items-center gap-1.5 border-b pb-2 mb-2", MER_HAIRLINE)}>
      <span className="text-micro font-medium uppercase text-mer-ink-tertiary">Next Earnings</span>
      <span className="num text-small font-medium text-mer-ink-primary">
        {next.date} (~{next.daysUntil}d)
      </span>
    </div>
  );
}

function DividendsTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useCompanyDividends(ticker);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={16} />
        ))}
      </div>
    );
  }

  if (!data || data.history.length === 0) {
    return <EmptyState title={`${ticker} has no dividend history yet.`} />;
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-medium uppercase text-mer-ink-tertiary">Trailing 12M Yield</span>
        <span className="num text-small font-medium text-mer-ink-primary">
          {data.trailing_12m_yield_pct != null ? formatPct(data.trailing_12m_yield_pct) : "N/A"}
        </span>
      </div>
      <table className="table-dense w-full">
        <thead>
          <tr className={cn("border-b", MER_HAIRLINE)}>
            <th className="py-1.5 text-left text-micro font-medium uppercase text-mer-ink-tertiary">Ex-Date</th>
            <th className="py-1.5 text-left text-micro font-medium uppercase text-mer-ink-tertiary">Payment Date</th>
            <th className="num py-1.5 text-right text-micro font-medium uppercase text-mer-ink-tertiary">Amount/Share</th>
          </tr>
        </thead>
        <tbody>
          {data.history.map((d) => (
            <tr key={d.ex_date} className={cn("border-b", MER_HAIRLINE)}>
              <td className="py-1.5 text-mer-ink-secondary">{d.ex_date}</td>
              <td className="py-1.5 text-mer-ink-secondary">{d.payment_date}</td>
              <td className="num py-1.5 text-right text-mer-ink-primary">{formatPrice(d.amount_per_share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConCallsTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useConCalls({ ticker, limit: 8 });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={48} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <NextEarningsBanner />
      {!data || data.length === 0 ? (
        <EmptyState title={`No con-calls for ${ticker} yet.`} />
      ) : (
        data.map((call) => <ConCallTranscript key={call.id} call={call} />)
      )}
    </div>
  );
}

export function FinancialTabs({ ticker, company, financials, loading }: FinancialTabsProps) {
  if (loading) {
    return (
      <DashboardPanel eyebrow="Statements" title="Financials">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={14} />
          ))}
        </div>
      </DashboardPanel>
    );
  }

  const title = financials ? `Financials — ${financials.fiscal_period}` : "Financials";

  return (
    <DashboardPanel eyebrow="Statements" title={title}>
      <Tabs defaultValue="about">
        <TabsList>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="dividends">Dividends</TabsTrigger>
          <TabsTrigger value="concalls">Con-Calls</TabsTrigger>
        </TabsList>
        <TabsContent value="about">
          <AboutTab company={company} />
        </TabsContent>
        <TabsContent value="income">
          <StatementTable statement={financials?.income_statement} />
        </TabsContent>
        <TabsContent value="balance">
          <StatementTable statement={financials?.balance_sheet} />
        </TabsContent>
        <TabsContent value="cashflow">
          <StatementTable statement={financials?.cash_flow_statement} />
        </TabsContent>
        <TabsContent value="trend">
          <FinancialsTrendTab ticker={ticker} />
        </TabsContent>
        <TabsContent value="dividends">
          <DividendsTab ticker={ticker} />
        </TabsContent>
        <TabsContent value="concalls">
          <ConCallsTab ticker={ticker} />
        </TabsContent>
      </Tabs>
      {financials && !financials.income_statement && !financials.balance_sheet && !financials.cash_flow_statement && (
        <EmptyState title="Financial statements not available." />
      )}
    </DashboardPanel>
  );
}

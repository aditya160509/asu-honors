"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn, formatLarge } from "@/lib/utils";
import type { FinancialStatementResponse } from "@/lib/api/types";

export interface FinancialTabsProps {
  financials: FinancialStatementResponse | undefined;
  loading?: boolean;
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
            <td className="num py-1.5 text-right text-mer-ink-primary">
              {typeof value === "number" ? formatLarge(value) : String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FinancialTabs({ financials, loading }: FinancialTabsProps) {
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

  // Per SKILL.md 11: hide financials tab entirely when unavailable.
  if (!financials) return null;

  return (
    <DashboardPanel eyebrow="Statements" title={`Financials — ${financials.fiscal_period}`}>
      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        </TabsList>
        <TabsContent value="income">
          <StatementTable statement={financials.income_statement} />
        </TabsContent>
        <TabsContent value="balance">
          <StatementTable statement={financials.balance_sheet} />
        </TabsContent>
        <TabsContent value="cashflow">
          <StatementTable statement={financials.cash_flow_statement} />
        </TabsContent>
      </Tabs>
      {!financials.income_statement && !financials.balance_sheet && !financials.cash_flow_statement && (
        <EmptyState title="Financial statements not available." />
      )}
    </DashboardPanel>
  );
}

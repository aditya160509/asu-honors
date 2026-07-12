import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLarge } from "@/lib/utils";
import type { FinancialStatementResponse } from "@/lib/api/types";

export interface FinancialTabsProps {
  financials: FinancialStatementResponse | undefined;
  loading?: boolean;
}

function StatementTable({ statement }: { statement: Record<string, unknown> | null | undefined }) {
  if (!statement || Object.keys(statement).length === 0) {
    return <p className="text-small text-text-tertiary py-4">No data for this statement.</p>;
  }
  return (
    <table className="table-dense w-full">
      <tbody>
        {Object.entries(statement).map(([key, value]) => (
          <tr key={key}>
            <td className="text-text-secondary">{key.replace(/_/g, " ")}</td>
            <td className="num text-right text-text-primary">
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
      <div className="card-flat p-4 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={14} />
        ))}
      </div>
    );
  }

  if (!financials) {
    // Per SKILL.md 11: hide financials tab entirely when unavailable.
    return null;
  }

  return (
    <div className="card-flat p-4">
      <h3 className="text-header font-medium text-text-primary mb-2">
        Financials — {financials.fiscal_period}
      </h3>
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
    </div>
  );
}

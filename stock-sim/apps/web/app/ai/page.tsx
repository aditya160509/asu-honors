"use client";

import * as React from "react";
import { Activity, BookOpenText, Building2, MessageSquare, Newspaper, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { AiCapabilityLauncher } from "@/components/ai/AiCapabilityLauncher";
import { PortfolioQuickStatsPanel } from "@/components/ai/PortfolioQuickStatsPanel";
import { PortfolioReviewCard } from "@/components/ai/PortfolioReviewCard";
import { CompanyReviewWorkspacePanel } from "@/components/ai/CompanyReviewWorkspacePanel";
import { NewsTakeWorkspacePanel } from "@/components/ai/NewsTakeWorkspacePanel";
import { StrategyBuilderForm } from "@/components/ai/StrategyBuilderForm";
import { MetricsGlossaryPanel } from "@/components/ai/MetricsGlossaryPanel";

const TABS = [
  { value: "chat", label: "Chat", icon: MessageSquare, description: "Ask about your portfolio or the market, streamed in real time." },
  { value: "portfolio-review", label: "Portfolio Review", icon: Wallet, description: "A grounded narrative review of your current simulated holdings." },
  { value: "company-review", label: "Company Analysis", icon: Building2, description: "Search any ticker for a grounded valuation & fundamentals review." },
  { value: "news-take", label: "News Take", icon: Newspaper, description: "\"What happened\" + \"why it might matter\" on recent headlines." },
  { value: "strategy-builder", label: "Strategy Builder", icon: ShieldAlert, description: "A single-turn, illustrative allocation suggestion for a stated goal." },
  { value: "explain-metrics", label: "Explain Metrics", icon: BookOpenText, description: "A clickable glossary of common financial terms." },
] as const;

/** AI Workspace (PHASE_5_AI_WORKSPACE.md) -- a dense, multi-panel hub
 * matching the rest of the app's dashboard/terminal density (Dashboard's
 * KPI grid, Simulation's always-visible side panels) rather than a single
 * centered column. All 6 capabilities are real, functional, in-page tabs --
 * Company Review and News Take used to just link out to the Company/News
 * pages; they're now a real ticker search and a real news list here too. */
export default function AiWorkspacePage() {
  const [tab, setTab] = React.useState<string>("chat");
  const [messagesSent, setMessagesSent] = React.useState(0);
  const [reviewsGenerated, setReviewsGenerated] = React.useState(0);
  const [companyReviews, setCompanyReviews] = React.useState(0);
  const [newsTakes, setNewsTakes] = React.useState(0);
  const [strategiesBuilt, setStrategiesBuilt] = React.useState(0);
  const [metricsExplained, setMetricsExplained] = React.useState(0);

  const activeDescription = TABS.find((t) => t.value === tab)?.description;

  return (
    <TerminalShell>
      <PageHeader
        title="AI Workspace"
        description="AI-generated, grounded in your real simulated data -- never real financial advice."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AiCapabilityLauncher activeTab={tab} onSelectTab={setTab} className="lg:col-span-8" />
        <DashboardPanel
          eyebrow="This Session"
          title="AI Activity"
          icon={Activity}
          className="lg:col-span-4"
          bodyClassName="grid grid-cols-3 gap-x-3 gap-y-4"
        >
          <KpiCounter label="Messages" value={messagesSent} format="number" icon={MessageSquare} />
          <KpiCounter label="Reviews" value={reviewsGenerated} format="number" icon={Wallet} />
          <KpiCounter label="Companies" value={companyReviews} format="number" icon={Building2} />
          <KpiCounter label="News Takes" value={newsTakes} format="number" icon={Newspaper} />
          <KpiCounter label="Strategies" value={strategiesBuilt} format="number" icon={ShieldAlert} />
          <KpiCounter label="Terms" value={metricsExplained} format="number" icon={BookOpenText} />
        </DashboardPanel>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon size={13} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="pt-2 text-micro text-mer-ink-tertiary">{activeDescription}</p>

        <TabsContent value="chat">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <AiChatPanel heightClassName="h-[calc(100vh-380px)] min-h-[520px]" onMessageSent={() => setMessagesSent((c) => c + 1)} />
            </div>
            <div className="lg:col-span-4">
              <PortfolioQuickStatsPanel />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="portfolio-review">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <PortfolioReviewCard onGenerated={() => setReviewsGenerated((c) => c + 1)} className="lg:col-span-7" />
            <PortfolioQuickStatsPanel className="lg:col-span-5" />
          </div>
        </TabsContent>

        <TabsContent value="company-review">
          <CompanyReviewWorkspacePanel onGenerated={() => setCompanyReviews((c) => c + 1)} />
        </TabsContent>

        <TabsContent value="news-take">
          <NewsTakeWorkspacePanel onGenerated={() => setNewsTakes((c) => c + 1)} />
        </TabsContent>

        <TabsContent value="strategy-builder">
          <StrategyBuilderForm onGenerated={() => setStrategiesBuilt((c) => c + 1)} />
        </TabsContent>

        <TabsContent value="explain-metrics">
          <MetricsGlossaryPanel onExplained={() => setMetricsExplained((c) => c + 1)} />
        </TabsContent>
      </Tabs>

      <div className="mt-2 flex items-center gap-1.5 text-micro text-mer-ink-tertiary">
        <Sparkles size={11} className="text-[#8b7cf6]" />
        Every AI feature here also lives inline where it&apos;s contextually useful -- metric tooltips, the Company page, and News cards all use the exact same capabilities.
      </div>
    </TerminalShell>
  );
}

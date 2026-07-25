"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { PortfolioQuickStatsPanel } from "@/components/ai/PortfolioQuickStatsPanel";

export default function AiChatPage() {
  const [messagesSent, setMessagesSent] = React.useState(0);
  return (
    <TerminalShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ai" className="flex items-center gap-1 text-[13px] text-mer-ink-tertiary transition-colors hover:text-mer-ink-primary">
          <ArrowLeft size={14} /> AI Workspace
        </Link>
      </div>
      <PageHeader title="AI Chat" description="Ask about your portfolio or the market, streamed in real time." icon={MessageSquare} />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AiChatPanel heightClassName="h-[calc(100vh-340px)] min-h-[520px]" onMessageSent={() => setMessagesSent((c) => c + 1)} />
        </div>
        <div className="lg:col-span-4">
          <PortfolioQuickStatsPanel />
        </div>
      </div>
    </TerminalShell>
  );
}

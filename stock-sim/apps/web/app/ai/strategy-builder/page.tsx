"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StrategyBuilderForm } from "@/components/ai/StrategyBuilderForm";

export default function StrategyBuilderPage() {
  const [count, setCount] = React.useState(0);
  return (
    <TerminalShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ai" className="flex items-center gap-1 text-[13px] text-mer-ink-tertiary transition-colors hover:text-mer-ink-primary">
          <ArrowLeft size={14} /> AI Workspace
        </Link>
      </div>
      <PageHeader title="Strategy Builder" description="A single-turn, illustrative allocation suggestion for a stated goal." icon={ShieldAlert} />
      <div className="mt-4">
        <StrategyBuilderForm onGenerated={() => setCount((c) => c + 1)} />
      </div>
    </TerminalShell>
  );
}

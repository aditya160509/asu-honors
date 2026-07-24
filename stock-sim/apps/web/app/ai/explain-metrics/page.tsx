"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricsGlossaryPanel } from "@/components/ai/MetricsGlossaryPanel";

export default function ExplainMetricsPage() {
  const [count, setCount] = React.useState(0);
  return (
    <TerminalShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ai" className="flex items-center gap-1 text-[13px] text-mer-ink-tertiary transition-colors hover:text-mer-ink-primary">
          <ArrowLeft size={14} /> AI Workspace
        </Link>
      </div>
      <PageHeader title="Explain Metrics" description="A clickable glossary of common financial terms." icon={BookOpenText} />
      <div className="mt-4">
        <MetricsGlossaryPanel onExplained={() => setCount((c) => c + 1)} />
      </div>
    </TerminalShell>
  );
}

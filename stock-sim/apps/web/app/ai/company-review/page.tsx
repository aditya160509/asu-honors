"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompanyReviewWorkspacePanel } from "@/components/ai/CompanyReviewWorkspacePanel";

export default function CompanyReviewPage() {
  const [count, setCount] = React.useState(0);
  return (
    <TerminalShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ai" className="flex items-center gap-1 text-[13px] text-mer-ink-tertiary transition-colors hover:text-mer-ink-primary">
          <ArrowLeft size={14} /> AI Workspace
        </Link>
      </div>
      <PageHeader title="Company Analysis" description="Search any ticker for a grounded valuation & fundamentals review." icon={Building2} />
      <div className="mt-4">
        <CompanyReviewWorkspacePanel onGenerated={() => setCount((c) => c + 1)} />
      </div>
    </TerminalShell>
  );
}

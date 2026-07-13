"use client";

import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewsFeed } from "@/components/news/NewsFeed";

export default function NewsPage() {
  return (
    <TerminalShell>
      <PageHeader title="News" description="Simulated market events driving price and factor-score movement." />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <NewsFeed />
        <div className="card-flat p-4 h-fit">
          <h3 className="text-header font-medium text-text-primary mb-2">Filters</h3>
          <p className="text-small text-text-tertiary">
            Company and severity filters apply from the company detail page. Global filtering coming soon.
          </p>
        </div>
      </div>
    </TerminalShell>
  );
}

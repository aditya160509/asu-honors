"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { MarketExplorer } from "@/components/market/MarketExplorer";
import { TimeMachineControl } from "@/components/market/TimeMachineControl";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";

// Bloomberg-terminal rebuild: no title block, no breadcrumb-adjacent chrome
// above the screener itself — the Command Line + Status Line (66px total)
// are the only chrome above the column headers, per the terminal spec's
// "density is fine, chrome is not" principle.
export default function MarketPage() {
  const [asOfDate, setAsOfDate] = React.useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useMarketGrid(undefined, asOfDate);
  // Live sim date bounds the time-machine picker/playback — polled
  // independently of the (possibly historical) grid query above.
  const cycle = useCycleState();

  return (
    <TerminalShell noPadding>
      <MarketExplorer
        companies={data?.companies ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
        historicalDate={asOfDate}
        timeMachine={
          cycle.data?.sim_date ? (
            <TimeMachineControl asOfDate={asOfDate} maxDate={cycle.data.sim_date} onDateChange={setAsOfDate} />
          ) : undefined
        }
      />
    </TerminalShell>
  );
}

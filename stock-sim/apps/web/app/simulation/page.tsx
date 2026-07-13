import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdvanceControls } from "@/components/simulation/AdvanceControls";
import { TimelineBranch } from "@/components/simulation/TimelineBranch";

export default function SimulationPage() {
  return (
    <TerminalShell>
      <PageHeader title="Simulation" description="Advance the economic clock and manage timeline branches." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdvanceControls />
        <TimelineBranch />
      </div>
    </TerminalShell>
  );
}

import { TerminalShell } from "@/components/layout/TerminalShell";
import { AdvanceControls } from "@/components/simulation/AdvanceControls";
import { TimelineBranch } from "@/components/simulation/TimelineBranch";

export default function SimulationPage() {
  return (
    <TerminalShell>
      <h1 className="text-h2 font-semibold text-text-primary mb-4">Simulation</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdvanceControls />
        <TimelineBranch />
      </div>
    </TerminalShell>
  );
}

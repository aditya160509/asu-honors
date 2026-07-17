import { TerminalShell } from "@/components/layout/TerminalShell";
import { SimulationTradingView } from "@/components/simulation/SimulationTradingView";

export default function SimulationPage() {
  return (
    <TerminalShell>
      <SimulationTradingView />
    </TerminalShell>
  );
}

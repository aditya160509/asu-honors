import { TerminalShell } from "@/components/layout/TerminalShell";
import { SimulationPageContent } from "@/components/simulation/SimulationPageContent";

export default function SimulationPage() {
  return (
    <TerminalShell>
      <SimulationPageContent />
    </TerminalShell>
  );
}

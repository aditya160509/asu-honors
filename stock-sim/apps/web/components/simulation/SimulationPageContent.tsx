"use client";

import * as React from "react";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulationTradingView } from "@/components/simulation/SimulationTradingView";
import { FutureLabView } from "@/components/simulation/future-lab/FutureLabView";

/** Top-level toggle between the normal trading view and Future Lab
 * (branching/scenario simulation) mode, both living inside the single
 * /simulation page rather than as a separate route. */
export function SimulationPageContent() {
  const [futureLabOpen, setFutureLabOpen] = React.useState(false);

  return (
    <div className="relative h-full">
      {!futureLabOpen && (
        <div className="absolute right-3 top-3 z-20">
          <Button size="sm" onClick={() => setFutureLabOpen(true)}>
            <FlaskConical size={14} />
            Future Lab
          </Button>
        </div>
      )}

      {futureLabOpen ? (
        <FutureLabView onClose={() => setFutureLabOpen(false)} />
      ) : (
        <SimulationTradingView />
      )}
    </div>
  );
}

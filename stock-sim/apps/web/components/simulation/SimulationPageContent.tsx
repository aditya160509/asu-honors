"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulationTradingView } from "@/components/simulation/SimulationTradingView";
import { FutureLabView } from "@/components/simulation/future-lab/FutureLabView";

/** Top-level toggle between the normal trading view and Future Lab
 * (branching/scenario simulation) mode, both living inside the single
 * /simulation page rather than as a separate route. Reflected in
 * ?mode=future-lab (not just local state) so a copied link
 * (TimelineComparisonView's "Copy link") reopens into the same mode instead
 * of dropping the recipient onto the trading view. */
export function SimulationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const futureLabOpen = searchParams.get("mode") === "future-lab";

  function setFutureLabOpen(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("mode", "future-lab");
    else params.delete("mode");
    router.replace(params.toString() ? `/simulation?${params.toString()}` : "/simulation");
  }

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

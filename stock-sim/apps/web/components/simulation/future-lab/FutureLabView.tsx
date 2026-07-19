"use client";

import * as React from "react";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineBranch } from "@/components/simulation/TimelineBranch";
import { TimelineComparisonView } from "@/components/simulation/comparison/TimelineComparisonView";

interface Props {
  onClose: () => void;
}

/** Future Lab (Section 11): alternate-future simulation. Hosts the branch
 * list + creation wizard and the N-way timeline comparison UI in one place,
 * as a mode inside /simulation rather than a separate route. */
export function FutureLabView({ onClose }: Props) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-accent" />
          <h1 className="text-h2 font-medium text-text-primary">Future Lab</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft size={14} />
          Back to trading
        </Button>
      </div>
      <p className="text-small text-text-secondary mb-5">
        Branch the simulation to test &quot;what if&quot; scenarios — recessions, liquidity shocks,
        structural overrides — without ever touching the live market. Branches never write back
        to the live timeline automatically.
      </p>

      <div className="flex flex-col gap-5">
        <TimelineBranch />
        <TimelineComparisonView />
      </div>
    </div>
  );
}

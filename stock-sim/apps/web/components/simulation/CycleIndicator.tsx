import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PHASE_VARIANT: Record<string, "positive" | "warning" | "negative" | "accent"> = {
  expansion: "positive",
  peak: "warning",
  contraction: "negative",
  trough: "accent",
};

export interface CycleIndicatorProps {
  phase: string;
  tooltip?: string;
}

export function CycleIndicator({ phase, tooltip }: CycleIndicatorProps) {
  const key = phase.toLowerCase();
  const variant = PHASE_VARIANT[key] ?? "default";
  const badge = <Badge variant={variant as "positive" | "warning" | "negative" | "accent"}>{phase}</Badge>;

  if (!tooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

"use client";

import * as React from "react";
import { Check, Copy, RotateCw, Shield, ShieldAlert, ShieldHalf, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { ApiError } from "@/lib/api/client";
import { useRelativeTime } from "@/lib/ai/useRelativeTime";
import { useStrategyBuilder } from "@/lib/api/hooks/useAi";
import { cn } from "@/lib/utils";
import type { StrategyRiskTolerance, StrategyTimeHorizon } from "@/lib/api/types";

const RISK_OPTIONS: { value: StrategyRiskTolerance; label: string; icon: typeof Shield }[] = [
  { value: "conservative", label: "Conservative", icon: Shield },
  { value: "moderate", label: "Moderate", icon: ShieldHalf },
  { value: "aggressive", label: "Aggressive", icon: ShieldAlert },
];

const HORIZON_OPTIONS: { value: StrategyTimeHorizon; label: string }[] = [
  { value: "<1yr", label: "< 1 year" },
  { value: "1-5yr", label: "1–5 years" },
  { value: "5yr+", label: "5+ years" },
];

const GOAL_PRESETS = ["Grow long-term wealth", "Generate steady income", "Preserve capital", "Save for retirement"];

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof Shield }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-mer-sm px-2.5 py-1 text-micro font-medium uppercase tracking-wide transition-colors",
              value === opt.value ? "bg-mer-surface-3 text-mer-ink-primary" : "text-mer-ink-tertiary hover:text-mer-ink-secondary"
            )}
          >
            {Icon && <Icon size={12} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-mer-ink-tertiary"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * Strategy Builder (C6) -- single-turn, not conversational (scope narrowed
 * per PHASE_5_AI_WORKSPACE.md's own note). Structured form on one side, the
 * resulting AI card on the other; "Generate another" re-runs with adjusted
 * inputs rather than a chat-style refinement loop.
 */
export function StrategyBuilderForm({ onGenerated }: { onGenerated?: () => void } = {}) {
  const [riskTolerance, setRiskTolerance] = React.useState<StrategyRiskTolerance>("moderate");
  const [timeHorizon, setTimeHorizon] = React.useState<StrategyTimeHorizon>("1-5yr");
  const [goal, setGoal] = React.useState("");
  const [useContext, setUseContext] = React.useState(false);
  // Keyed by the exact form inputs (see useAi.ts) -- identical inputs reuse
  // the cached result for free (surviving a tab switch/remount), while
  // editing the goal text correctly drops back to "not generated yet"
  // for that new combination rather than showing a stale answer.
  const strategy = useStrategyBuilder({
    risk_tolerance: riskTolerance,
    goal: goal.trim(),
    time_horizon: timeHorizon,
    use_context: useContext,
  });

  const notConfigured = strategy.error instanceof ApiError && strategy.error.status === 503;
  const upstreamUnavailable = strategy.error instanceof ApiError && strategy.error.status === 502;
  const relativeTime = useRelativeTime(strategy.generatedAt);

  function generate() {
    if (!goal.trim()) return;
    strategy.generate().then((result) => {
      if (result.data) onGenerated?.();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <DashboardPanel eyebrow="Strategy Inputs" title="Build a Strategy" icon={ShieldAlert}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">Risk tolerance</span>
            <SegmentedControl value={riskTolerance} options={RISK_OPTIONS} onChange={setRiskTolerance} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">Time horizon</span>
            <SegmentedControl value={timeHorizon} options={HORIZON_OPTIONS} onChange={setTimeHorizon} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="strategy-goal" className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
              Investment goal
            </label>
            <Input
              id="strategy-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. grow long-term wealth, save for retirement"
              maxLength={200}
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGoal(preset)}
                  className="rounded-full border border-[color:var(--mer-stroke-hairline)] px-2.5 py-1 text-micro text-mer-ink-secondary hover:border-[#8b7cf6] hover:text-[#8b7cf6]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-micro text-mer-ink-tertiary">
            <input
              type="checkbox"
              checked={useContext}
              onChange={(e) => setUseContext(e.target.checked)}
              className="size-3.5 accent-[#8b7cf6]"
            />
            Factor in my current simulated portfolio
          </label>
          <Button type="submit" disabled={!goal.trim() || strategy.isPending} className="self-start">
            {strategy.isPending ? "Generating..." : strategy.data ? "Generate another" : "Generate Strategy"}
          </Button>
        </form>
      </DashboardPanel>

      <DashboardPanel
        eyebrow="✦ AI STRATEGY SUGGESTION"
        title="Suggested Strategy"
        icon={Sparkles}
        edge="iris"
        actions={
          strategy.data && !strategy.isPending ? (
            <div className="flex items-center gap-1">
              {relativeTime && <span className="num mr-1 text-micro text-mer-ink-tertiary">{relativeTime}</span>}
              <CopyButton text={strategy.data.narrative} />
              <Button variant="ghost" size="sm" onClick={generate} className="gap-1 text-mer-ink-tertiary">
                <RotateCw size={12} />
                Regenerate
              </Button>
            </div>
          ) : (
            <Badge variant="default" className="border border-[color:var(--mer-stroke-hairline)] text-[#8b7cf6]">
              AI
            </Badge>
          )
        }
      >
        {strategy.isPending ? (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-micro text-[#8b7cf6]">
              <Sparkles size={11} className="animate-pulse" />
              Thinking...
            </span>
            <Skeleton width="100%" height={14} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="80%" height={14} />
          </div>
        ) : strategy.isError ? (
          <EmptyState
            title={
              notConfigured
                ? "AI advisor isn't configured yet."
                : upstreamUnavailable
                  ? "The AI provider is temporarily unavailable."
                  : "Couldn't generate a strategy right now."
            }
            description={
              notConfigured
                ? "Ask whoever runs this deployment to set GEMINI_API_KEY."
                : upstreamUnavailable
                  ? "This is a Gemini-side capacity issue -- try again shortly."
                  : "Try again in a moment."
            }
          />
        ) : strategy.data ? (
          <div className="flex flex-col gap-3">
            <AiMarkdown text={strategy.data.narrative} />
            <div className={cn("flex items-start gap-2 border-t pt-3", MER_HAIRLINE)}>
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-micro leading-relaxed text-mer-ink-tertiary">{strategy.data.disclaimer}</p>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No strategy generated yet."
            description="Fill in the form above and generate an illustrative, educational suggestion."
          />
        )}
      </DashboardPanel>
    </div>
  );
}

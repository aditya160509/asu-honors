"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, RotateCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { ApiError } from "@/lib/api/client";
import { useRelativeTime } from "@/lib/ai/useRelativeTime";
import { cn } from "@/lib/utils";
import type { AiGroundedResponse } from "@/lib/api/types";

export interface AiGroundedCardProps {
  /** e.g. "AI PORTFOLIO REVIEW" -- rendered after the reserved ✦ marker. */
  badgeLabel: string;
  title: string;
  /** e.g. "Generate Review" */
  actionLabel: string;
  data: AiGroundedResponse | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onGenerate: () => void;
  /** ms epoch of when `data` was generated -- renders as a live "3m ago" label. */
  generatedAt?: number | null;
  className?: string;
  /** Skip the DashboardPanel chrome (border/header) -- for embedding inside
   * a tab or another panel that already provides one, avoiding a nested
   * double-card look. */
  bare?: boolean;
  /** Extra content (e.g. a mini data viz) rendered between the narrative
   * and the evidence chips, only once real data exists. */
  children?: React.ReactNode;
}

const TICKER_PATTERN = /^[A-Z]{1,6}$/;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-mer-ink-tertiary transition-all duration-150 active:scale-90"
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
 * DESIGN_SPEC's "AI card" (iris top edge, ✦ badge header) applied to the
 * three capabilities sharing the AiGroundedResponse contract (Portfolio
 * Review, Company Review, Explain News): a narrative plus evidence chips
 * tracing every cited figure back to a real field. Fault-isolated by
 * design (PHASE_5_AI_WORKSPACE.md) -- a failed generation renders a
 * contained error state here, never breaks the page it's embedded in.
 */
export function AiGroundedCard({
  badgeLabel,
  title,
  actionLabel,
  data,
  isPending,
  isError,
  error,
  onGenerate,
  generatedAt,
  className,
  bare,
  children,
}: AiGroundedCardProps) {
  const notConfigured = error instanceof ApiError && error.status === 503;
  const upstreamUnavailable = error instanceof ApiError && error.status === 502;
  const relativeTime = useRelativeTime(generatedAt ?? null);

  const actions = (
    <div className="flex items-center gap-1.5">
      {data && !isPending && relativeTime && (
        <span className="num mr-1 text-micro text-mer-ink-tertiary">{relativeTime}</span>
      )}
      {data && !isPending && <CopyButton text={data.text} />}
      {data && !isPending ? (
        <Button variant="ghost" size="sm" onClick={onGenerate} className="gap-1 text-mer-ink-tertiary transition-all duration-150 active:scale-90">
          <RotateCw size={12} />
          Regenerate
        </Button>
      ) : (
        <Badge variant="default" className="border border-[color:var(--mer-stroke-hairline)] text-[#8b7cf6] transition-all duration-150">
          AI
        </Badge>
      )}
    </div>
  );

  const body = isPending ? (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-1.5 text-micro text-[#8b7cf6]">
        <Sparkles size={11} className="animate-pulse motion-reduce:animate-none" />
        Thinking...
      </span>
      <Skeleton width="100%" height={14} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
    </div>
  ) : isError ? (
    <EmptyState
      title={
        notConfigured
          ? "AI advisor isn't configured yet."
          : upstreamUnavailable
            ? "The AI provider is temporarily unavailable."
            : "Couldn't generate this right now."
      }
      description={
        notConfigured
          ? "Ask whoever runs this deployment to set GEMINI_API_KEY."
          : upstreamUnavailable
            ? "This is a Gemini-side capacity issue, not a problem with your setup -- try again shortly."
            : "The request failed -- try again in a moment."
      }
      action={notConfigured ? undefined : { label: "Try again", onClick: onGenerate }}
    />
  ) : data ? (
    <div className="flex flex-col gap-3">
      <AiMarkdown text={data.text} />
      {children}
      {data.evidence.length > 0 && (
        <div className={cn("flex flex-wrap gap-2 border-t pt-3", MER_HAIRLINE)}>
          {data.evidence.map((item, i) => {
            const chip = (
              <Badge
                variant="default"
                className={cn(
                  "text-mer-ink-tertiary transition-all duration-150",
                  item.type === "holding" && TICKER_PATTERN.test(item.ref_id) && "hover:text-[#8b7cf6] hover:underline hover:shadow-mer-raised"
                )}
              >
                {item.label}
              </Badge>
            );
            if (item.type === "holding" && TICKER_PATTERN.test(item.ref_id)) {
              return (
                <Link key={`${item.type}-${item.ref_id}-${i}`} href={`/companies/${item.ref_id}`}>
                  {chip}
                </Link>
              );
            }
            return <React.Fragment key={`${item.type}-${item.ref_id}-${i}`}>{chip}</React.Fragment>;
          })}
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {/* Real live data (e.g. a mini chart) shown even before generating --
       * an empty card with just a button is the exact "blank" complaint
       * this is fixing; the underlying numbers are already loaded either
       * way, no reason to hide them behind a click. */}
      {children}
      <EmptyState
        icon={Sparkles}
        title="No AI review generated yet."
        description="Generate one on demand -- nothing runs automatically."
        action={{ label: actionLabel, onClick: onGenerate }}
      />
    </div>
  );

  if (bare) {
    return (
      <div className={cn("flex flex-col gap-3 py-2", className)}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wide text-[#8b7cf6]">
            <Sparkles size={11} />
            {badgeLabel}
          </span>
          {actions}
        </div>
        {body}
      </div>
    );
  }

  return (
    <DashboardPanel eyebrow={`✦ ${badgeLabel}`} title={title} icon={Sparkles} edge="iris" className={className} actions={actions}>
      {body}
    </DashboardPanel>
  );
}

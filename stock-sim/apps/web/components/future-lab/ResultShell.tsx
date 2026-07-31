"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowLeft, Download } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { download } from "@/lib/api/client";
import { useDuplicateTimeline, useRenameTimeline, useTimelineProgress, useTimelines } from "@/lib/api/hooks/useSimulation";

const sections = [
  ["", "Overview"], ["drivers", "Drivers"], ["risk", "Risk & market"],
  ["compare", "Compare"], ["ensemble", "Ensemble"], ["audit", "Audit & export"],
] as const;

export function ResultShell({ timelineId, children }: { timelineId: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: timelines = [] } = useTimelines();
  const timeline = timelines.find((item) => item.id === timelineId);
  const { data: status } = useTimelineProgress(timelineId);
  const rename = useRenameTimeline();
  const duplicate = useDuplicateTimeline();
  async function exportFile(format: "json" | "csv" | "pdf") {
    const result = await download(`/sim/timelines/${timelineId}/export`, { format });
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = result.filename ?? `future-lab-${timelineId}.${format}`; anchor.click();
    URL.revokeObjectURL(url);
  }
  return <TerminalShell noPadding><main className="min-h-full overflow-auto bg-[var(--mer-bg-canvas)]">
    <header className="border-b border-[var(--mer-stroke-hairline)] bg-[#0a0e14] px-6 py-5 lg:px-10">
      <div className="mx-auto max-w-[1500px]"><Link href="/future-lab" className="inline-flex items-center gap-1 text-[11px] text-[var(--mer-ink-muted)] hover:text-white"><ArrowLeft size={12}/>All experiments</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[.18em] text-[var(--mer-accent-300)]">Future Lab / Timeline {timelineId}</div><h1 className="mt-1 text-2xl font-semibold text-[var(--mer-ink-primary)]">{timeline?.name ?? "Experiment result"}</h1><div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--mer-ink-muted)]"><span className="inline-flex items-center gap-1"><Activity size={11}/>{status?.status ?? timeline?.status ?? "loading"}</span><span>{status?.current_sim_date ?? "—"}</span><span>{status?.completed_ticks ?? 0}/{status?.requested_ticks ?? 0} run ticks</span></div></div>
          <div className="flex flex-wrap gap-1"><button onClick={()=>{const name=window.prompt("Rename experiment",timeline?.name);if(name)rename.mutate({timelineId,name});}} className="border border-[var(--mer-stroke-hairline)] px-2 py-1.5 text-[10px] uppercase text-[var(--mer-ink-secondary)]">Rename</button><button onClick={()=>{const name=window.prompt("Duplicate as",`${timeline?.name??"Experiment"} copy`);if(name)duplicate.mutate({timelineId,name});}} className="border border-[var(--mer-stroke-hairline)] px-2 py-1.5 text-[10px] uppercase text-[var(--mer-ink-secondary)]">Duplicate</button>{(["json","csv","pdf"] as const).map((format)=><button key={format} onClick={()=>void exportFile(format)} className="inline-flex items-center gap-1 border border-[var(--mer-stroke-hairline)] px-2 py-1.5 text-[10px] uppercase text-[var(--mer-ink-secondary)] hover:text-white"><Download size={11}/>{format}</button>)}</div></div>
        {(status?.status === "running" || status?.status === "pending") && <div className="mt-4 h-1 overflow-hidden bg-white/5"><div className="h-full bg-[var(--mer-accent-300)] transition-[width]" style={{width:`${status.progress_pct}%`}}/></div>}
      </div>
    </header>
    <nav className="sticky top-0 z-10 border-b border-[var(--mer-stroke-hairline)] bg-[rgba(10,14,20,.94)] px-6 backdrop-blur lg:px-10"><div className="mx-auto flex max-w-[1500px] overflow-x-auto">{sections.map(([slug,label])=>{const href=`/future-lab/${timelineId}${slug?`/${slug}`:""}`; const active=pathname===href; return <Link key={slug} href={href} className={`border-b-2 px-4 py-3 text-[11px] uppercase tracking-[.08em] ${active?"border-[var(--mer-accent-300)] text-white":"border-transparent text-[var(--mer-ink-muted)] hover:text-white"}`}>{label}</Link>;})}</div></nav>
    <div className="mx-auto max-w-[1500px] px-6 py-6 lg:px-10">{children}</div>
  </main></TerminalShell>;
}

export function Metric({label,value}:{label:string;value:string}) { return <div className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4"><div className="text-[10px] uppercase tracking-[.1em] text-[var(--mer-ink-muted)]">{label}</div><div className="mt-2 font-mono text-lg text-[var(--mer-ink-primary)]">{value}</div></div>; }

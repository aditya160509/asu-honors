# FutureLab Page Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the "Future Lab" branching-simulation feature out of `/simulation` (where it currently lives as a client-side overlay mode toggled by `?mode=future-lab`) into its own top-level route at `/future-lab`, with a matching sidebar nav entry, and no functional/behavioral change to the feature itself.

**Architecture:** Next.js App Router. Relocate the three component directories that make up Future Lab (`future-lab/`, `branch-wizard/`, `comparison/`) from under `components/simulation/` to a new `components/future-lab/` directory (as siblings, preserving their existing relative-import structure), create a new route file that renders the relocated view directly (no `onClose` callback — it's a full page now), strip the overlay logic out of `SimulationPageContent.tsx`, and add a sidebar nav entry.

**Tech Stack:** Next.js 14+ (App Router), React, TypeScript, Tailwind, `@/*` path alias resolving from `apps/web/`.

## Global Constraints

- No functional/behavioral change to Future Lab — this is a pure relocation refactor.
- All cross-file imports within the moved directories use relative imports (`./X`) today and must continue to work unchanged after the move (verified: no imports cross the boundary between `future-lab/`, `branch-wizard/`, `comparison/` and files outside them other than via the `@/` alias, which is location-independent).
- `TimelineBranch.tsx` (`apps/web/components/simulation/TimelineBranch.tsx`) is NOT moved — it stays under `components/simulation/` and is referenced from the new `components/future-lab/FutureLabView.tsx` via the `@/` alias.
- Do not touch backend code (`branch_service.py`, `scenario_service.py`, `timeline_group_service.py`, routers) — already page-agnostic.

---

### Task 1: Relocate Future Lab component directories

**Files:**
- Move: `apps/web/components/simulation/future-lab/FutureLabView.tsx` → `apps/web/components/future-lab/FutureLabView.tsx`
- Move: `apps/web/components/simulation/branch-wizard/*` → `apps/web/components/future-lab/branch-wizard/*` (all 11 files: `BranchPointStep.tsx`, `BranchWizard.tsx`, `ConfigureStep.tsx`, `ConfirmStep.tsx`, `FastForwardStep.tsx`, `marketComparison.test.ts`, `marketComparison.ts`, `outcomeSummary.test.ts`, `outcomeSummary.ts`, `PrimitiveStep.test.tsx`, `PrimitiveStep.tsx`)
- Move: `apps/web/components/simulation/comparison/*` → `apps/web/components/future-lab/comparison/*` (all 4 files: `EnsembleFanChart.tsx`, `OutcomeHistogram.tsx`, `StructuralDiffTable.tsx`, `TimelineComparisonView.tsx`)

**Interfaces:**
- Consumes: nothing (this is a pure file move).
- Produces: `@/components/future-lab/FutureLabView` (exports `FutureLabView`), `@/components/future-lab/comparison/TimelineComparisonView` (exports `TimelineComparisonView`) — Task 2 imports these.

- [ ] **Step 1: Move the three directories with `git mv`**

```bash
cd "stock-sim/apps/web/components"
git mv simulation/future-lab future-lab
git mv simulation/branch-wizard future-lab/branch-wizard
git mv simulation/comparison future-lab/comparison
```

Verify the resulting layout:

```bash
find future-lab -type f | sort
```

Expected output:
```
future-lab/FutureLabView.tsx
future-lab/branch-wizard/BranchPointStep.tsx
future-lab/branch-wizard/BranchWizard.tsx
future-lab/branch-wizard/ConfigureStep.tsx
future-lab/branch-wizard/ConfirmStep.tsx
future-lab/branch-wizard/FastForwardStep.tsx
future-lab/branch-wizard/marketComparison.test.ts
future-lab/branch-wizard/marketComparison.ts
future-lab/branch-wizard/outcomeSummary.test.ts
future-lab/branch-wizard/outcomeSummary.ts
future-lab/branch-wizard/PrimitiveStep.test.tsx
future-lab/branch-wizard/PrimitiveStep.tsx
future-lab/comparison/EnsembleFanChart.tsx
future-lab/comparison/OutcomeHistogram.tsx
future-lab/comparison/StructuralDiffTable.tsx
future-lab/comparison/TimelineComparisonView.tsx
```

- [ ] **Step 2: Update the one hardcoded route string that referenced `/simulation`**

In `apps/web/components/future-lab/comparison/TimelineComparisonView.tsx`, find the `router.replace` call (was line 119 pre-move) that builds a `/simulation?...` URL for the "Copy link" feature. Replace `/simulation` with `/future-lab` in that string, and update the comment above it (was lines 95-96) that references `?mode=future-lab&ticker=TST&timelines=1,2` to instead read `/future-lab?ticker=TST&timelines=1,2` (dropping `mode=future-lab`, since the mode param no longer exists after Task 3).

- [ ] **Step 3: Run the existing tests for the moved files to confirm nothing broke**

```bash
cd "stock-sim/apps/web"
npx vitest run components/future-lab/branch-wizard/marketComparison.test.ts components/future-lab/branch-wizard/outcomeSummary.test.ts components/future-lab/branch-wizard/PrimitiveStep.test.tsx
```

Expected: all tests PASS (same assertions as before the move — these tests only use relative imports within the moved directory, e.g. `./marketComparison`, `./BranchWizard`, `./PrimitiveStep`, which remain valid siblings after the move).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: relocate Future Lab components from simulation/ to future-lab/"
```

---

### Task 2: Create the standalone `/future-lab` route and update `FutureLabView`

**Files:**
- Create: `apps/web/app/future-lab/page.tsx`
- Modify: `apps/web/components/future-lab/FutureLabView.tsx` (drop the `onClose` prop, "Back to trading" becomes a link back to `/simulation`)

**Interfaces:**
- Consumes: `TerminalShell` from `@/components/layout/TerminalShell` (existing, used identically to `apps/web/app/simulation/page.tsx`); `TimelineBranch` from `@/components/simulation/TimelineBranch` (unmoved, existing); `TimelineComparisonView` from `@/components/future-lab/comparison/TimelineComparisonView` (Task 1 output).
- Produces: default export `FutureLabPage` at route `/future-lab`; `FutureLabView` now takes zero props.

- [ ] **Step 1: Rewrite `FutureLabView.tsx` to drop the `onClose` prop**

Replace the full file content:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineBranch } from "@/components/simulation/TimelineBranch";
import { TimelineComparisonView } from "@/components/future-lab/comparison/TimelineComparisonView";

/** Future Lab (Section 11): alternate-future simulation. Hosts the branch
 * list + creation wizard and the N-way timeline comparison UI in one place,
 * as its own top-level route (/future-lab) rather than a mode inside
 * /simulation. */
export function FutureLabView() {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-accent" />
          <h1 className="text-h2 font-medium text-text-primary">Future Lab</h1>
        </div>
        <Link href="/simulation">
          <Button variant="outline" size="sm">
            <ArrowLeft size={14} />
            Back to trading
          </Button>
        </Link>
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
```

- [ ] **Step 2: Create the route file**

```tsx
import { Suspense } from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { FutureLabView } from "@/components/future-lab/FutureLabView";

export default function FutureLabPage() {
  return (
    <TerminalShell>
      <Suspense fallback={null}>
        <FutureLabView />
      </Suspense>
    </TerminalShell>
  );
}
```

Save as `apps/web/app/future-lab/page.tsx`.

- [ ] **Step 3: Verify the route builds**

```bash
cd "stock-sim/apps/web"
npx tsc --noEmit
```

Expected: no new type errors referencing `future-lab`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/future-lab/page.tsx apps/web/components/future-lab/FutureLabView.tsx
git commit -m "feat: add standalone /future-lab route"
```

---

### Task 3: Strip the overlay mode out of `SimulationPageContent.tsx`

**Files:**
- Modify: `apps/web/components/simulation/SimulationPageContent.tsx` (full rewrite — file shrinks from 46 lines to a plain render of `SimulationTradingView`)

**Interfaces:**
- Consumes: `SimulationTradingView` from `@/components/simulation/SimulationTradingView` (existing, unchanged).
- Produces: `SimulationPageContent` with no props, no `?mode=` handling.

- [ ] **Step 1: Replace the file content**

```tsx
"use client";

import * as React from "react";
import { SimulationTradingView } from "@/components/simulation/SimulationTradingView";

export function SimulationPageContent() {
  return (
    <div className="relative h-full">
      <SimulationTradingView />
    </div>
  );
}
```

This removes: the `FutureLabView` import, the `useSearchParams`/`futureLabOpen` state, the `setFutureLabOpen` router-based toggle, and the "Future Lab" launcher button (replaced by the sidebar nav entry added in Task 4).

- [ ] **Step 2: Confirm no other file still imports `FutureLabView` from its old path**

```bash
cd "stock-sim/apps/web"
grep -rn "simulation/future-lab" --include="*.tsx" --include="*.ts" .
grep -rn "simulation/comparison" --include="*.tsx" --include="*.ts" .
grep -rn "simulation/branch-wizard" --include="*.tsx" --include="*.ts" .
```

Expected: no matches (Task 1 already moved the directories; this step confirms no stray import string was missed).

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/simulation/SimulationPageContent.tsx
git commit -m "refactor: remove Future Lab overlay mode from /simulation"
```

---

### Task 4: Add the "Future Lab" sidebar nav entry

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx:6-25` (add `FlaskConical` to the `lucide-react` import), `apps/web/components/layout/Sidebar.tsx:85-91` (add nav item), `apps/web/components/layout/Sidebar.tsx:94-99` (optional quick-jump entry)

**Interfaces:**
- Consumes: nothing new — reuses the existing `NavItem`/`NavGroup` shape already defined in this file.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add `FlaskConical` to the lucide-react import block**

Change:
```tsx
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
```
to:
```tsx
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  FlaskConical,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
```

- [ ] **Step 2: Add the nav item to the "Simulation" group**

Change:
```tsx
  {
    eyebrow: "Simulation",
    items: [
      { href: "/simulation", label: "Simulation", icon: LineChart },
      { href: "/admin", label: "Admin", icon: LayoutDashboard, adminOnly: true },
    ],
  },
```
to:
```tsx
  {
    eyebrow: "Simulation",
    items: [
      { href: "/simulation", label: "Simulation", icon: LineChart },
      { href: "/future-lab", label: "Future Lab", icon: FlaskConical },
      { href: "/admin", label: "Admin", icon: LayoutDashboard, adminOnly: true },
    ],
  },
```

- [ ] **Step 3: Add a quick-jump entry**

Change:
```tsx
const QUICK_JUMPS: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Go to Dashboard", icon: Home, href: "/dashboard" },
  { label: "Go to Market", icon: BarChart3, href: "/market" },
  { label: "Go to Portfolio", icon: Wallet, href: "/portfolio" },
  { label: "Go to Simulation", icon: LineChart, href: "/simulation" },
];
```
to:
```tsx
const QUICK_JUMPS: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Go to Dashboard", icon: Home, href: "/dashboard" },
  { label: "Go to Market", icon: BarChart3, href: "/market" },
  { label: "Go to Portfolio", icon: Wallet, href: "/portfolio" },
  { label: "Go to Simulation", icon: LineChart, href: "/simulation" },
  { label: "Go to Future Lab", icon: FlaskConical, href: "/future-lab" },
];
```

- [ ] **Step 4: Run typecheck and lint**

```bash
cd "stock-sim/apps/web"
npx tsc --noEmit
npx eslint components/layout/Sidebar.tsx
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat: add Future Lab entry to sidebar nav"
```

---

### Task 5: Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd "stock-sim/apps/web"
npm run dev
```

- [ ] **Step 2: Verify in browser**

Navigate to `/simulation` — confirm the "Future Lab" launcher button is gone and the trading view renders normally with no console errors. Click the new "Future Lab" sidebar entry — confirm it navigates to `/future-lab` and renders the branch list, wizard, and comparison view identically to how it looked as an overlay. Click "Back to trading" — confirm it navigates to `/simulation`. Create a branch via the wizard and confirm the comparison view's "Copy link" produces a `/future-lab?...` URL (not `/simulation?...`), and that pasting that URL back into the browser reopens `/future-lab` with the same timelines selected.

- [ ] **Step 3: Stop the dev server once verified**

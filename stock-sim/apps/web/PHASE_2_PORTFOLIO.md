# PHASE 2 — Portfolio — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one. (Recommended prerequisite: Phase 1's `middleware.ts` should exist
first, since every route below is an authenticated route — see Part E.)

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome (nav, panels, containers) recedes to near-invisibility; only
market/user data carries color, motion, and visual weight.

The Five Laws (apply to every screen you touch in this phase):
1. Data is the only decoration — no ornament that isn't derived from live information.
2. One accent color everywhere (`accent-500 #3E6FE0`) — green/red belong exclusively to market direction, never
   to generic success/error UI.
3. Ink on glass — every surface behaves like a physical material (matte graphite panel, frosted glass overlay,
   hairline metal border). Nothing floats without a shadow; nothing overlaps without blur.
4. Numbers are typography's first citizens — tabular figures, fixed decimal alignment, monospaced tickers,
   non-negotiable.
5. The interface never sleeps and never shouts — something is always subtly alive (breathing dot, ticking
   timestamp, shimmer) but nothing flashes, pulses aggressively, or glows neon.

**Ledger Line** — the signature 1px luminous accent hairline (`transparent → accent-500 → transparent`, centered,
60% of module width). It underlines the focused module, traces the live edge of a streaming chart, and draws
itself under section headers on load (400ms ease-in-out). It is the platform's heartbeat. In Phase 2 this is
used constantly: it is the active-tab marker for every sub-navigation tab row.

### A2. Color rules (non-negotiable)
- No pure `#000000` or `#FFFFFF` anywhere, ever.
- `market-up` (`#2E9E6B`, dark-theme bright `#3FBF85`) and `market-down` (`#D64550`, dark-theme bright `#E85D68`)
  are reserved **exclusively** for price/P&L direction. This phase is dense with financial deltas — every one
  of them uses these tokens and nothing else, but they must never bleed into generic UI success/error states.
- Generic success uses **accent** (cobalt), never green. Generic warning/validation-error uses **`warn` amber
  `#D9922E`**, never red.
- `ai` iris (`#8B7CF6`) is reserved exclusively for AI-generated content markers. Not used in this phase except
  where explicitly noted (AI Analytics commentary, if included, must follow the AI card rules verbatim).
- Categorical data ramp (max 6 series, used for Allocation): Cobalt `#3E6FE0` → Slate `#4E8FB8` → Iris
  `#8B7CF6` → Warm Gray `#9A8F80` → Amber `#D9922E` → Teal `#3D9E96`. Never arbitrary hues.
- Diverging ramp (heatmaps/correlation, if used): `market-down-deep` → neutral graphite `#2A2F38` →
  `market-up-deep`, magnitude mapped to **opacity** (30–100%), never to a brighter hue.
- Full token tables are in DESIGN_SPEC.md §Color System — use the existing `mer-*` Tailwind tokens. Never
  hand-write hex values in components.

### A3. Typography rules (non-negotiable)
Three typefaces, three jobs, no exceptions:
- **Interface (Söhne / Inter fallback)** — UI chrome, labels, navigation, buttons, tab labels, filter labels.
- **Data (Söhne Mono / IBM Plex Mono fallback)** — every price, ticker, percentage, timestamp, and table
  numeric cell in this entire phase. This is the single most numerically dense phase in the app — treat mono
  tabular alignment as load-bearing, not decorative.
- **Editorial (Tiempos Text / Georgia fallback)** — not used in this phase except inside AI-generated
  narrative text if an AI Analytics card is included (per the AI card rules).

Numeric rules: tabular lining figures always; right-align on decimal point; currency symbols/percent signs
render at 85% size, slightly desaturated, so the numeral dominates; signed deltas always show explicit `+`/`−`,
same weight as the numeral, never parentheses for negatives; tickers are always mono, uppercase, tracked
+0.02em; timestamps mono `caption` size, `ink-tertiary`.

Type scale tokens relevant here: `display-xl` (40/44, 600, hero net-worth figure — used for the Portfolio
total/net-value figure if a hero module exists), `display` (32/36, 600, page titles/primary KPI), `heading-1`
(24/28, module titles), `heading-2` (18/24, card/modal titles), `body`/`body-strong` (default text/emphasis),
`caption` (secondary metadata), `micro` (eyebrows, column headers, badges), `data-lg` (28/32, 500 mono,
featured prices), `data` (13/18, 450 mono, table cells/tickers — the workhorse size for this phase), `data-sm`
(11/14, 450 mono, dense grids — used in Compact density mode).

### A4. Layout & elevation rules
Five-layer elevation model — every pixel belongs to exactly one layer via three simultaneous cues (background
step + shadow + hairline), each individually subtle:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | Cards, tables, chart panels |
| 3 | Raised | `bg-surface-3/4` | Dropdowns, popovers, tooltips, column manager |
| 4 | Overlay | `bg-glass` | Modals, drawers |

- A module never sits directly on canvas without a hairline edge.
- Nesting caps at two visible background steps.
- Selected/active state raises the **border** (Ledger Line, 2px accent left edge for row selection), never
  the surface.
- Base unit 4px; component spacing 4/8/12/16; layout spacing 16/20/24/32.
- Radius scale: `radius-xs` 4px (badges/chips), `radius-sm` 6px (buttons/inputs/row selection), `radius-md`
  10px (cards), `radius-lg` 14px (modals). **Nothing above 14px, ever.**
- Row height by density: Comfortable 40px, Compact 28px — this phase's tables must support both.
- Shadows: use existing `shadow-rest` / `shadow-raised` / `shadow-overlay` / `shadow-inset-well` /
  `glow-accent` tokens; always layered pairs, cool-toned, never pure black.

### A5. Glass — strict allowlist
Frosted glass permitted in **exactly five places app-wide**: command palette/global search, modals/drawers,
sticky header on scroll, chart tooltips, AI card header strip. In Phase 2: chart tooltips (Performance chart
crosshair tooltip) and the comparison-mode floating legend (a glass panel per the Charts spec) are the two
glass surfaces you'll build. Resting cards, the tab row, and table surfaces are never glass.

### A6. Component library — reuse, don't reinvent
- **Tables** (the dominant component of this phase): header row `bg-surface-3`, sticky, `micro` uppercase
  labels in `ink-secondary`, sortable columns reveal a chevron on hover (sorted column keeps it visible). Rows
  40px/28px by density, half-strength hairline separators, **no zebra striping**. Hover fills the full row
  width. Cells: text left-aligned, all numerics right-aligned mono with decimal alignment. Delta cells show
  signed value + direction glyph, optional magnitude bar. First column (ticker+name) pins on horizontal scroll
  with a gradient scrim. Row selection: 2px accent left edge + filled background, checkbox in a dedicated
  gutter on hover only. Inline sparkline column: 96×24px, 1.5px stroke in market color, fading fill. A column
  manager (density/visibility/reorder) sits behind a ghost icon top-right of every table.
- **Card grammar** — compose everything from these three patterns: **Metric card** (eyebrow → `data-lg` value
  → delta line → sparkline footer bleeding to edges), **List card** (module header → dense rows → "View all →"
  ghost footer), **Chart card** (module header → toolbar strip → canvas bleeding to edges, no inner padding
  around the plot).
- **Tabs**: ghost tab row, no filled background for inactive tabs, active tab marked by the Ledger Line (1px
  accent underline), not a filled pill or bold-only change. Tab rows stick below the page's identity/header
  bar on scroll — this is the exact pattern this phase's 8-section sub-navigation uses.
- **Dropdowns**: Level-3 raised surfaces, `shadow-raised`, `stroke-emphasis` border, `radius-sm`.
- **Empty states**: centered, max 320px, line-drawn illustration with one accent element, heading stating the
  opportunity, one sentence of direction, secondary-style primary button + ghost alternative, faint radial
  accent wash behind the illustration.
- **P&L card** (named pattern, used for Analytics/Performance): realized/unrealized split, mono figures, a
  thin diverging bar centered on zero.
- **Dividend tracker** (named pattern, used verbatim for Dividend History): ex-date timeline on a hairline
  with amount chips.
- Reuse Radix UI + shadcn/ui primitives, `react-hook-form`+`zod` for any forms (Goals target-setting), TanStack
  Query for all server state.

### A7. Motion — GSAP only, per this exact table

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Delta numeral crossfades; cell flash to 8% market-color tint, 800ms decay |
| Micro-interactions | 120–160ms, ease-out | Hover, press, toggle, tab switch |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | Dropdown fade+4px rise, drawer slide |
| Ledger Line draw-in | 400ms, ease-in-out | Section header underline on load, active tab underline |
| Ambient | 2–4s loops | Skeleton shimmer, live-dot breathing |

Rules: nothing bounces, overshoots, or rotates. `prefers-reduced-motion` collapses everything to opacity fades,
disables ambient loops. Price-flash is the only motion allowed to recur >1/sec without user input.

### A8. States every feature must define
Every screen/section in this phase needs: default, loading (shape-accurate skeleton if >300ms, skipped
otherwise — table skeletons show true column widths, chart skeletons show a static ghost price line, number
skeletons show right-aligned bars of realistic varied widths), empty (this phase has real empty states — a
new user with no holdings, no transactions, no goals, no dividends), error (module-level, contained), and
disabled where relevant.

### A9. Accessibility (mandatory, not follow-up)
≥4.5:1 contrast; direction never color-only (always paired with a ▲/▼ glyph); full keyboard model including
table row navigation and a chart-focus shortcut; visible `glow-accent` focus ring; `prefers-reduced-motion`
honored; live regions throttled to 1 announcement per 3s per module.

### A10. General engineering rules
Backend: FastAPI + SQLAlchemy + Alembic. New tables get real migrations. New/extended routers follow
`routers/<domain>.py` + `services/<domain>_service.py`. Frontend: Next.js 15 App Router, React 19, TypeScript,
JS/TS only, desktop-first with 64px icon-rail collapse at minimum. Every module fault-isolated. Don't touch
code outside this phase's file boundary without flagging it. Verify by running the dev server and clicking
through the feature, not just type-checking. Never hardcode secrets.

---

## PART B — Phase 2 Context: What Already Exists (read before writing anything)

- `stock-sim/apps/web/app/portfolio/` was already revamped into "an institutional management workspace"
  (commit `279d594`) — **read this implementation fully first.** It is currently a single workspace view, not
  the 8-section structure this phase builds. Reuse its data-fetching hooks, layout shell, header/identity bar,
  and any card/table components it already built — do not rebuild what's already there.
- Dashboard (commit `2373270`) already has a compact "Watchlist Dock" widget and sparkline/card primitives in
  `components/dashboard/primitives/` (e.g. `LiveDot.tsx`) — reuse these rather than duplicating.
- Backend `apps/api/routers/trading.py` already exposes: `GET /portfolio`, `GET /portfolio/analytics`,
  `POST /orders`, `GET /transactions`, `GET/POST/DELETE /watchlist`. Models in `db/models/trading.py`:
  `Portfolio`, `Holding`, `Transaction`, `Watchlist`, `Notification`, `User`. **Read the actual current shape
  of these endpoints and models before assuming what fields they return** — the spec below states what's
  needed; verify gaps against reality rather than guessing.
- No chart library is installed anywhere in the repo (no recharts/visx/lightweight-charts/d3) — existing
  charts (Dashboard, Company Details) are apparently hand-rolled SVG/Canvas. **This phase cannot defer the
  charting decision** (see Part C3 and C4) — resolve it explicitly with the user before building Performance
  or Allocation.
- No Dividend or Goal models exist in the backend today — both are net-new (see C6, C8).

---

## PART C — Feature Specifications (extreme detail)

### C0. Page shell and sub-navigation (applies to all 8 sections)

- **Route structure**: `/portfolio` redirects to `/portfolio/holdings` (the default/landing tab). Each section
  is its own route: `/portfolio/holdings`, `/portfolio/transactions`, `/portfolio/performance`,
  `/portfolio/allocation`, `/portfolio/analytics`, `/portfolio/dividends`, `/portfolio/watchlists`,
  `/portfolio/goals`. Use a shared Next.js layout (`app/portfolio/layout.tsx`) so the identity bar and tab row
  persist across tab switches without remounting — this is what makes tab switches feel instant rather than a
  full page reload. Prefetch adjacent tab routes on hover/focus of their tab trigger (Next.js `<Link>`
  prefetching, already automatic for viewport-visible links — ensure the tab row uses real `<Link>` components,
  not `onClick` + `router.push`, so this works for free).
- **Identity bar** (top of the shared layout, above the tab row): eyebrow `micro` "PORTFOLIO", then a
  `display-xl` mono net portfolio value, a delta line beneath it (signed $ and % change, direction glyph,
  since-when label e.g. "vs. yesterday's close" in `caption` `ink-tertiary`), and range-aware — this figure
  should reflect the currently selected performance range if the user is on the Performance tab, otherwise
  defaults to "today". Session/market status badge (`OPEN`/`PRE`/`CLOSED`) to the right, matching the header's
  existing badge component if one exists app-wide (check the global header first — do not build a second
  session-badge component).
- **Tab row**: ghost tabs, 8 entries in the order given (Holdings, Transactions, Performance, Allocation,
  Analytics, Dividends, Watchlists, Goals), Ledger Line under the active tab, sticky below the identity bar on
  scroll (`position: sticky`, verify it clears the app's global sticky header height so nothing overlaps).
  Each tab label is `body` weight, `ink-secondary` at rest, `ink-primary` when active, no icon needed (icons
  would compete with the numbers for visual weight — per Law 1, resist adding them).
- **Empty-portfolio state**: if the user has zero holdings and zero transactions (a brand-new account), the
  identity bar's net value shows `$0.00` with no delta line (nothing to compare against yet — do not show
  "+0.00%", omit the delta line entirely rather than showing a meaningless zero), and Holdings/Performance/
  Allocation/Analytics/Dividends all render their empty state (see per-section detail below) rather than an
  empty table with just headers.

### C1. HOLDINGS

- **Data source**: `GET /portfolio` (verify current response shape; extend if it doesn't already include
  per-holding cost basis, unrealized P&L $ and %, and portfolio-weight % — these four are non-negotiable for
  this table and are likely missing from a first-pass endpoint).
- **Columns** (in order): checkbox gutter (hover-only) → Ticker+Name (pinned) → Sparkline (30-day, 96×24px) →
  Quantity (mono, right-aligned) → Avg Cost (mono, currency) → Last Price (mono, currency, flashes on tick per
  the data-tick motion class if live pricing is wired) → Market Value (mono, currency) → Day Change (signed $
  + % + glyph, market color) → Total Return (signed $ + % + glyph, market color, since cost basis) → Weight %
  (mono, right-aligned, optionally with a thin horizontal magnitude bar per the Tables spec's "optional
  magnitude bar for scanability").
- **Sorting**: every column sortable, default sort Market Value descending. Sort chevron appears on hover,
  stays visible on the active sort column.
- **Row click**: navigates to the relevant Company Details page (`/companies/{ticker}`) — this table is a
  gateway into the existing research terminal, not a dead end.
- **Row selection**: checkbox-driven multi-select (gutter appears on hover) enables a contextual action bar
  above the table (e.g. "Add to watchlist", "Export") — build the action bar only if at least one concrete
  action is confirmed useful; do not ship an empty action bar as a placeholder.
- **Column manager**: ghost icon top-right opens a Level-3 dropdown listing all columns with visibility
  toggles and a density toggle mirror (Comfortable/Compact) — reuse the app's global density toggle state, do
  not create a second independent density setting scoped only to this table.
- **Empty state**: "Build your first position" heading, body copy "Your holdings will appear here once you
  place a trade.", secondary button "Go to Trading Desk" → `/trading` (Phase 3), ghost alternative "Explore
  the market" → `/market`.
- **Loading skeleton**: table skeleton with the exact column widths above, 6 placeholder rows, shimmer sweep
  1.8s loop.

### C2. TRANSACTIONS

- **Data source**: `GET /transactions` (verify it supports filtering by date range, ticker, side (buy/sell),
  and type — extend with query params if it doesn't; don't build client-side-only filtering of a full dataset
  if the backend can filter server-side, which matters once transaction history grows).
- **Columns**: Date/Time (mono, `caption` size, `ink-tertiary`, format `MMM D, YYYY · HH:MM:SS`) → Ticker
  (mono, uppercase, clickable to Company Details) → Side (badge: "BUY" or "SELL", `radius-xs`, `micro` type —
  do not tint these badges market green/red, since side is not itself a price direction; use neutral
  `ink-secondary`/`bg-surface-3` badges, reserving market color strictly for price deltas elsewhere in the
  row) → Quantity (mono) → Price (mono, currency) → Total (mono, currency) → Fees (mono, currency, if the
  trading model tracks fees — check before assuming) → Status (badge: filled/partial/cancelled, reused from
  the Trading Desk's status badge component once Phase 3 exists — for now, if Phase 3 hasn't been built yet,
  render a simple "Filled" badge since historical transactions are by definition completed).
- **Filters**: a filter row above the table — date-range picker (dual-calendar popover per the spec's Dropdown
  component), ticker search (typeahead), side pill filter (All/Buy/Sell), all using the pill multi-select
  pattern from Market Explorer's filter rail if one already exists there (reuse, don't reinvent).
- **Export**: a ghost button "Export CSV" in the table's toolbar strip — straightforward client-side CSV
  generation from the currently filtered/visible rows is sufficient; no backend export endpoint needed unless
  the dataset is large enough to require server-side generation (unlikely for a per-user transaction history
  in v1).
- **Empty state**: "No transactions yet" heading, "Your trade history will show up here." body, same CTA
  pattern as Holdings' empty state.

### C3. PERFORMANCE

**Charting library decision — resolve before building this section.** No chart library is installed anywhere
in the repo; existing charts elsewhere are apparently hand-rolled. This section needs **comparison-mode overlay
charting** (portfolio value vs. a benchmark, normalized to % change, multiple series) which is meaningfully
more complex than a single price line. **Ask the user explicitly**: continue hand-rolling SVG/Canvas to match
existing precedent (more control, more code, consistent with the rest of the app so far), or adopt a lightweight
library now (e.g. a minimal, tree-shakeable option) since Performance is the first place multi-series
comparison is actually required. Do not silently pick one — this is a real architectural fork with cost either
way.

- **Hero chart**: full-bleed area chart (no inner padding, plot bleeds to card edges per the Charts spec),
  1.5px accent-color price line, vertical gradient fill from 14% series color to 0% at baseline (the only
  chart-fill gradient permitted). Live edge (if today's data is live): breathing dot + price-tag chip on the
  axis, Ledger Line running as a horizontal hairline at the last value across the plot.
- **Range selector**: ghost pill group exactly as specced — `1D · 5D · 1M · 6M · YTD · 1Y · 5Y · MAX`, active
  pill fills with the raised-surface color, custom range opens a dual-calendar popover. Changing range updates
  both the chart and the identity bar's delta line (per C0).
- **Gridlines**: dotted hairlines at 40% of the standard hairline token. **Axis labels are never rotated** —
  they thin responsively instead (spec explicitly bans rotated axis labels).
- **Crosshair/tooltip**: 1px dashed crosshair on both axes, snaps to nearest data point, tagged mono chips; the
  tooltip itself is a glass panel (one of the five allowlisted glass surfaces) with a mono data grid: date
  header, aligned label/value pairs, series-color chips.
- **Comparison mode**: a toggle or a "+ Compare" control lets the user add a benchmark series (e.g. S&P 500
  equivalent, or another watchlist/index if the market data model supports one — check what benchmark data
  actually exists before promising a specific index). Comparison series draw from the categorical ramp,
  normalized to % change from the start of the selected range (not absolute value, since the portfolio and a
  benchmark index are on different scales), with a floating draggable glass legend (per spec) letting the user
  toggle series visibility.
- **Volume/secondary pane**: not applicable to a portfolio-value chart (no "volume" concept for a portfolio) —
  skip this element of the Charts spec here, it's specific to instrument price charts elsewhere in the app.
- **Backend**: `GET /portfolio/analytics` likely needs a time-series endpoint or parameter (e.g.
  `GET /portfolio/history?range=1M`) returning portfolio value at each point in the selected range — check if
  this exists; if not, it's new backend work (deriving historical portfolio value requires either storing daily
  snapshots or reconstructing from the Transaction history + historical prices — confirm which approach the
  existing data model supports before building either).
- **Empty state**: if there's insufficient history for the selected range (e.g. account is 2 days old and user
  selects 1Y), show a contained in-chart message rather than an empty plot: "Not enough history yet — check
  back after your first few days of trading." with the range selector still visible so the user can pick a
  shorter range.

### C4. ALLOCATION

- **Visualization**: sector and/or asset-class breakdown using the **categorical ramp** (max 6 series: cobalt,
  slate, iris, warm gray, amber, teal) — never arbitrary hues, per A2. A treemap (proportional-area) is the
  better fit for a variable number of holdings/sectors than a donut (which degrades past ~6 slices); if more
  than 6 categories exist, group the smallest into an "Other" bucket rather than assigning a 7th arbitrary hue.
  If the charting-library decision from C3 lands on adopting a library, this is the second consumer of that
  decision — use the same library rather than a third one-off approach.
  - **Reference the `dataviz` skill's palette/heatmap guidance when building this component** — it exists
    specifically for chart color and layout consistency; don't improvise a treemap layout algorithm from
    scratch if that skill has established patterns for it.
- **Two allocation views** as ghost sub-tabs within this section (not full route tabs, just an in-page toggle):
  **By Sector** and **By Asset Class** (equities/cash/other, depending on what the portfolio model actually
  tracks — verify cash balance is even represented in the Portfolio model before promising an asset-class
  view; if it's equities-only today, ship Sector view only and flag Asset Class as blocked on backend data).
- **Detail on hover/click**: hovering a treemap tile shows a glass tooltip (allowlisted) with sector name,
  $ value, % of portfolio, and day change (signed, market color). Clicking a tile could filter the Holdings
  tab to that sector — a reasonable cross-tab interaction, implement via a query param
  (`/portfolio/holdings?sector=Technology`) that Holdings reads to pre-filter, rather than complex shared
  client state.
- **Tile labels**: `micro` auto-contrast (light text on dark tiles, dark text on light tiles — compute
  contrast from the tile's fill color, don't hardcode one text color for all tiles), hairline gaps between
  tiles per the spec's heatmap convention.
- **Empty state**: same pattern as Holdings — no holdings means no allocation to show.

### C5. ANALYTICS

- **Layout**: a metric-card grid (the spec's Metric card grammar: eyebrow → `data-lg` value → delta line →
  sparkline footer). Cards for: **Beta** (vs. a benchmark — same benchmark-availability caveat as C3), **Sharpe
  Ratio**, **Volatility** (annualized standard deviation, %), **Max Drawdown** (%, since account inception or
  selected range), **Realized P&L** and **Unrealized P&L** (as one combined **P&L card** per the spec's named
  pattern: realized/unrealized split, mono figures, thin diverging bar centered on zero).
- **Backend**: `GET /portfolio/analytics` exists — read its current response shape first. Likely needs
  extending to include beta/Sharpe/volatility/drawdown if not already computed. These are genuine calculations
  requiring historical return series (ties back to C3's history endpoint — build the underlying historical
  portfolio-value series once and have both Performance and Analytics consume it, rather than two separate
  historical-data code paths).
- **Definition tooltips**: every metric card's eyebrow label (e.g. "SHARPE RATIO") uses the spec's
  dotted-underline Definition tooltip pattern — a small explainer card with a one-line formula in mono, e.g.
  "Sharpe Ratio: (Return − Risk-Free Rate) / Std. Deviation". Do not ship jargon-labeled cards with no
  explanation — this is a spec-level requirement for financial terminology, not optional polish.
- **Empty/insufficient-data state**: if there isn't enough transaction/price history to compute a given metric
  meaningfully (e.g. Sharpe Ratio needs a return series of reasonable length), that specific card shows a
  contained placeholder: `ink-tertiary` "—" in place of the value, and a `caption` line "Needs more trading
  history" instead of the delta line — do not show a fabricated or zero-by-default value that looks like a
  real calculation.

### C6. DIVIDEND HISTORY

**Data availability must be confirmed before building UI.** No dividend/corporate-actions model was found in
the backend audit. Before writing any frontend code for this section, check `db/models/` for anything
dividend-related (a company-level dividend schedule, or per-holding dividend records) — **if nothing exists,
this needs new backend work, and the scope should be confirmed with the user rather than assumed**, since
dividend data ties to the market/company data model (Phase 4/Company Details territory), not just Portfolio.

**If backend data exists or is added:**
- **New table** (if needed): `dividends` — `id`, `company_id` FK (or ticker), `ex_date`, `payment_date`,
  `amount_per_share`, `declared_date`. This is company-level reference data, not user-specific.
- **Derivation**: a user's dividend history/upcoming dividends = holdings at `ex_date` × `amount_per_share`,
  computed at read time or materialized into a per-user `dividend_receipts` table if computing on the fly
  becomes expensive — start with computed-at-read-time (simpler, YAGNI) unless there's a clear performance
  reason not to.
- **Backend endpoint**: `GET /portfolio/dividends` returning past receipts and upcoming (declared but not yet
  paid) dividends for the user's current/historical holdings.
- **UI — use the spec's named "Dividend tracker" card pattern verbatim**: an ex-date timeline rendered on a
  hairline, with amount chips positioned along it at each dividend event. Two sections: **Upcoming** (future
  ex-dates, chips in a slightly muted treatment since not yet realized) and **Received** (past, in a list-card
  format below the timeline: ticker, ex-date, payment-date, amount-per-share, shares held at ex-date, total
  received — all mono, right-aligned numerics).
- **Summary metric card** above the timeline: total dividends received (this range/all-time toggle), and a
  trailing-twelve-month yield-on-cost figure if computable.
- **Empty state**: "No dividend activity yet" heading, "Dividends from your holdings will appear here as
  they're paid." body — this is a legitimately common empty state (many holdings pay no dividends, or the
  account is new), design it as calmly as the others, not as an error.

### C7. WATCHLISTS

- **Backend already has full CRUD**: `GET/POST/DELETE /watchlist` — read the current `Watchlist` model shape
  first to confirm whether it already supports **multiple named watchlists per user** or is currently a single
  flat list. If it's a single list today, extending to named/multiple lists is a reasonable, well-scoped
  addition (add a `name` field and allow multiple `Watchlist` rows per user rather than one) — confirm this
  extension with the user before assuming it's wanted, but recommend it since "Watchlists" (plural) is the
  explicit ask.
- **This is the full-page expansion of the Dashboard's existing compact "Watchlist Dock" widget** — reuse its
  row component (ticker, name, price, day change with glyph, sparkline) rather than rebuilding ticker rows
  from scratch; this page just gives that same row more room and adds management affordances the compact dock
  doesn't need.
- **Layout**: a left rail listing the user's named watchlists (if multiple are supported) — each entry shows
  name + count, `+ New watchlist` action at the bottom of the rail. Selecting a watchlist shows its full table
  in the main content area, same column set as the Dashboard dock but expanded: Ticker+Name (pinned) →
  Sparkline → Last Price → Day Change ($ + % + glyph) → Add to Portfolio quick-action (routes into Phase 3's
  Buy ticket pre-filled with the ticker, once that exists — until then, routes to the company page) → Remove
  (ghost icon, row-hover-only, per the Interaction Rules' hover-reveal pattern).
- **Drag-and-drop reordering**: per the spec's Interaction Rules, "watchlist rows reorder via a row-level
  grip" — implement this (grip icon appears on row hover, drag reorders within the list, persists the new
  order to the backend).
- **Add-ticker flow**: a search input at the top of the table (ticker typeahead with live match dropdown per
  the Inputs spec) — selecting a result calls the existing `POST /watchlist`.
- **Empty state** (no watchlists yet, or a watchlist with zero tickers): "Start tracking companies you care
  about" heading, body "Add tickers to your watchlist to keep an eye on them.", the ticker search input itself
  can double as the primary CTA here (autofocus it) rather than a separate button.

### C8. GOALS

**Fully greenfield — no backend model exists.** This is a real feature requiring new schema, not just a UI
layer over existing data. **Keep v1 narrow per YAGNI — one goal type, not a generalized goals engine** —
confirm this scope explicitly with the user before over-building (e.g. don't build support for
recurring/compound/multi-metric goals in v1).

- **v1 goal type**: "Reach a target portfolio value by a target date." (Net worth by date — the simplest,
  most broadly useful goal shape, and directly measurable from data this phase already computes.)
- **New table `goals`**: `id`, `user_id` FK, `target_value` (numeric), `target_date`, `label` (user-provided
  short name, e.g. "Down payment fund"), `created_at`, `achieved_at` nullable (set when the target is first
  reached, so achievement is a permanent record even if the portfolio later dips back below target).
- **Backend endpoints**: `POST /goals` (create), `GET /goals` (list, with computed progress), `PATCH
  /goals/{id}` (edit target/date/label), `DELETE /goals/{id}`. Progress computation happens server-side at
  read time (current portfolio value ÷ target value), not stored, so it's always current.
- **UI — creation flow**: a modal (form width 560, per the Modals spec), react-hook-form + zod:
  - **Label** field: text input, `micro` label "GOAL NAME", placeholder "e.g. Emergency fund", max 60 chars,
    required.
  - **Target value** field: numeric input, mono, right-aligned, `micro` label "TARGET VALUE", currency prefix
    styled per the Inputs spec (85% size, desaturated), required, must be > current portfolio value (client
    validation: if the user enters a target below their current value, show an inline amber caption "This
    goal is already achieved — try a higher target" rather than a hard block, since it's not truly invalid,
    just probably not what they meant).
  - **Target date** field: date picker (reuse the same dual-calendar popover component as C3's custom range
    selector — do not build a second date-picker), `micro` label "TARGET DATE", must be a future date
    (validation: amber caption "Target date must be in the future" if not).
  - Submit: Primary button, "Create goal".
- **UI — goals list/grid**: each goal renders as a card using a **progress-ring or progress-bar** treatment
  (per the original scope note) — recommend a horizontal progress bar (simpler, reads faster at a glance in a
  list of several goals than a ring would) filled with `accent-500` (this is a generic progress signal, not
  market data, so accent is correct per A2 — not market green even though "progress" might tempt a green
  fill). Card contents: label (`heading-2`), current value vs. target value (mono, e.g. "$42,180 / $60,000"),
  the progress bar, percent complete (`data` mono), target date with a `caption` "X days remaining" or, if
  overdue and not yet achieved, an amber "Past target date" indicator (not a hard error — the goal is still
  valid, just behind schedule).
- **Achieved state**: once `achieved_at` is set, the card gets a small accent-tinted badge "Achieved
  {date}" (accent, not market green, per A2) and moves to a separate "Achieved" section below active goals
  rather than disappearing — users generally want to see past wins, not lose them.
- **Edit/delete**: ghost icon actions on hover (per the Interaction Rules' hover-reveal pattern), edit reopens
  the same modal pre-filled, delete uses the Destructive-confirm button pattern inside a confirmation modal
  (ghost at rest, fills `warn` amber only inside the modal — never market red, per A6/Buttons spec, since this
  isn't a market action).
- **Empty state**: "Set your first goal" heading, "Track progress toward a target portfolio value." body,
  Primary button "Create a goal" opening the creation modal directly (no ghost alternative needed here — a
  single clear CTA is correct when there's only one action possible).

---

## PART D — Strict Do-Not List (Phase 2)

- **Do NOT** rebuild the existing `/portfolio` workspace view from scratch — read it fully first and reuse its
  data hooks, layout shell, and any existing card/table components before writing new ones.
- **Do NOT** silently pick a charting approach (hand-rolled vs. library) — this is a real architectural fork
  (Performance's comparison mode and Allocation's treemap both need it) and must be confirmed with the user
  before building either section.
- **Do NOT** build Dividend History against fabricated or assumed data — confirm the underlying dividend data
  source exists (or gets built) before writing frontend code that implies data that isn't there.
- **Do NOT** invent a generalized, multi-type "goals engine" — ship exactly one goal type (target value by
  date) in v1, confirmed with the user, per YAGNI.
- **Do NOT** use market green/red for the Goals progress bar, the "Achieved" badge, or any generic UI
  success/progress signal in this phase — those are accent-colored, full stop. Market colors are reserved for
  actual price/P&L direction only.
- **Do NOT** assign arbitrary hues to Allocation's categories — use only the six-color categorical ramp, and
  group overflow categories into "Other" rather than inventing a seventh color.
- **Do NOT** rotate axis labels on any chart in this phase — thin them responsively instead.
- **Do NOT** zebra-stripe any table.
- **Do NOT** show a fabricated or zero-default value for an Analytics metric that can't actually be computed
  yet due to insufficient history — show the "—" / "needs more history" contained state instead.
- **Do NOT** build a second date-picker, a second density toggle, or a second session-status-badge component
  if equivalents already exist elsewhere in the app (Dashboard, Market Explorer, or the global header) — reuse
  them.
- **Do NOT** ship financial-terminology labels (Sharpe Ratio, Beta, Volatility, etc.) without the spec-mandated
  Definition tooltip explaining them.
- **Do NOT** let tab switches within `/portfolio/*` trigger a full-page reload feel — use a shared layout and
  real `<Link>` prefetching so switching tabs is instant.
- **Do NOT** exceed 14px border radius, use pure black/white, or introduce any glass surface outside the two
  allowlisted uses in this phase (chart tooltip, comparison-mode floating legend).
- **Do NOT** touch Dashboard, Market Explorer, Company Details, or auth code — this phase's file boundary is
  `app/portfolio/**`, any new shared components genuinely reused from Dashboard (imported, not copy-pasted),
  the relevant `apps/api` trading/dividend/goals routers and services, and their Alembic migrations.
- **Do NOT** skip the Alembic migration for any new table (`dividends` and/or `dividend_receipts` if needed,
  `goals`) — no manual schema edits.
- **Do NOT** ship this phase without manually exercising every one of the 8 tabs in a running browser,
  including their empty states (test against a fresh/low-activity account, not just a seeded one with lots of
  data) and at least one populated state per tab.

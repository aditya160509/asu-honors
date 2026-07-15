# PHASE 4 — Simulation — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one.

**Before starting this phase, two feature names in the original scope need clarification with the user —
"Ripple Effects" and "Future Lab" have no existing backend counterpart and could mean multiple things. See
Parts C6 and C7 for the specific questions to resolve before building either.**

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome recedes to near-invisibility; only market/simulation data
carries color, motion, and visual weight.

The Five Laws:
1. Data is the only decoration.
2. One accent color everywhere — green/red belong exclusively to market direction.
3. Ink on glass — every surface behaves like a physical material.
4. Numbers are typography's first citizens.
5. The interface never sleeps and never shouts — this phase's central tension is that the simulation is
   fundamentally **not** continuously live (it advances in discrete steps the user triggers) — see A7 and C1
   for how to handle this without creating false liveness.

**Ledger Line** — 1px luminous accent hairline, used here as the active-tab marker (if this page uses tabs)
and the focused-module edge, e.g. around the Simulation Controls module when it has focus.

### A2. Color rules (non-negotiable)
- No pure `#000000`/`#FFFFFF` anywhere.
- `market-up`/`market-down` reserved exclusively for price/valuation direction (e.g. a company's price
  reaction to an event). Never repurposed for generic UI states.
- **Amber (`warn`) is the dominant secondary color in this phase** — the spec's Economic calendar pattern uses
  amber impact dots (1–3) for event significance, and this phase is built substantially around event/macro
  data. Amber here means "notable/impactful," not literally "warning" — this is a legitimate, spec-sanctioned
  use, not a misuse of the warn token.
- Generic UI success uses accent, never green.
- Categorical ramp (max 6 series) for any multi-series scenario/comparison charts (C8): Cobalt → Slate → Iris
  → Warm Gray → Amber → Teal.
- Diverging ramp for the Correlation matrix (C6, if that's the confirmed interpretation of Ripple Effects):
  `market-down-deep` → neutral graphite `#2A2F38` → `market-up-deep`, magnitude via opacity only.

### A3. Typography rules (non-negotiable)
- **Editorial (Tiempos Text / Georgia fallback)** has a real, spec-named home in this phase: **News headlines
  and long-form article bodies use Tiempos** — this is one of only two places in the entire app (alongside
  Company Details' About section and AI cards) where the editorial serif is correct at body size. Do not use
  Interface type for news headlines in this phase.
- **Data (Söhne Mono)** — every date, price delta, macro variable value, and countdown/timestamp.
- **Interface (Söhne / Inter)** — controls, labels, event titles (event *titles* are UI/data-adjacent labels,
  not long-form editorial content — only full news article bodies get the editorial treatment, not event
  calendar row labels).
- Numeric rules apply throughout: tabular figures, decimal alignment, signed deltas with explicit sign, mono
  tickers, mono timestamps at `caption` `ink-tertiary`.
- Section header pattern: `micro` eyebrow above a `heading-1` title, with the Ledger Line drawing in under it
  on load (400ms) — use this for every module header in this phase (Timeline, Macro Variables, Events, News,
  etc.).

### A4. Layout & elevation rules
Five-layer elevation model:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | Timeline card, Events card, News card, Controls card |
| 3 | Raised | `bg-surface-3/4` | Macro variable dropdowns, scenario picker |
| 4 | Overlay | `bg-glass` | Event detail drawer, article reading drawer, scenario comparison modal |

- Nesting caps at two visible background steps.
- Radius scale: `radius-xs` 4px, `radius-sm` 6px, `radius-md` 10px (cards), `radius-lg` 14px (modals/drawers).
  **Nothing above 14px.**

### A5. Glass — strict allowlist
Permitted in exactly five places: command palette, modals/drawers, sticky header on scroll, chart tooltips, AI
card header strip. In this phase: the **article reading drawer** (opens from News, right-edge, 400–480px per
the Modals spec's drawer sizing) and **event detail drawer** are glass. Chart tooltips (Timeline crosshair,
Scenario Comparison crosshair) are glass. Resting cards (Timeline, Events list, News feed, Controls) are not.

### A6. Component library — reuse, don't reinvent
- **Economic calendar** (named pattern, used for Events, C4): day-grouped rows, 1–3 amber impact dots,
  actuals flash on release.
- **Correlation matrix** (named pattern, potentially used for Ripple Effects, C6): diverging-ramp opacity grid
  with row/column crosshair highlight on hover.
- **Range selector / comparison mode**: ghost pill group, floating draggable glass legend, normalized %-change
  series from the categorical ramp — reused for Scenario Comparison (C8).
- **Session badge** (`OPEN`/`PRE`/`CLOSED`): reuse the existing global header component, do not rebuild.
- **Drawers**: right-edge slide-in, glass, 400–480px, same treatment as modals per the Modals spec.
- **Cards**: composed from the three grammars (Metric / List / Chart) — Simulation Controls is a Metric-card-
  adjacent module (current date, session state, primary action), Events/News are List cards, Timeline/Scenario
  Comparison are Chart cards.
- Reuse Radix + shadcn/ui, TanStack Query for all server state, react-hook-form+zod for Future Lab's scenario-
  parameter forms (C7) if built as a form.

### A7. Motion — GSAP only, per this exact table, with a phase-specific caveat

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Event "actuals" flashing on release; price-delta crossfades after Advance Day |
| Micro-interactions | 120–160ms, ease-out | Hover, press, toggle, tab switch |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | Drawer slide, dropdown fade+rise, macro-config reveal |
| Ledger Line draw-in | 400ms, ease-in-out | Module header underline on load |
| Ambient | 2–4s loops | Skeleton shimmer; live-dot breathing **only if something is genuinely live** |

**Phase-specific rule**: this simulation advances in discrete, user-triggered steps (Advance Day), not
continuously. **Do not apply a breathing live-dot or any other "ambient/live" motion to elements that only
change on explicit Advance Day calls** — the spec's own rule ("no stale data presented as if it were live")
cuts the other way here too: showing false continuous liveness for something that's actually static between
manual advances is its own violation of honesty-in-motion. Reserve the live-dot specifically for the session
status badge (which reflects genuine open/closed market-session state, however that's defined in this sim) and
anything the engine actually updates without user action. Nothing bounces, overshoots, or rotates.
`prefers-reduced-motion` disables ambient loops and collapses transitions to opacity fades.

### A8. States every feature must define
Advance Day: default (enabled), advancing (locked/disabled, indeterminate arc, cannot be double-fired), success
(summary of what changed), error (module-level, retry). Timeline/Events/News: default, loading (shape-accurate
skeleton), empty (no events/news yet in a fresh simulation), error (contained). Future Lab/Scenario Comparison:
default, running (if a scenario computation takes >300ms, show a skeleton or progress state), empty (no saved
scenarios yet), error.

### A9. Accessibility (mandatory, not follow-up)
≥4.5:1 contrast; direction never color-only; full keyboard model including a chart-focus shortcut for Timeline/
Scenario Comparison; visible focus ring; live regions announce "day advanced" / new events / new news,
throttled to 1 per 3 seconds per module (critical here — a single Advance Day could generate several
simultaneous events/news items, so batch them into one announcement rather than firing one per item).

### A10. General engineering rules
Backend: FastAPI + SQLAlchemy + Alembic. This phase is **more frontend-weighted than the others** — read
`apps/api/routers/simulation.py`, `apps/api/services/sim_service.py` (or equivalent), and the `engine/`
directory **completely** before writing any new backend code, since substantial simulation infrastructure
already exists (`Timeline`, `SimulationState`, `MarketEvent`, `EventInstance`, `NewsTemplate`, `NewsFeed`
models; `POST /advance`, `POST/GET /timelines`, `GET /state`, admin `POST /admin/events`, admin `PUT/GET
/admin/config`). Do not duplicate engine logic on the frontend. Frontend: Next.js 15 App Router, React 19,
TypeScript, JS/TS only, desktop-first. Every module fault-isolated. Verify by running the dev server and
actually advancing simulated days in a browser, watching real state changes, not just type-checking.

---

## PART B — Phase 4 Context: What Already Exists (read before writing anything — this phase has more
existing backend infrastructure than any other phase, so this section matters more than usual)

- **Models** (`db/models/` — confirm exact file, likely `simulation.py` or similar): `Timeline`,
  `SimulationState`, `MarketEvent`, `EventInstance`, `NewsTemplate`, `NewsFeed`. Read every field on every one
  of these models before designing any frontend view — the exact shape of `EventInstance` (does it carry a
  severity/impact score? a category? an affected-company/sector reference?) directly determines what the
  Events calendar (C4) can actually render, and the exact shape of `NewsFeed`/`NewsTemplate` determines what
  News (C5) can render.
- **Router** `apps/api/routers/simulation.py`: `POST /advance` (day-advance — read its exact request/response
  contract, including whether it returns a diff/summary of what changed or just a new state snapshot),
  `POST/GET /timelines` (creating/listing timelines — clarify what a "timeline" actually represents: is it one
  per user, one per simulation run/session, or something else? This directly affects whether Future Lab/
  Scenario Comparison can be built as "additional timelines" or need wholly separate infrastructure), `GET
  /state` (current simulation state), admin `POST /admin/events` (manually inject an event — admin-only),
  admin `PUT/GET /admin/config` (macro variable configuration — admin-only, meaning a **new non-admin read
  endpoint is required** for regular users to see macro variables, per C3).
- **Engine** (`engine/` directory): the actual simulation logic — price movement, event triggering, news
  generation. Read this to understand: how granular are price updates (per-day only, or finer)? Does
  triggering one event have any built-in mechanism for cascading into further events or correlated price
  moves (directly relevant to C6, "Ripple Effects")? Is there any existing "what-if"/dry-run/branch capability
  (directly relevant to C7, "Future Lab")?
- No frontend simulation route exists yet — `/simulation` is wholly new on the frontend.
- No chart library is installed — Timeline and Scenario Comparison visualizations will be hand-rolled SVG/
  Canvas consistent with the rest of the app's existing (Dashboard/Company Details) precedent, unless the
  charting-library decision has already been resolved in an earlier phase (Phase 2), in which case reuse that
  decision here rather than re-litigating it.

---

## PART C — Feature Specifications (extreme detail)

### C0. Page shell

- **Route**: `/simulation` (new). Recommended composition, largest-module-first: **Simulation Controls**
  (C9) anchors the page near the top (similar to how Portfolio Pulse anchors Dashboard) — current simulated
  date, session badge, the single primary Advance Day action. Below/beside it: **Timeline** (C1) as a
  horizontal chart card spanning the width. Then a grid: **Macro Variables** (C3, metric-card row), **Events**
  (C4, economic-calendar list card), **News** (C5, list card with Tiempos headlines). **Future Lab** (C7) and
  **Scenario Comparison** (C8) are substantial enough to warrant their own sub-route or tab (e.g.
  `/simulation/lab`) rather than being crammed into the main dashboard-style page — use a tab row (Ledger Line
  active-tab pattern) with at least two tabs: "Overview" (the composition above) and "Future Lab" (C7/C8
  combined, since Scenario Comparison depends on Future Lab runs existing).

### C1. TIMELINE

- **Purpose**: a horizontal visual history of the simulation — simulated days elapsed, with markers for events
  (`EventInstance`) and news (`NewsFeed`) plotted at their simulated date, plus the portfolio/market price
  trajectory if relevant to show alongside (check whether this should show a price series or purely be an
  event/news timeline — if the engine's `Timeline` model already conceptually bundles price history, reuse
  that; don't build a second parallel price-history mechanism if Phase 2's Performance chart already solved
  historical portfolio value).
- **Visual treatment**: a horizontal axis with mono date labels (`caption`, `ink-tertiary`), **never rotated**
  (spec bans rotated axis labels — thin them responsively as the timeline compresses/expands instead). Event
  markers: small dots or ticks positioned along a hairline axis, colored by amber impact-dot convention (1–3
  dots stacked or a single dot sized/opacity-scaled by impact, per the Economic Calendar pattern) rather than
  arbitrary category colors. News markers: a smaller, distinct glyph (e.g. a small document/quote icon at
  16px, `ink-secondary`) distinguishable from event markers at a glance without relying on color alone (shape
  difference, not just color difference, per the accessibility "never color-only" rule).
- **Interaction**: hovering a marker shows a glass tooltip (chart tooltips are allowlisted glass) with the
  event/news headline and date; clicking an event marker opens the Event detail drawer (C4); clicking a news
  marker opens the Article reading drawer (C5).
- **Range/zoom**: if the timeline spans many simulated days, a range selector (reuse the same ghost-pill
  pattern from Charts spec, or a simple drag-to-zoom on the timeline itself) lets the user focus a window
  rather than viewing the entire history compressed unreadably.
- **Present-moment marker**: the current simulated date gets the Ledger Line treatment — a vertical accent
  hairline at "now" on the timeline, clearly distinguishing past (rendered normally) from any future/projected
  content if Future Lab data is ever overlaid here (it shouldn't be, by default — keep Future Lab's projected
  timelines visually and physically separate from the real historical Timeline, per C7's "sandbox, doesn't
  affect the real timeline" requirement).

### C2. ADVANCE DAY

- **The single primary action of this entire phase** — per A6/Buttons spec's "one primary action per view"
  rule, this is unambiguously it. Rendered as a Primary button (accent-500 fill) inside the Simulation
  Controls module (C9), not floating independently.
- **Button label**: "Advance Day" (or, if the engine supports advancing by more than one day at a time per
  call — check the `POST /advance` contract — consider a small stepper/dropdown next to the button for "Advance
  N days," but default to single-day advancement as the primary action unless multi-day is already how the
  backend works).
- **Critical interaction requirement**: **the control must lock itself the instant it's clicked and cannot be
  double-fired.** Disable the button, swap its label for the 14px indeterminate arc (width locked, per A6),
  and additionally disable any other simulation-mutating control on the page (event injection if a non-admin
  path to that exists, scenario controls) for the duration of the request — a day-advance is a significant
  state transition (prices move, events may fire, news may generate) and firing two overlapping advances would
  produce an inconsistent or double-applied state.
- **Request**: `POST /advance` (existing endpoint — confirm its exact contract first, per Part B). If it does
  not already return a diff/summary of what changed, that's a valuable enhancement to request from the backend
  work in this phase: a response shape like `{ new_date, price_changes: [...], new_events: [...], new_news:
  [...] }` so the frontend can show a meaningful "what happened" summary rather than just silently refetching
  everything and hoping the user notices the diff themselves.
- **Post-advance summary — do not silently refresh data underneath the user.** On success, show a transient
  summary (a toast is too small for potentially several changes; recommend a brief inline summary panel that
  appears above the Timeline for a few seconds, or expands from the Controls module) listing: the new simulated
  date, a compact list of notable price moves (ticker + signed % + glyph, market color, limited to the most
  significant N moves rather than every single company), and counts of new events/news ("3 new events, 2 news
  items — view below"), with the list scrolling into view or highlighting the corresponding new rows in the
  Events/News modules below (a brief highlight-fade using the data-tick 240ms class, not a persistent color
  change).
- **Error handling**: if `POST /advance` fails (e.g. simulation already at some end boundary, or a server
  error), re-enable the control, show a module-level error state on the Controls card specifically (not a
  full-page error) with a clear cause line and Retry button.

### C3. MACRO VARIABLES

- **Backend gap to close**: `PUT/GET /admin/config` is admin-scoped. Regular (non-admin) users need to **see**
  current macro variable values without being able to **set** them. Add a new endpoint, e.g. `GET
  /simulation/config` (non-admin, read-only, authenticated), returning the same underlying config data as
  `/admin/config` but without exposing any mutation path. Do not simply loosen the admin requirement on the
  existing endpoint — that would expose the `PUT` mutation to non-admins too, a real authorization bug; add a
  genuinely separate read-only route.
- **Read the actual current config shape first** — what variables does the engine model? (Likely candidates:
  interest rate, inflation rate, overall market sentiment/volatility index, sector-specific modifiers — but
  confirm against the real `admin/config` response rather than assuming this list.)
- **UI**: a metric-card row (per the Metric card grammar: eyebrow → `data-lg` or `data` value → optional delta
  line if the variable changed since the last advance → no sparkline footer needed here since these are
  discrete config values, not continuous series, unless historical macro-variable tracking is meaningful and
  available). Each card's eyebrow label uses a Definition tooltip (dotted underline, one-line explanation in
  mono) explaining what the variable means and how it affects the simulation, matching the same pattern used
  for Analytics metrics in Phase 2 — do not ship unexplained macro-jargon labels.
- **Change highlighting**: if a macro variable changed as a direct result of the most recent Advance Day, its
  card gets a brief highlight (240ms data-tick class) tying back into the C2 post-advance summary.

### C4. EVENTS

- **Use the spec's named Economic Calendar card pattern verbatim**: day-grouped rows (events grouped under
  their simulated date as a `micro` sub-header), each row showing 1–3 amber impact dots indicating
  significance/magnitude (map this from whatever severity field `EventInstance` actually carries — read the
  model first), event title (`body`/`body-strong`), and affected scope (ticker/sector/macro-wide — a small
  neutral badge or `caption` label). **Actuals flash on release**: when an event's outcome/actual value
  becomes known (as opposed to being a scheduled/pending future event), the row's actual-value cell flashes
  using the data-tick animation — this implies events may have a "scheduled" vs. "realized" state; confirm
  whether `EventInstance`/`MarketEvent` models this distinction before building both states, and if they don't,
  simplify to showing only realized events (since this simulation may not have a concept of "pre-announced but
  not yet occurred" events at all — don't build UI for a state the data model can't represent).
- **Row click**: opens the Event detail drawer (glass, right-edge, 400–480px) with the full event
  description, the specific price/market reaction it caused (if the engine records causality — tie into C6),
  and its exact simulated timestamp.
- **Filtering**: a lightweight filter row (pill multi-select, reused pattern from Market Explorer's filter
  rail if that exists) by category/impact-level/affected-scope, if the event model supports meaningful
  categorization — don't build filter UI for a dimension the data doesn't actually have.
- **Empty state**: "No events yet" heading, "Market events will appear here as the simulation progresses.",
  no CTA needed beyond the Advance Day control already visible above in Controls.

### C5. NEWS

- **Use `NewsFeed` data.** Headlines render in **Tiempos editorial serif** at a readable body size (this is
  explicitly correct per A3 — "News headlines, long-form analysis" is Tiempos' named job in the type table).
  List-card format: each row shows headline (Tiempos, `body`-equivalent size but using the editorial face, not
  Söhne), a `caption` mono timestamp (simulated date/time, `ink-tertiary`), and a short dek/summary line if
  `NewsFeed`/`NewsTemplate` provides one.
- **Row click → Article reading drawer**: glass, right-edge, 400–480px (per the Modals spec's drawer sizing),
  full article body in Tiempos at a comfortable reading size/line-height (this is long-form editorial content,
  give it real typographic breathing room — generous line-height, comfortable measure/width within the drawer,
  not squeezed to match the density of surrounding data tables). If the article references a specific
  ticker/event, include a tappable evidence-style chip linking to that Company Details page or the relevant
  Event detail drawer (reusing the same "tappable evidence chip" convention the spec defines for AI cards,
  since it's the same underlying pattern: traceable references from narrative text to source data).
- **Empty state**: "No news yet" heading, "News generated by the simulation will appear here."

### C6. RIPPLE EFFECTS — clarify scope before building

**This term has no existing backend model name behind it — do not guess and build the wrong thing.** Ask the
user which of these two interpretations (or a third) is intended:

(a) **A visualization of cross-market correlation/cascade** — how one event's price impact on Company/Sector A
correlates with or propagates to Company/Sector B. If this is the intent, it maps directly onto the spec's
**named Correlation matrix card pattern**: a diverging-ramp opacity grid (rows/columns = companies or sectors,
cell opacity = correlation magnitude, color = positive/negative correlation via the diverging ramp) with
row/column crosshair highlight on hover. This is buildable as a frontend visualization over data the engine
likely already has some form of (correlated price movements are typically inherent to how a market simulation
engine works) — but confirm the engine actually computes/exposes correlation data before promising this exact
visualization.

(b) **Engine-side event chains** — one event triggering further downstream events (a cascade of `EventInstance`
records causally linked to an originating `MarketEvent`). If this is the intent, check whether `engine/`
already has any causal-chain logic; if it does, this feature is mostly a **display** concern (show the causal
chain as a small linked list/tree in the Event detail drawer from C4 — "This event was triggered by: {parent
event}" / "This event triggered: {child events}"), not a new simulation mechanism. If the engine has no such
concept today, building true causal event chains is a meaningfully larger backend feature (the engine needs
new logic to actually generate cascading events, not just display a relationship that doesn't exist) — flag
this cost difference clearly to the user since it changes the scope substantially.

**Recommendation if forced to pick one without a conversation**: interpretation (a), the Correlation matrix,
is more contained (a display layer over data the engine likely already implies through its price-correlation
model) and directly reuses a spec-named component — but this is a recommendation to prompt a decision, not
permission to proceed without confirming.

### C7. FUTURE LAB — clarify scope before building

**Also undefined against existing models — clarify before building.** The two plausible interpretations:

(a) **Manual scenario authoring/sandbox**: the user sets macro variables (or triggers specific events) and
advances N simulated days **in an isolated sandbox that does not affect the real timeline/portfolio** — seeing
a hypothetical outcome without commitment. This is the more buildable interpretation given the existing engine
(it needs a "branch" or "fork" of the current `SimulationState`/`Timeline` that the advance/event logic can run
against in isolation, then discard or save) and it directly sets up C8 (Scenario Comparison needs something to
compare — this is exactly that something).

(b) **Monte Carlo-style statistical projection**: run many randomized simulated trajectories from the current
state and show a probability distribution of outcomes (e.g. "70% chance portfolio value is between $X and $Y
in 30 days"). This is statistically more sophisticated but requires the engine's price/event generation to be
fast enough to run many times per request and requires new aggregation/statistics logic that likely doesn't
exist today.

**Recommendation**: interpretation (a) — manual scenario sandbox — unless the user specifically wants
probabilistic projection. It reuses the existing single-path engine mechanics (just run against an isolated
state fork instead of the real one) rather than requiring new statistical infrastructure, and it's the
interpretation that makes Scenario Comparison (C8) meaningful and buildable.

**If (a) is confirmed, backend requirements**:
- A way to fork/branch `SimulationState`/`Timeline` — check whether the existing `Timeline` model's schema
  already supports multiple named timelines per user (re-read `POST/GET /timelines` — if "timeline" already
  means "a named simulation run," Future Lab scenarios may just be **additional timelines** rather than a new
  concept, which would make this significantly cheaper to build than inventing new schema).
- If timelines are already multi-instance and forkable: `POST /timelines/{id}/fork` (or similar) creates a new
  timeline seeded from the current state of an existing one, then the existing `POST /advance` and admin event-
  injection logic (exposed to the *owner* of a sandbox timeline, not just admins, for their own scenario
  timelines specifically — this needs careful scoping so a regular user can manipulate their own sandbox
  without gaining general admin event-injection rights) operate against the forked timeline instead of the
  real one.
- If timelines are NOT already multi-instance/forkable: this is new schema work — flag the cost difference to
  the user, since "add a fork endpoint to existing multi-timeline infra" and "build multi-timeline infra from
  a single-timeline model" are very differently sized tasks.

**Frontend — scenario builder form** (react-hook-form): fields for adjusting macro variables from their
current baseline (reuse the same inputs as C3's display, but editable here, clearly labeled as a hypothetical
override, not a real config change), a "days to simulate" stepper, and a "Run scenario" primary button. Results
render as a Chart card (a projected value/price trajectory, visually distinguished from the real Timeline via
a dashed or lower-opacity line style plus an explicit "Projected" label — never let a hypothetical line be
visually confusable with real historical data, this is an accuracy/honesty requirement, not just a style
choice). Save/name a scenario run for later comparison (C8).

### C8. SCENARIO COMPARISON

- **Depends entirely on Future Lab (C7) existing and scenarios being persistable/nameable** — do not build
  this before C7's scope is resolved.
- **Persistence**: if C7 lands on "scenarios are just additional timelines" (the recommended, cheaper path),
  scenario comparison is simply selecting multiple existing timelines and rendering them together — no new
  table needed, reuse `Timeline`. If C7 required new schema, Scenario Comparison reuses that same new schema.
- **Visualization**: reuse the Charts spec's comparison mode exactly as used elsewhere (Phase 2's Performance
  chart, if built) — multiple series drawn from the categorical ramp, normalized to % change from a common
  starting point, with a floating draggable glass legend letting the user toggle series visibility. Each
  series is labeled with its scenario name (mono chip in the legend, colored per its ramp assignment).
- **Selection UI**: a multi-select dropdown or pill list of saved scenarios (plus "Real Timeline" as an
  always-available baseline series, visually distinguished as the solid/authoritative line versus scenarios'
  dashed/projected treatment per C7).
- **Empty state**: "No scenarios to compare yet" heading, "Run a scenario in Future Lab to compare it here.",
  primary button routing to the Future Lab tab/form.

### C9. SIMULATION CONTROLS

- **The anchor module of the Overview tab**, similar in prominence to Dashboard's Portfolio Pulse hero.
  Contents: current simulated date (`display` or `heading-1` mono), session/market status badge (`OPEN`/
  `PRE`/`CLOSED` — reuse the global header's badge component), the Advance Day primary action (C2), and — if
  the engine supports variable-rate/multi-day advancement — a small secondary control for that (e.g. a stepper
  or dropdown "Advance: 1 day ▾" with options for more days if the backend contract supports it; do not build
  this control if `POST /advance` only ever advances exactly one day per call).
- **Quick links**: ghost-style links/icons to jump to Macro Variables, Events, and the Future Lab tab, so this
  module functions as the page's control-and-navigation anchor.
- **Live vs. static motion**: per A7, the session badge may use a live-dot if the underlying session concept is
  genuinely live; the simulated date and Advance Day button do not get any ambient motion since they only
  change on explicit user action.

---

## PART D — Strict Do-Not List (Phase 4)

- **Do NOT** guess at the meaning of "Ripple Effects" or "Future Lab" and build a full implementation without
  first confirming the interpretation with the user — both are flagged in C6/C7 with specific clarifying
  questions and a recommendation; get explicit confirmation before writing substantial code against either.
- **Do NOT** apply breathing live-dots or other continuous ambient motion to elements that only change on
  explicit Advance Day calls — this simulation is discrete-step, not continuously live, and false liveness
  violates the spec's own "no stale data presented as live" principle in spirit.
- **Do NOT** let the Advance Day control be double-fireable — lock it and any other simulation-mutating
  control for the full duration of the request.
- **Do NOT** silently refresh all page data after Advance Day without showing the user a summary of what
  changed — this is a significant state transition and deserves a visible read-back, not a silent mutation.
- **Do NOT** loosen the existing admin-only `/admin/config` endpoint's authorization to serve non-admin reads —
  build a genuinely separate read-only endpoint instead, to avoid accidentally exposing the mutation path.
- **Do NOT** grant a regular user general admin event-injection rights while building their own Future Lab
  sandbox capability — scope any user-facing "trigger an event in my scenario" ability narrowly to their own
  forked/sandbox timeline, never the real shared simulation state.
- **Do NOT** visually confuse a Future Lab projected/hypothetical trajectory with the real historical Timeline
  — always distinguish projected lines (dashed/lower-opacity/explicitly labeled) from real data.
- **Do NOT** rotate axis labels on the Timeline or Scenario Comparison charts — thin them responsively instead.
- **Do NOT** use arbitrary hues for event markers, news markers, or comparison-mode series — amber impact dots
  for events, the categorical ramp for comparison series, shape (not just color) differentiating event vs.
  news markers on the Timeline.
- **Do NOT** build UI for event states the data model can't represent (e.g. "scheduled but not yet realized"
  events with actuals-flash-on-release) without first confirming `EventInstance`/`MarketEvent` actually model
  that distinction.
- **Do NOT** build filter UI for event categorization dimensions the data model doesn't actually have.
- **Do NOT** use Interface (Söhne) type for news headlines or article bodies — use Tiempos editorial serif, per
  the spec's explicit typeface-to-content-type mapping.
- **Do NOT** exceed 14px border radius, use pure black/white, or add glass anywhere beyond the two allowlisted
  drawers (event detail, article reading) and chart tooltips in this phase.
- **Do NOT** duplicate engine logic on the frontend — read `engine/` and the existing simulation router/service
  fully before writing new backend code, and extend rather than reimplement.
- **Do NOT** touch Trading Desk, Portfolio, Dashboard, or AI Workspace internals beyond consuming their already-
  built shared components — this phase's file boundary is `app/simulation/**`, extensions to
  `apps/api/routers/simulation.py` and its service layer, and any new Alembic migrations required by the
  confirmed Ripple Effects / Future Lab scope.
- **Do NOT** skip the Alembic migration for any new table required by the confirmed scope (e.g. scenario
  persistence, if new schema beyond existing `Timeline` is needed) — no manual schema edits.
- **Do NOT** ship this phase without manually advancing several simulated days in a running browser and
  confirming Timeline, Events, News, and Macro Variables all update coherently and correctly reflect the new
  state — and, once Ripple Effects/Future Lab scope is confirmed and built, exercising those flows end-to-end
  too before calling the phase done.

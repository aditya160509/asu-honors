# MarketVerse — DESIGN_SPEC.md
### Design language: Meridian
Single source of truth for the frontend's visual language. Supersedes any conflicting styling guidance elsewhere in the repo.

---

# Vision

MarketVerse is an institutional-grade market intelligence platform for analysts and active traders. It must read as a professional instrument, not a consumer app — closer to a Bloomberg terminal or a hedge-fund research desk than a fintech landing page.

The chrome of the application — navigation, panels, containers — recedes into near-invisibility. The *data* — prices, deltas, charts, signals — carries all the color, all the motion, and all the visual weight. A user's eye should never be pulled toward a button when a price is moving.

**Meridian is a graphite instrument panel where the only things allowed to shine are the numbers.**

---

# Design Philosophy

Governing principle: **quiet surfaces, loud data.**

**The Five Laws**

1. **Data is the only decoration.** No ornament exists that isn't derived from live information. Gradients encode magnitude. Motion encodes change. Color encodes direction.
2. **One accent, everywhere.** A single institutional blue is the only "brand" color. Green and red belong exclusively to the market. Nothing else may use them.
3. **Ink on glass.** Every surface behaves like a physical material — matte graphite panels, frosted glass overlays, hairline metal borders. Nothing floats without a shadow; nothing overlaps without blur.
4. **Numbers are typography's first citizens.** Tabular figures, fixed decimal alignment, and monospaced tickers are non-negotiable. A misaligned column of prices is a bug, not a style choice.
5. **The interface never sleeps, and never shouts.** Something is always subtly alive — a breathing sparkline, a ticking timestamp, a shimmering skeleton — but nothing ever flashes, pulses aggressively, or glows neon.

**Signature element — the Ledger Line.** A 1px luminous accent hairline that traces the "active edge" of the interface: it underlines the focused module, runs along the live edge of a streaming chart, and draws itself under section headers on load. It is the platform's heartbeat — always thin, always precise, never decorative.

---

# Color System

No pure `#000000` or `#FFFFFF` anywhere, ever. Market green/red are reserved exclusively for price direction — never repurposed for generic success/error UI (those use accent and amber). The `ai` iris color is reserved exclusively for AI-generated content markers and never appears as a fill.

### Core brand & semantic (theme-independent)

| Token | Hex | Role |
|---|---|---|
| `accent-500` | `#3E6FE0` | Primary actions, focus rings, Ledger Line, selection |
| `accent-600` | `#3159BE` | Pressed states, dark-theme accent text |
| `accent-300` | `#7C9EF0` | Chart primary series, links on dark |
| `market-up` | `#2E9E6B` | Positive deltas only |
| `market-up-deep` | `#1F7A50` | Fills, muted positive |
| `market-down` | `#D64550` | Negative deltas only |
| `market-down-deep` | `#A83540` | Fills, muted negative |
| `warn` | `#D9922E` | Warnings, stale data, circuit breakers |
| `info` | `#4E8FB8` | Neutral informational states |
| `ai` | `#8B7CF6` | AI content markers only — hairline, icon tint, or badge |

### Dark theme — "Terminal" (default)

Blue-black graphite scale, 224° hue undertone — cold and precise, not neutral gray.

| Token | Hex | Role |
|---|---|---|
| `bg-canvas` | `#0A0C10` | App background |
| `bg-surface-1` | `#101318` | Sidebar, header, base panels |
| `bg-surface-2` | `#161A21` | Cards, modules |
| `bg-surface-3` | `#1D222B` | Nested elements, table header rows, hover |
| `bg-surface-4` | `#242A35` | Active/selected fills, dropdowns |
| `bg-glass` | `rgba(16,19,24,0.72)` + 24px blur | Overlays, command palette, sticky headers |
| `ink-primary` | `#E8EAEE` | Primary text |
| `ink-secondary` | `#9BA3B0` | Secondary text, labels |
| `ink-tertiary` | `#5C6470` | Placeholder, disabled, axis labels |
| `stroke-hairline` | `rgba(255,255,255,0.07)` | Default borders |
| `stroke-emphasis` | `rgba(255,255,255,0.13)` | Hover borders, major dividers |
| `stroke-accent` | `rgba(62,111,224,0.55)` | Focus, active module edge |

On dark, market colors brighten for contrast: `market-up` → `#3FBF85`, `market-down` → `#E85D68`.

### Light theme — "Research Desk"

Bone-white paper with graphite ink — positioned as the analyst's reading mode.

| Token | Hex | Role |
|---|---|---|
| `bg-canvas` | `#F6F7F9` | App background |
| `bg-surface-1` | `#FBFCFD` | Sidebar, header |
| `bg-surface-2` | `#FFFFFF`→`#FDFDFE` | Cards (subtle top-lit gradient) |
| `bg-surface-3` | `#F1F3F6` | Table headers, hover, wells |
| `bg-surface-4` | `#E8EBF0` | Selected fills |
| `bg-glass` | `rgba(251,252,253,0.78)` + 20px blur | Overlays |
| `ink-primary` | `#171B21` | Primary text |
| `ink-secondary` | `#5A6373` | Secondary text |
| `ink-tertiary` | `#98A1AF` | Tertiary text |
| `stroke-hairline` | `rgba(23,27,33,0.08)` | Borders |
| `stroke-emphasis` | `rgba(23,27,33,0.14)` | Dividers |

On light, market colors deepen: up → `#1E8A5A`, down → `#C13540`.

### Data-encoding ramps

Charts and heatmaps never use arbitrary hues.

- **Categorical (max 6 series):** Cobalt `#3E6FE0` → Slate `#4E8FB8` → Iris `#8B7CF6` → Warm Gray `#9A8F80` → Amber `#D9922E` → Teal `#3D9E96`.
- **Diverging (heatmaps, sector maps):** `market-down-deep` → neutral graphite `#2A2F38` → `market-up-deep`. Magnitude maps to **opacity** (30–100%), never to a brighter hue.

---

# Typography

Three typefaces, three jobs, no exceptions.

| Role | Typeface | Fallback stack | Used for |
|---|---|---|---|
| Interface | Söhne | Inter, SF Pro Text, system-ui | UI chrome, labels, navigation, buttons |
| Data | Söhne Mono | IBM Plex Mono, SF Mono | Prices, tickers, timestamps, order books, table figures |
| Editorial | Tiempos Text | Georgia, serif | News headlines, long-form analysis, AI narrative summaries |

### Type scale (1.250 major-third, 4px baseline grid)

| Token | Size / Line | Weight | Tracking | Usage |
|---|---|---|---|---|
| `display-xl` | 40 / 44 | 600 | −0.02em | Hero net-worth figure, portfolio total |
| `display` | 32 / 36 | 600 | −0.015em | Page titles, primary KPI |
| `heading-1` | 24 / 28 | 600 | −0.01em | Module titles |
| `heading-2` | 18 / 24 | 600 | −0.005em | Card titles, modal titles |
| `body` | 14 / 20 | 400 | 0 | Default UI text |
| `body-strong` | 14 / 20 | 550 | 0 | Emphasis within body |
| `caption` | 12 / 16 | 400 | +0.01em | Secondary metadata, axis labels |
| `micro` | 11 / 14 | 500 | +0.04em, uppercase | Eyebrows, column headers, badges |
| `data-lg` | 28 / 32 | 500 mono | 0, tabular | Featured prices |
| `data` | 13 / 18 | 450 mono | 0, tabular | Table cells, tickers |
| `data-sm` | 11 / 14 | 450 mono | 0, tabular | Dense grids, order book |

### Numeric rules (non-negotiable)

- Tabular lining figures always, anywhere two numbers can appear vertically adjacent.
- Prices right-align on the decimal point; currency symbols and percent signs render at 85% size, slightly desaturated, so the numeral dominates.
- Deltas always show an explicit sign (`+2.41%`), same weight as the numeral — never parentheses for negatives.
- Tickers are always mono, uppercase, tracked +0.02em (`AAPL`, `RELIANCE.NS`, `7203.T`).
- Timestamps are mono, `caption` size, `ink-tertiary` (`14:32:07 IST`).

### Section header pattern

A `micro` eyebrow above a heading (e.g. `MARKET EXPLORER` above a 24px title). The eyebrow row is where the Ledger Line accent draws itself in on page load (see GSAP Motion Principles).

---

# Layout Principles

### The five-layer elevation model

Every pixel belongs to exactly one layer, separated by three simultaneous cues at once — background step, shadow, hairline — kept individually subtle. Stacking three subtle cues (rather than one strong cue) is what produces "expensive" depth.

| Level | Name | Surface | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | Cards, chart panels, widgets |
| 3 | Raised | `bg-surface-3/4` | Dropdowns, popovers, tooltips |
| 4 | Overlay | `bg-glass` | Modals, command palette, drawers |

**Surface hierarchy rules:**
- A module never sits directly on canvas without its hairline edge — cards are "cut metal panels," always edged.
- Nesting is capped at two visible background steps (module → nested well). A third level uses a divider or spacing instead of another background step.
- Selected/active state raises the module's **border**, not its surface — the Ledger Line traces the top edge rather than the card lifting or glowing.

### Application shell composition

Three-zone layout: fixed sidebar · fluid content region · optional context rail.

- **Header** (Level 1, glass-on-scroll): mark + wordmark, then a live **index tape** (pinned indices ticking in mono), search trigger, market clock with session badge (`OPEN`/`PRE`/`CLOSED`), notifications (dot only, never a number), settings, account avatar.
- **Sidebar** (Level 1, collapsible to an icon rail): grouped nav items under `micro` eyebrows; active item gets a filled background, tinted icon, and a 2px accent bar on the left edge. Footer holds density toggle, theme toggle, and a permanently visible connection-status row (live-dot + feed name) — an institutional trust signal.
- **Module header pattern**, uniform across the entire app: eyebrow + title on the left, ghost icon actions (expand, settings, more) on the right, separated from the body by a half-strength divider. Every module can be maximized to full-screen.

```
┌────────────────────────────────────────────────────────────────────┐
│ ◆ Mark  Index tape (live)         [Search]  Clock  Settings  ⚈    │
├──────────┬───────────────────────────────────────────┬─────────────┤
│ Sidebar  │  Content region (fluid, 12-col)            │ Context     │
│ (fixed)  │                                             │ rail (opt.) │
└──────────┴───────────────────────────────────────────┴─────────────┘
```

### Density

Two density modes, toggled at the header level: **Comfortable** (default) and **Compact**. Compact drops table row height and switches numeric type to `data-sm` — a terminal-user expectation, not a cosmetic option.

---

# Grid & Spacing

- Base unit: 4px.
- Component-internal spacing: 4 / 8 / 12 / 16.
- Layout spacing: 16 / 20 / 24 / 32.
- App grid: fixed 240px sidebar (collapses to 64px icon rail) · fluid 12-column content region with 24px gutters · optional 320px context rail (watchlist/news dock).
- Row height by density: Comfortable 40px, Compact 28px.
- Page margins: 24px on desktop, 32px on displays ≥1680px.
- Content max-width is **unbounded** — this is a terminal, not a blog; it uses every pixel of a trading-desk monitor.

---

# Shadows

Shadows are layered pairs — a tight contact shadow plus a soft ambient one — always cool-toned (canvas hue, never pure black).

| Token | Definition (dark theme) | Usage |
|---|---|---|
| `shadow-rest` | `0 1px 2px rgba(4,6,10,0.5), 0 0 0 1px stroke-hairline` | Level 1–2 surfaces |
| `shadow-raised` | `0 4px 12px rgba(4,6,10,0.5), 0 1px 3px rgba(4,6,10,0.6), 0 0 0 1px stroke-emphasis` | Level 3 — dropdowns, popovers, tooltips |
| `shadow-overlay` | `0 24px 64px rgba(4,6,10,0.6), 0 8px 24px rgba(4,6,10,0.5), 0 0 0 1px stroke-emphasis` | Level 4 — modals, drawers, command palette |
| `shadow-inset-well` | `inset 0 1px 3px rgba(4,6,10,0.45)` | Input fields, data wells |
| `glow-accent` | `0 0 0 3px rgba(62,111,224,0.22)` | Focus rings only |

Light theme uses the same structure at roughly 40% opacity, with `rgba(23,27,33,…)` shadow ink.

---

# Borders

### Radius scale

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | 4px | Badges, tags, mini-chips |
| `radius-sm` | 6px | Buttons, inputs, table row selection |
| `radius-md` | 10px | Cards, modules, widgets |
| `radius-lg` | 14px | Modals, command palette |
| `radius-full` | 999px | Avatars, status dots, pill filters |

Nothing above 14px. Oversized (24px+) radii are the fastest way to look like a consumer fintech app.

### Border language

- Hairline is the default card/divider treatment: 1px `stroke-hairline`. On dark, borders are *lighter* than their surface (light-emitting edges); on light, *darker* (ink edges).
- **Ledger Line (active state):** the focused module's top border becomes a 1px accent gradient (`transparent → accent-500 → transparent`, centered, 60% of the module's width) — the only glow-adjacent effect in the system.
- Table row dividers use hairlines at **half-strength** of the standard token, so dense tables don't turn into a grid of lines.

---

# Glass & Surface Rules

### Ambient mesh (Level 0 canvas)

The canvas is never flat, but the mesh must stay nearly imperceptible and must never animate — motion in the background reads as gaming, stillness reads as institutional.

- **Dark:** two large radial gradients — cobalt `rgba(62,111,224,0.05)` from the top-left, slate `rgba(78,143,184,0.04)` from the bottom-right — over `bg-canvas`, plus ~1.5% opacity noise grain to kill banding.
- **Light:** a vertical bone gradient `#F8F9FB → #F3F5F8` with the same grain.
- Cap: ≤6% color opacity in the mesh.

### Surface gradients

Every Level-2 card carries a top-light gradient: a vertical fade from +3% lightness at the top edge to the base surface color by ~120px down. Combined with the hairline, this produces a "machined panel under overhead lighting" effect. Must stay at ±3% — beyond that it reads as glossy/plastic.

### Frosted glass — strict allowlist

Glass (`bg-glass`, 20–24px backdrop blur, 140% saturation boost) is permitted in exactly five places:

1. Command palette / global search overlay
2. Modals and side drawers
3. The sticky app header, once content scrolls beneath it
4. Chart tooltips floating over data
5. The AI card header strip

Glass is never used for resting cards, sidebars, or buttons — scarcity is what makes it read as craft rather than template. Every glass surface gets a 1px `rgba(255,255,255,0.10)` inner top edge (the "wet edge") to sell the material.

---

# Component Library

### Iconography

- 1.5px stroke, geometric, rounded joins, 24px grid with 20px live area (Lucide/Linear school — not filled icons).
- Sizes: 16px (inline/table), 20px (buttons, nav), 24px (empty states, feature icons).
- Color: `ink-secondary` at rest, `ink-primary` on hover/active. Accent color reserved for the active nav item and semantic market glyphs only.
- Market direction glyphs (▲/▼, 1.5px stroke) always pair with — never replace — the signed numeral, for color-blind safety.
- A bespoke financial-icon dialect (candlestick, order book, P/E, dividend, options chain, sector) is drawn on the same 1.5px grid so domain icons feel native.

### Buttons

| Variant | Treatment | Usage |
|---|---|---|
| Primary | `accent-500` fill, top-light gradient, white text, `radius-sm`, `shadow-rest`; hover +4% lightness; press inverts the gradient | One per view — the single primary action |
| Secondary | `bg-surface-3` fill, hairline border, `ink-primary` text | Default action weight |
| Ghost | Transparent, `ink-secondary` text; hover fills `bg-surface-3` | Toolbars, table row actions |
| Destructive-confirm | Ghost at rest; fills `warn` amber only inside confirmation modals — never market red | Delete watchlist, close account |
| Market actions | Buy: `market-up-deep` fill / Sell: `market-down-deep` fill — the only buttons permitted to use market colors, always paired side-by-side at equal width | Order tickets |

Heights: 32px default, 28px compact/table-inline, 40px modal primary. Icon+label gap: 8px. Loading state swaps the label for a 14px indeterminate arc; button width is locked and never resizes while working.

### Cards

Standard module: `bg-surface-2`, top-light gradient, hairline, `radius-md`, `shadow-rest`, 16px padding (20px for featured widgets).

**Card grammar (compose from these three patterns):**
- **Metric card** — eyebrow → `data-lg` value → delta line → sparkline footer bleeding to the card edges.
- **List card** — module header → dense rows → "View all →" ghost footer.
- **Chart card** — module header → toolbar strip → canvas bleeding to edges, no inner padding around the plot.

**Specialized card types**, all built from the same grammar so any combination composes cleanly:
- **AI card** — a 2px iris top edge, header badge (✦ glyph + "AI BRIEFING" + confidence chip); the header strip is a permitted glass surface, separating machine narrative from live data. Body copy uses the Tiempos editorial typeface with tappable evidence-source chips. Never uses market green/red in its own chrome — may only *quote* colored deltas inside evidence chips.
- **Order book** — mirrored mono bid/ask columns, depth shown as opacity-scaled horizontal bars from the spread outward.
- **Options chain** — strike-centered dual table, ITM rows tinted 4% market color.
- **P&L card** — realized/unrealized split, mono figures, a thin diverging bar centered on zero.
- **Earnings countdown** — mono countdown, consensus vs. whisper EPS, historical beat/miss dots.
- **Dividend tracker** — ex-date timeline on a hairline with amount chips.
- **Economic calendar** — day-grouped rows, 1–3 amber impact dots, actuals flash on release.
- **Correlation matrix** — diverging-ramp opacity grid with row/column crosshair highlight on hover.

### Tables

Tables carry the majority of the product's surface area and get commensurate care.

- Header row: `bg-surface-3`, sticky, `micro` uppercase labels in `ink-secondary`; sortable columns reveal a chevron on hover, the sorted column keeps it visible.
- Rows: 40px (28px compact), half-strength hairline separators, **no zebra striping** (it fights the price-flash animation). Hover fills the full row width.
- Cells: text left-aligned; all numerics right-aligned mono with decimal alignment. Delta cells show a signed value + direction glyph, with an optional magnitude bar for scanability in long lists.
- First column (ticker + name) pins on horizontal scroll with a gradient scrim indicating overflow.
- Row selection: 2px accent left edge + filled background; a checkbox appears in a dedicated gutter on hover.
- Inline sparkline column: 96×24px, single 1.5px stroke in market color with a fading fill.
- A column manager (density, visibility, reorder) sits behind a ghost icon at the top-right of every table.

### Inputs

- 32px height, a well one step darker than its parent card, inset shadow, hairline border, `radius-sm`.
- Focus: border becomes accent, plus the accent glow ring. No floating label animation — labels sit permanently above at `micro` size.
- Numeric inputs are mono, right-aligned; stepper affordances appear on hover only.
- Inline validation: a caption line below in amber with a small icon; the field border matches. Red stays reserved for the market.
- Specialized fields: ticker inputs auto-uppercase with a live match dropdown; quantity/price fields show a real-time notional value as ghost text inside the field.

### Dropdowns

Level-3 "Raised" surfaces: `bg-surface-3/4`, `shadow-raised`, `stroke-emphasis` border, `radius-sm`. Item rows fill `bg-surface-3` on hover/highlight and show a check or accent mark when selected. Used for menus, the range-selector custom picker, the column manager, and saved-screen selectors.

### Tabs

Ghost tab row with no filled background for inactive tabs. The active tab is marked by the Ledger Line — a 1px accent underline — rather than a filled pill or bold weight change alone. Tab rows may stick below a page's identity/header bar on scroll.

### Badges

`radius-xs`, `micro` type. Used for: ticker chips, session-state pills (`OPEN` green-tinted / `PRE` amber / `CLOSED` gray), notification indicators (a dot only — never a number), alert-armed markers (bell glyph, amber when near trigger), impact pips (1–3 amber dots), and AI sentiment glyphs (▲ ▽ ◇ in iris outline, always with a definition tooltip — a labeled machine judgment, never colored as market data).

### Tooltips

- **UI tooltips** — Level-3 solid surface, `radius-xs`, `caption` text, 150ms delayed fade, no arrow.
- **Chart tooltips** — glass panels (one of the five permitted glass surfaces) with a mono data grid: date header, aligned label/value pairs, series-color chips; the crosshair hairline extends to both axes with tagged values.
- **Definition tooltips** — dotted-underlined financial terms open a small explainer card with a one-line formula in mono.

### Modals

Includes modals, side drawers, and the global command palette — all Level-4 glass overlays.

- Modal: `radius-lg`, `shadow-overlay`, scrim behind with blur. Widths: 420 (confirm), 560 (form), 800 (data/comparison). Anatomy: padded header (title + ghost close) → divider → body → footer with right-aligned actions. Enter transition: fade + scale from 0.98. Order-confirmation modals restate the trade in a raised well with mono figures (the institutional "read-back" pattern). Never stack two modals — secondary detail opens as a right-side drawer instead.
- **Command palette** (`⌘K`/`Ctrl+K`): a 640px glass panel dropping from the upper third of the screen over a scrim. Anatomy: mono search input row → grouped results (Instruments, Actions, News, Pages), each under a `micro` eyebrow. The selected row fills with a background tint and the Ledger Line on its left edge.
- **Drawers**: same glass treatment as modals, opened from the right edge (e.g. company preview, article reading view), typically 400–480px wide.

### Toasts

Bottom-right stack (max 3; older toasts compress upward). Level-3 surface, `radius-md`, `shadow-raised`, 360px wide, auto-dismiss at 5s with a thin progress hairline draining along the bottom edge. Semantic left edge: accent (info/success — success is cobalt, never green), amber (warning), market-red reserved only for order rejections. Anatomy: icon, strong title, optional caption line, optional ghost action. Toasts never carry critical-path decisions.

### Skeletons

Shape-accurate placeholders on a raised surface with a 1.8s shimmer sweep. Skeletons mirror the real layout exactly — table skeletons show true column widths, chart skeletons show a static ghost price line rather than an empty box, number skeletons render as right-aligned bars of realistic varied widths. Anything that loads in under 300ms skips the skeleton entirely to avoid flicker.

### Loading

Distinct from skeletons (which stand in for *not-yet-loaded content*): loading indicators communicate *ongoing activity*. A button's loading state swaps its label for a small indeterminate arc without changing the button's width. Always-on "live" indicators (a breathing dot at 60–100% opacity, a ticking timestamp) signal that a data stream is active — these run continuously and are not considered decorative motion.

### Empty States

Empty states are starts, not apologies. Standard anatomy, centered, max 320px wide:

1. A small line-drawn domain illustration with one accent-tinted element.
2. A heading that states the opportunity (e.g. "Build your first watchlist").
3. One sentence of direction in secondary ink.
4. A secondary-style primary button plus a ghost alternative.

A faint radial accent wash sits behind the illustration so even emptiness has depth. Empty search results additionally suggest a few near-match items as tappable chips.

### Error States

- **Module-level** (a widget failed): the module keeps its header; the body shows a warning icon, a strong title ("Couldn't load market data"), an optional cause line, and a Retry button. Failures are contained to the module — never full-page unless the shell itself cannot boot.
- **Stale data**: if a feed silently stops, the module gets a 2px amber top edge, timestamps turn amber, and a "Delayed — last update HH:MM:SS" pill appears. Staleness is always a distinct, visible state — never allowed to look like live data.
- **Full-page** (rare): centered card on canvas, illustration, plain-language title, a mono error reference code, and a primary reload action.
- Error copy always names what happened and what to do next — never a bare "Oops" or "Something went wrong."

---

# Dashboard

A 12-column modular grid of cards, always showing at least one live element per module (tape, sparkline, timestamp) so the surface never feels static.

```
┌──────────┬──────────────────────────────────────┬─────────────────┐
│          │  PORTFOLIO PULSE (hero)               │ WATCHLIST DOCK  │
│ SIDEBAR  │  net value · delta · full-bleed chart │ (ticker rows)   │
│          ├────────────┬────────────┬────────────┤                 │
│          │ metric card│ metric card│ AI briefing│                 │
│          ├────────────┴────────────┴────────────┤─────────────────│
│          │ MARKET HEATMAP (sector treemap)       │ NEWS FEED       │
└──────────┴──────────────────────────────────────┴─────────────────┘
```

- **Hero module** ("Portfolio Pulse"): `display-xl` mono net value, delta line, full-bleed area chart with a breathing live edge, range pills top-right.
- Modules are drag-rearrangeable (a grip appears on header hover) with an accent drop-indicator line; layouts persist per user.
- The watchlist dock and news feed rail are compact versions of their full-page counterparts (see Component Library → Cards, Tables).

---

# Market Explorer

A three-pane research surface: filter rail (280px) · results table (fluid) · preview drawer (opens on row focus).

- Filter rail: collapsible eyebrow-grouped filters (exchange, sector, market cap, valuation, performance) using dual-range sliders with mono value readouts and pill multi-selects. Active filter counts badge each group; a sticky footer offers reset/save.
- Results table: compact density, sparkline column, header shows a live result count and a saved-screens dropdown. Saved screens also surface as pill tabs above the table.
- Focusing a row slides in a preview drawer with a mini chart, key stats, and a link to the full company page — triage without leaving the list.

---

# Company Details

```
┌ COMPANY NAME  TICKER · EXCHANGE · SECTOR ───────────── [+ Watch] [Buy] │
│ Price   Delta   After-hours   Session badge                            │
├───────────────────────────────────────────────┬────────────────────────┤
│  PRICE CHART (full bleed) + range/indicators   │  KEY STATS (mono grid) │
├───────────────┬───────────────────────────────┤  incl. 52-week slider  │
│ Overview      │ Financials  News  Filings  AI │                        │
├───────────────┴───────────────────────────────┴────────────────────────┤
│  ABOUT (editorial serif)          │  FINANCIALS WIDGETS                │
└───────────────────────────────────┴─────────────────────────────────────┘
```

- **Identity bar**: hairline-framed logo tile, company name, ticker + exchange/sector chips, price block in `data-lg` with the session badge.
- **Tab row** (Overview · Financials · News · Filings · Options · AI Analysis): ghost tabs with the Ledger Line marking the active tab; sticky below the identity bar on scroll.
- **Key stats rail**: two-column mono grid; the 52-week range renders as a micro slider with a position dot — data as instrument, not text.
- **Financials tab**: statement tables with year-over-year delta columns, expandable line items, a mono "as reported / adjusted" toggle.
- The "About" section is the one place the editorial serif typeface appears at body size — everywhere else on this page is interface or data type.

---

# Charts

- Charts render directly on the module surface — no inner border, no inner padding; the plot bleeds to the card edges with axes floating inside.
- Gridlines: dotted hairlines at 40% of the standard hairline token — visible when sought, invisible when reading the line.
- Price line: 1.5px, accent color for the primary series. Session delta coloring (tinting the line by up/down vs. previous close) is an opt-in toggle, off by default.
- Area fill: vertical gradient from 14% series color to 0% at the baseline — the only chart gradient permitted.
- Candles: hollow-body optional; default solid at the *deep* market colors so a full-screen candle chart stays calm.
- Live edge: the last price point carries a breathing dot and a price-tag chip on the axis; the Ledger Line runs as a horizontal hairline at the last price across the plot.
- Crosshair: 1px dashed on both axes, tagged in mono chips, snaps to the nearest candle.
- Volume: a dedicated sub-pane, bars at 25% opacity market colors, divided from the price pane by a hairline.
- Comparison mode: additional series drawn from the categorical ramp, normalized to % change, with a floating draggable glass legend.
- Axis type: small mono labels, tertiary ink; date-axis labels thin responsively rather than rotating — **rotated axis labels are banned**.
- Range selector: a ghost pill group (`1D · 5D · 1M · 6M · YTD · 1Y · 5Y · MAX`); the active pill fills with the raised-surface color. A custom range opens a dual-calendar popover.
- Sector heatmaps use the diverging ramp with opacity-mapped magnitude, `micro` auto-contrast tile labels, hairline gaps between tiles.

---

# GSAP Motion Principles

Motion is a data channel first, a courtesy second, and never a show.

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Price change: numeral crossfades; cell background flashes to 8% market-color tint and decays over 800ms |
| Micro-interactions | 120–160ms, ease-out | Hover, press, toggle |
| Surface transitions | 200–280ms, `cubic-bezier(0.32, 0.72, 0, 1)` | Modals scale from 0.98, drawers slide, dropdowns fade + 4px rise |
| Ledger Line draw-in | 400ms, ease-in-out | Section header underline on load, active-module edge |
| Ambient | 2–4s loops | Skeleton shimmer, live-dot breathing (60→100% opacity), streaming-chart edge pulse |

**Rules:** nothing bounces, nothing overshoots, nothing rotates. `prefers-reduced-motion` collapses all of the above to simple opacity fades and disables ambient loops entirely. The price-flash is the only motion permitted to recur without direct user input more than once per second.

---

# Accessibility

- All text meets ≥4.5:1 contrast on its surface; market colors are verified at AA on every elevation level, in both themes.
- Direction is never encoded by color alone — a signed numeral and a direction glyph always accompany it.
- Full keyboard model: command palette, row navigation in tables, chart focus shortcut, and a visible focus ring (`glow-accent`) on every interactive element.
- `prefers-reduced-motion` is honored everywhere motion is specified.
- Density and font-size preferences persist per user.
- Live regions announce order fills and alerts to screen readers, throttled to a maximum of one announcement per three seconds per module.

---

# Responsiveness

This specification is written desktop-first for trading-desk contexts — content max-width is intentionally unbounded on large displays rather than centered/capped as in a marketing site. The two concessions this spec makes for narrower viewports:

- The sidebar collapses to a 64px icon rail (tooltips replace labels; the active accent bar remains).
- Density modes (Comfortable/Compact) let a user trade information density for vertical space rather than the layout doing so automatically.

Mobile/tablet breakpoints are not yet defined by this spec and should be scoped as a deliberate follow-up rather than inferred from the desktop rules above.

---

# Performance Rules

- Skeletons are skipped entirely for anything that resolves in under 300ms, to avoid flicker.
- The ambient canvas mesh is static (non-scrolling, non-animating) and capped at ≤6% color opacity — deliberately cheap to render continuously.
- Screen-reader live-region announcements are throttled to one per three seconds per module.
- Charts and tables bleed to their container edges with no padding that changes on data update — data updates must not trigger layout reflow.
- Outside the explicitly-listed ambient/live elements (§ GSAP Motion Principles), nothing animates continuously — motion is event-driven, not decorative.

---

# Interaction Rules

- **Keyboard model**: `⌘K`/`Ctrl+K` opens the command palette; arrow keys navigate results, Tab cycles result groups, Enter opens, `⌘Enter` opens in split view. Tables support row navigation and a chart-focus shortcut.
- **Hover reveals**: module header actions (expand/settings/more), table row action affordances, input stepper controls, and drag grips all appear on hover rather than sitting permanently visible.
- **Drag-and-drop**: dashboard modules reorder via a header grip with an accent drop-indicator line; watchlist rows reorder via a row-level grip.
- **Context menus**: right-click / `⋯` menus on rows and modules for secondary actions (alerts, notes, remove).
- **Selection model**: selected table rows get a 2px accent left edge plus a filled background; a checkbox appears in a dedicated gutter on hover only.
- **Tooltips** delay 150ms before appearing; **toasts** auto-dismiss at 5 seconds and stack to a maximum of 3, older ones compressing upward.
- **Notification badges** are a dot only — raw counts are never shown.
- **Price-flash** updates are the only motion allowed to fire more than once per second without user input.

---

# Do's

- Use tabular, monospaced, decimal-aligned figures for every number that can sit vertically adjacent to another number.
- Pair every color-coded direction with a signed numeral and a direction glyph.
- Keep a single accent color for all brand and interactive chrome.
- Reserve green/red exclusively for market direction.
- Use the Ledger Line as the interface's only glow-adjacent accent treatment.
- Give every card a hairline edge and a subtle top-light gradient.
- Keep glass rare, reserved for the five allowlisted overlay surfaces.
- Design every empty state as an invitation with a clear next action.
- Contain errors at the module level; keep the rest of the app usable.
- Treat stale data as a first-class, clearly flagged state.
- Keep skeletons shape- and dimension-accurate to the real layout.
- Label AI-generated content clearly and make every claim traceable to a source.
- Persist user preferences — density, theme, layout — across sessions.
- Keep motion brief, purposeful, and non-repeating, except for the explicitly defined ambient/live elements.

---

# Don'ts

- No neon effects, and no glow beyond the defined focus ring.
- No purple-to-cyan or otherwise decorative gradients.
- No 3D coins, confetti, or celebratory effects on trades.
- No pure black (`#000`) or pure white (`#FFF`) anywhere.
- No saturated consumer-green "success" UI — success uses the accent color, never market green.
- No border radius above 14px.
- No zebra-striped tables.
- No rotated axis labels.
- No charts boxed in padding — the plot must bleed to the card edge.
- No unlabeled AI-generated content.
- No stale data presented as if it were live.
- No empty gray rectangles — every void is a skeleton, an invitation, or a contained error with a way forward.
- No color-only encoding of direction.
- No more than two nested background steps.
- No glass on resting cards, sidebars, or buttons.
- No bouncing, overshooting, or rotating motion.

---
name: stock-sim-institutional
description: >
  Institutional-grade frontend skill for stock market simulation.
  Bloomberg/Citadel-level design — custom Canvas chart engine,
  data-dense dark theme, monospace financial typography, virtual-scrolling
  data grid, zero AI slop. Built for Next.js 15 + Tailwind 4 + shadcn/ui.
agents:
  - Claude Code
  - Cursor
  - Codex
  - Windsurf
---

# Stock Sim — Institutional Frontend Skill

You are building the frontend for a **fictional stock market simulation** with a
realistic financial-engine backend (FastAPI, Postgres, NumPy-based OHLC
generation, PEG-based valuation, Kyle-lambda market impact). 150 companies
across 15 industries, 23 API endpoints, simulated economic cycles.

**This is not a demo.** This is a **trading terminal** for a simulated market.
Every pixel must communicate seriousness, density, and data authority. Users
should feel like they are sitting at a Bloomberg Terminal or a Citadel desk,
not playing a mobile game.

The entire charting system is **custom-built on Canvas/SVG** — no Recharts,
no Lightweight-Charts, no third-party chart libraries. We own every pixel.

---

## 0. Design Read (Mandatory — do before generating any code)

Read the brief, then declare your design direction before writing a single
component. Write a short block at the top of your response:

```
Design Read:
  Audience: power users, simulated traders, finance-savvy students
  Vibe: institutional, data-dense, serious, fast
  Density: high (information-dense trading terminal)
  Motion: minimal, purposeful (data updates, no decoration)
  Key constraint: dark theme, custom Canvas charts, monospace numbers,
    green/red throughout, no third-party chart libs
  Surface class: [TERMINAL | MARKETING] — declare per page before coding
    TERMINAL → Sections 2, 9, 11, 12 apply at full strictness, zero exceptions
    MARKETING → full Awwwards license: hero motion, scroll narrative,
      WebGL/Three.js, signature typography moments allowed
```

Every page must be tagged one or the other before a single component is written.
`/market`, `/companies/[ticker]`, `/portfolio`, `/simulation`, `/leaderboard`,
`/news` = TERMINAL. `/`, `/login`, `/register`, `/about`, `/pricing` = MARKETING.
This one tag prevents the single most common failure mode: a beautiful animated
hero bleeding into the order book, or a terminal grid trying to have a hero section.

If the brief is ambiguous, ask exactly one clarifying question. Never default
to AI-purple, centered-hero, or "modern SaaS" aesthetics.

---

## 1. Design Tokens (use these — never invent your own palette)

### Colors

```css
/* Dark theme — the only theme */
--bg-primary: #0a0a0b;       /* main background */
--bg-secondary: #121214;     /* card/surface background */
--bg-tertiary: #1a1a1e;     /* elevated surfaces, hover states */
--bg-hover: #222226;         /* row hover, interactive hover */
--border: #2a2a2e;          /* borders, dividers, grid lines */
--border-light: #333338;     /* subtle borders */

/* Text */
--text-primary: #e8e8ea;    /* primary text */
--text-secondary: #98989e;  /* secondary/label text */
--text-tertiary: #5c5c62;   /* placeholder, disabled, meta */
--text-link: #4a9eff;       /* links, interactive */

/* Financial semantics (non-negotiable) */
--positive: #22c55e;        /* green: up, gain, buy */
--negative: #ef4444;        /* red: down, loss, sell */
--neutral: #6b7280;         /* unchanged, flat */
--positive-dim: #166534;    /* bg for positive badges */
--negative-dim: #7f1d1d;    /* bg for negative badges */

/* Accent (use sparingly) */
--accent: #3b82f6;          /* blue: selection, active, focus */
--accent-dim: #1e3a5f;      /* bg for accent badges */
--warning: #f59e0b;         /* amber: warnings, alerts */

/* Chart-specific */
--chart-grid: #1e1e22;      /* chart grid lines */
--chart-crosshair: #ffffff22; /* crosshair overlay */
--chart-volume: #3b82f620;  /* volume bar fill */
--chart-volume-up: #22c55e20;
--chart-volume-down: #ef444420;
```

### Typography

```css
--font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, sans-serif;

--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'IBM Plex Mono',
  'Cascadia Code', 'Consolas', monospace;
```

- Every number in a data/price context uses `--font-mono`. Period.
- Table cells with numbers: monospace, right-aligned, tabular-nums.
- No Inter for body text or data. JetBrains Mono for all numerical data.
- No italic headers anywhere.
- Minimum: 11px for dense data, 13px body, 15px headings.

### Font Size Scale

```css
--fs-micro: 0.6875rem;    /* 11px — dense table cells, timestamps */
--fs-small: 0.75rem;      /* 12px — secondary labels */
--fs-body: 0.8125rem;     /* 13px — body text, table content */
--fs-base: 0.875rem;      /* 14px — default UI text */
--fs-header: 0.9375rem;   /* 15px — section headers */
--fs-h3: 1.125rem;        /* 18px — card titles */
--fs-h2: 1.375rem;        /* 22px — page titles */
--fs-h1: 1.75rem;         /* 28px — hero numbers (portfolio value) */
```

### Spacing (dense — trading terminal)

```css
--space-1: 2px;
--space-2: 4px;
--space-3: 8px;
--space-4: 12px;
--space-5: 16px;
--space-6: 20px;
--space-7: 24px;
--space-8: 32px;
--space-9: 40px;
--space-10: 48px;
```

### Border Radius

```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-full: 9999px;
```

**No rounded corners larger than 8px.** Financial UI is sharp.

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.6);
```

---

### Marketing tokens — TERMINAL surfaces never import these

```css
--mkt-bg-void: #030304;          /* near-black, deeper than terminal bg */
--mkt-bg-elevated: #0d0d10;
--mkt-text-hero: #f4f4f6;
--mkt-text-muted: #7a7a82;

/* Signature accent — distinct from terminal's functional blue.
   Used ONLY in marketing hero typography, cursor trails,
   and the landing chart animation. Never in TERMINAL surfaces. */
--mkt-signature: #d4ff3f;        /* acid/lime — "quant," not "fintech-blue" */
--mkt-signature-dim: #8fae2a;
--mkt-signature-glow: #d4ff3f33;

/* Marketing gets exactly ONE gradient, used once, on the hero
   background mesh only — never on cards, buttons, or text */
--mkt-mesh-1: #0a0e14;
--mkt-mesh-2: #10151d;
--mkt-mesh-accent: #d4ff3f0d;    /* 5% opacity lime wash */

/* Marketing type scale — larger and looser than terminal */
--mkt-fs-display: clamp(3rem, 8vw, 7rem);   /* hero headline */
--mkt-fs-subhead: clamp(1.125rem, 2vw, 1.5rem);
--mkt-tracking-display: -0.03em;
```

**Rule:** acid-lime never appears in a TERMINAL surface. It exists so the marketing site has a visual signature distinct from every other fintech landing page's blue-on-navy, without touching the terminal's strict green=up/red=down semantics. If a component ever needs both palettes in the same file, that's a sign the page wasn't tagged correctly in Section 0 — split the file.

---

## 2. Anti-Slop Rules (Hard Bans)

### Banned aesthetics (never use)
- Purple / indigo gradients as backgrounds or brand colors.
- Glassmorphism (frosted glass, backdrop-blur).
- Neon glow effects.
- 3D illustrations of rockets, moons, graphs, or abstract shapes.
- Large hero images or full-screen headers.
- Emoji as icons in data contexts. Use lucide-react or Radix icons exclusively.
- "Modern SaaS" landing page structure: hero → features → pricing → CTA.
- Animated particle backgrounds, floating orbs, or "ambient" effects.
- **Gradient backgrounds on cards or panels.** Everything flat.
- **Avatar/profile photos** — we have no user photos. Use initials in a rounded div.
- **Gauge/radial charts** — they waste space. Use numbers or bar charts.
- **Pie/donut charts with more than 5 slices** — group small slices into "Other."
- **3D chart effects** — extruded bars, perspective, shadows on data.

### Banned typography
- Inter as the only font.
- Italic headers ever.
- All-caps for anything other than ticker symbols.
- Font weights below 400 in body text.
- **Letter-spacing increases for headers** — not a fashion magazine.
- **Serif fonts anywhere** — this is a trading terminal, not a newspaper.

### Banned layout patterns
- Three equal feature cards in a row.
- Centered everything — financial UIs are left-aligned and dense.
- Content max-width narrower than 90vw on 1440px+ screens.
- Mobile-only thinking — desktop first.
- Sticky headers that take 80px+ — 48px max.
- **Hamburger menu on desktop** — nav items visible.
- **Full-screen onboarding modals** — not an app store game.
- **Scroll-triggered reveals or parallax** — zero motion on scroll.

### Banned content
- "Revolutionary," "game-changing," "unlock," "seamless," "elevate," "dive into."
- "John Doe," "Jane Smith," "Acme Corp."
- Fake metrics you invented ("99.9% uptime," "10K+ traders").
- Placeholder charts or fake data visualizations.
- **Powered by / built with / made using** badges in the UI.
- **Copyright / trademark symbols** in the main view (footer only).

### Banned interaction patterns
- Auto-playing carousels.
- Toast notifications that don't auto-dismiss (4s max).
- Skeleton loaders that jump/reflow — fixed dimensions.
- Infinite scroll for tables over 50 rows — paginate.
- **Hover tooltips that block click targets** — tooltips offset away from cursor.
- **Right-click context menus** without browser-default fallback.
- **Drag-and-drop** unless it adds real value (it probably doesn't).
- **Confetti, celebrations, or success animations** on trades — this is a terminal.

### Marketing anti-slop (still hard bans, different target)
- No stock-photo hero images of "diverse people looking at laptops."
- No generic 3-word value prop + rotating word ("Trade Smarter / Faster / Better").
- No testimonial carousel with fake avatars.
- No "as seen in" logo strip unless the logos are real.
- No countdown timers, fake scarcity, or "X people viewing this."
- No auto-playing background video of stock tickers scrolling (our live Canvas hero in Section 2 replaces this).
- Motion must be tied to scroll position, cursor, or real data — never decorative looping animation with no input source.

**The one Awwwards moment worth building:** a full-viewport WebGL/Canvas hero where the simulation's actual live market data (150 companies, real OHLC generator) drives a generative visual — not a stock hero image, not an abstract particle field, but literally your own fictional market's price action rendered as art.

```
components/marketing/HeroMarketPulse.tsx

Renders: full-viewport Canvas, one animated line per sector (15 lines),
  each line is that sector's real average price history for the sim,
  rendered as a flowing, glowing ribbon (bezier-smoothed, not raw candles).
  Lines drift vertically on scroll (parallax by sector volatility —
  higher volatility sectors have more vertical motion).
  On cursor move: nearest line brightens, shows sector name + return% label.
  Colors: --mkt-signature for the sector under cursor, --mkt-text-muted
  for all others (single accent discipline — never full rainbow).
  Background: single radial gradient using --mkt-mesh-accent, 5% opacity,
  centered on cursor position (recalculated via requestAnimationFrame,
  not on every mousemove event — throttle to rAF).
```

---

## 3. Custom Chart Engine (Core)

We build every chart from scratch using HTML5 Canvas. No Recharts, no
Lightweight-Charts, no Chart.js, no D3 (for rendering). This is non-negotiable.

### Architecture

```
lib/charts/
├── core/
│   ├── ChartSurface.ts        # Canvas wrapper (DPI-aware, ResizeObserver)
│   ├── Axis.ts                # Time (bottom) + Price (right) axes
│   ├── Grid.ts                # Horizontal + vertical grid lines
│   ├── Crosshair.ts           # Crosshair + tooltip overlay
│   ├── Viewport.ts            # Zoom/pan state, visible range calc
│   └── utils.ts               # Price/date formatting, scaling, clamping
├── series/
│   ├── CandlestickSeries.ts   # OHLC candle rendering
│   ├── LineSeries.ts          # Smooth line (portfolio value, IV overlay)
│   ├── VolumeSeries.ts        # Volume bars at bottom
│   ├── BarSeries.ts           # Horizontal/vertical bars (drivers)
│   └── AreaSeries.ts          # Filled area (performance vs index)
├── indicators/
│   ├── SMA.ts                 # Simple moving average overlay
│   ├── EMA.ts                 # Exponential moving average
│   ├── Bollinger.ts           # Bollinger bands
│   └── RSI.ts                 # RSI indicator panel
├── interactive/
│   ├── ZoomBehavior.ts        # Wheel zoom + pinch
│   ├── PanBehavior.ts         # Click-drag pan
│   └── TimeframeSelector.ts   # 1M, 3M, 6M, 1Y, All buttons
├── composables/
│   ├── PriceChart.tsx          # Full stock chart (candles + volume + indicators)
│   ├── MiniChart.tsx           # Small sparkline for table rows
│   ├── DepthChart.tsx          # Order book depth visualization
│   ├── AllocationChart.tsx     # Portfolio sector allocation
│   ├── PerformanceChart.tsx    # Portfolio value vs market index
│   └── DriverChart.tsx         # Horizontal bar chart for price drivers
└── types.ts                    # Shared types (OHLC, Series, Theme, etc.)
```

### ChartSurface (base component)

```typescript
interface ChartSurfaceProps {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  children: React.ReactNode;  // series layers rendered in order
  onCrosshairMove?: (value: { price: number; time: number }) => void;
  onZoomChange?: (range: { from: number; to: number }) => void;
}
```

- DPI-aware: `canvas.width = rect.width * devicePixelRatio`, same for height.
- `scale(factor)` call on context before any drawing.
- Owns the animation frame loop via `requestAnimationFrame`.
- Only re-renders when data or viewport changes (dirty flag pattern).
- ResizeObserver on parent div — debounced at 100ms.
- Children receive a `ctx` render context object, not the raw Canvas context.

### CandlestickSeries

```typescript
interface CandlestickProps {
  data: OHLC[];
  visibleRange: { from: number; to: number };
  candleWidth: number;        // computed: chartWidth / visibleCandles
  upColor?: string;           // default: --positive
  downColor?: string;         // default: --negative
  wickWidth?: number;         // default: 1
}
```

Rendering algorithm:
1. Clamp data to visible range (binary search on timestamps).
2. Compute `candleWidth` = availableWidth / visibleCount. Cap at 12px max.
3. For each candle:
   - Draw wick: vertical line from low to high.
   - Draw body: filled rect from open to close.
   - Body width = `candleWidth * 0.8` (leave gap between candles).
   - Up candle: body fill = `upColor`, wick = `upColor`.
   - Down candle: body fill = `downColor`, wick = `downColor`.
   - If open === close: draw a horizontal dash at that price.
4. Performance: batch path operations, minimize `ctx.beginPath()` calls.
5. When candleWidth < 3px: switch to "area" mode (line chart style).

### LineSeries / AreaSeries

```typescript
interface LineSeriesProps {
  data: { time: number; value: number }[];
  color?: string;
  width?: number;            // default: 1.5
  dashed?: [number, number]; // dash pattern
  fill?: string;             // area fill (for AreaSeries)
}
```

- Uses `monotone-x` curve interpolation (like D3's curveMonotoneX).
- First: filter visible points. Second: build path.
- AreaSeries fills below the line to `baseY` (y-axis zero or min).
- Gradient fill: top = color at 30% opacity, bottom = transparent.

### VolumeSeries

```typescript
interface VolumeSeriesProps {
  data: { time: number; volume: number; close: number }[];
  barWidth?: number;          // computed same as candleWidth
  upColor?: string;
  downColor?: string;
}
```

- Rendered in a separate panel below candles (60px height).
- Each bar: thin rect, colored by close direction relative to previous close.
- Semi-transparent fill (opacity 0.4).

### Crosshair

```typescript
interface CrosshairProps {
  snapToData?: boolean;  // snap to nearest OHLC point
  showX?: boolean;       // vertical line
  showY?: boolean;       // horizontal line
}
```

- Vertical + horizontal hairline across the full chart surface.
- Tooltip box at top-right of crosshair intersection showing:
  - Time (formatted), Open, High, Low, Close, Volume.
- Crosshair lines: `--chart-crosshair` color, dashed.
- Tooltip box: `--bg-secondary` with `--border` border, monospace text.
- On touch devices: long-press activates crosshair, drag to move.

### ZoomBehavior / PanBehavior

- **Zoom:** Wheel scroll = zoom in/out centered on cursor position.
  - `deltaY > 0` (scroll down) = zoom out (widen visible range).
  - `deltaY < 0` (scroll up) = zoom in (narrow visible range).
  - Zoom factor: 1.1x per notch. Clamp to min 10 candles, max all data.
- **Pan:** Click-drag on chart area = pan visible range.
  - Drag right = pan left (see older data).
  - Drag left = pan right (see newer data).
- **Touch:** Pinch-to-zoom and single-finger-pan.
- **Reset:** Double-click restores default viewport.

### MiniChart (sparkline in table rows)

```typescript
interface MiniChartProps {
  data: number[];          // last N closing prices
  width: number;           // 60–80px
  height: number;          // 20–24px
  color?: string;          // --positive if last > first, else --negative
}
```

- Tiny line chart drawn on a small Canvas element.
- No axes, no labels, no grid — just the line.
- Color determined by direction: if last close > first close, green; else red.
- Line width: 1px. No fill.
- Use `willReadFrequently` canvas attribute for performance.

### DepthChart (order book visualization)

```typescript
interface DepthChartProps {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  width: number;
  height: number;
}
```

- Step-area chart: cumulative size on Y, price on X.
- Bids: green fill, stepping from left (highest bid) to right (lowest bid).
- Asks: red fill, stepping from right (lowest ask) to left (highest ask).
- Midpoint line: dashed vertical at spread midpoint.
- Tooltip on hover: price + cumulative size.

### PriceChart (composable — full stock chart)

```typescript
export function PriceChart({ data, height = 400, indicators = [] }) {
  return (
    <ChartSurface height={height} padding={{ top: 8, right: 8, bottom: 24, left: 64 }}>
      <Grid horizontal vertical />
      <CandlestickSeries data={data.candles} />
      {indicators.includes('sma20') && <SMA period={20} data={data.closes} />}
      {indicators.includes('sma50') && <SMA period={50} data={data.closes} />}
      {indicators.includes('ema12') && <EMA period={12} data={data.closes} />}
      <VolumeSeries data={data.volumes} />
      <Crosshair snapToData />
      <ZoomBehavior />
      <PanBehavior />
      <Axis position="bottom" formatter={formatDate} />
      <Axis position="right" formatter={formatPrice} />
    </ChartSurface>
  );
}
```

### 3.1 Sub-pixel rendering correctness

```typescript
// lib/charts/core/utils.ts — single biggest visual-quality lever
function alignToDevicePixel(value: number, lineWidth: number, dpr: number): number {
  const scaled = value * dpr;
  const isOdd = Math.round(lineWidth * dpr) % 2 === 1;
  return isOdd ? Math.floor(scaled) + 0.5 : Math.round(scaled);
}
```

Apply this to every grid line, axis line, and 1px series line. This one function is worth more to "does this look like Bloomberg or a tutorial" than almost anything else.

### 3.2 Multi-resolution data (LOD — level of detail)

```
lib/charts/core/LODManager.ts

Given raw 1-minute OHLC data, pre-compute and cache:
  - 5m, 15m, 1H, 4H, 1D, 1W aggregated candles (open=first, high=max,
    low=min, close=last, volume=sum)
  - Store as Map<timeframe, OHLC[]>, computed once on data load
  - Viewport picks the coarsest resolution where visible candles
    stays under ~500 (beyond that, render is slow and visually
    indistinguishable from noise)
  - Cross-fade opacity over 150ms when the active resolution changes
    so switching timeframes on zoom doesn't visually "pop"
```

### 3.3 Volume profile / VPVR

```
components/charts/VolumeProfile.tsx

Horizontal histogram on the right edge of the chart showing volume
traded at each price level over the visible range.

Algorithm:
  1. Filter candles to visible range.
  2. Compute price range (min low, max high) across visible candles.
  3. Divide into 40 equal-height price buckets.
  4. For each candle, distribute its volume proportionally across
     the buckets its [low, high] spans.
  5. Render as horizontal bars, right-aligned, ~60% transparency.
  6. Highlight Point of Control (POC) — the bucket with max volume —
     with --accent color and a thin horizontal line across full chart width.
  7. Value Area (VA): contiguous bucket range containing 70% of total
     volume, shaded differently.
```

### 3.4 Multi-timeframe overlay ghosting

```
On crosshair hover in intraday mode: draw a single semi-transparent
(15% opacity) larger candle in the background showing what daily
candle this intraday bar belongs to. Pure craft/delight detail,
built after core chart engine is stable — stretch goal, not blocking.
```

---

## 4. Data Grid System (Virtual Scrolling)

We build a custom virtual-scrolling data grid. No AG Grid, no TanStack Table,
no react-virtual. We own every row.

### Architecture

```
lib/grid/
├── VirtualGrid.tsx           # Core virtual-scrolling grid
├── GridColumn.tsx            # Column definition component
├── GridHeader.tsx            # Sticky header with sort indicators
├── GridRow.tsx               # Single row renderer
├── GridCell.tsx              # Cell renderer with type-aware formatting
├── GridSkeleton.tsx          # Skeleton row for loading state
├── useGridSort.ts            # Column sorting hook
├── useGridFilter.ts          # Client-side filter hook
└── types.ts                  # Grid column types, sort/filter state
```

### VirtualGrid

```typescript
interface VirtualGridProps<T> {
  data: T[];
  columns: GridColumn<T>[];
  rowHeight?: number;        // default: 36px
  overscan?: number;         // default: 5
  onRowClick?: (row: T) => void;
  sortable?: boolean;
  filterable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  pinnedColumns?: number;    // sticky columns on left
}
```

Rendering algorithm:
1. Container ref with scroll listener.
2. Compute `visibleStart = Math.floor(scrollTop / rowHeight)`.
3. Compute `visibleCount = Math.ceil(containerHeight / rowHeight) + overscan`.
4. Render only rows `[visibleStart, visibleStart + visibleCount]`.
5. Top padding div: `height: visibleStart * rowHeight`.
6. Bottom padding div: `height: (totalRows - visibleEnd) * rowHeight`.
7. Absolutely position visible rows with `transform: translateY()`.
8. On scroll update, recycle old row elements (keyed by index).

### GridColumn

```typescript
interface GridColumn<T> {
  key: string;
  header: string;
  width: number | 'auto' | 'grow';
  align?: 'left' | 'right' | 'center';
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  pin?: 'left';
  format?: 'price' | 'pct' | 'large' | 'ticker' | 'text' | 'badge' | 'date';
}
```

- `format: 'price'` → monospace, right-aligned, `$XXX.XX`.
- `format: 'pct'` → monospace, right-aligned, `+X.XX%` with color.
- `format: 'ticker'` → monospace, uppercase, bold, left-aligned.
- `format: 'badge'` → pill badge (industry, sentiment).
- `format: 'date'` → monospace, compact (`2026-07-11`).

### Column sizing rules
- Fixed columns: `width` in px.
- `'auto'` columns: sized to content on first render, cached.
- `'grow'` column: takes remaining space (usually name/description).
- At least one column must be `'grow'`.
- Min column width: 40px. Max: 400px (enforced).

### Sorting
- Click header to sort asc → click again = desc → click again = none.
- Active sort column: small arrow indicator (▲ / ▼) next to header text.
- Arrow color: `--accent`.
- Sort is client-side on the already-loaded data.
- String sort: `localeCompare`. Number sort: numeric.

### Cell value change flash
When a cell value changes on re-render (polling update):
- Briefly flash the cell background with `--accent-dim` for 300ms.
- Use a CSS `@keyframes flash` animation, applied via a `key` change or
  a `data-changed` attribute on the cell element.
- Only flash if the value actually changed (deep compare).

### Column resize + reorder (persisted)

```typescript
// lib/grid/useColumnState.ts
interface ColumnState {
  key: string;
  width: number;
  order: number;
  visible: boolean;
}
```

- Drag column border to resize (min 40px, max 400px)
- Drag column header to reorder (ghost preview during drag)
- Right-click header → "Hide column" / column visibility menu
- Persist to `localStorage` keyed by grid id: `grid-cols:${gridId}`
- Reset button restores default order/width/visibility

### Heat coloring + inline sparklines

Add optional column format: `'heatcell'`
  - Background color intensity scales with the cell's numeric value
    (e.g. Day Chg column: dim green/red wash, opacity =
    `Math.min(Math.abs(value) / capValue, 1) * 0.15`)
  - Present in literally every real trading grid (Bloomberg FLDS,
    TradingView screener, Koyfin) and absent from almost every
    generic admin dashboard — cheap to build, instantly recognizable.

MiniChart column: wire as first-class grid column format `'sparkline'`
  so it's not bolted on — render inline in the grid row, 60x20px,
  no axes, colored by direction.

---

## 5. Complete Component Specs

### 5.1 PriceChart (chart component)

```
File: components/charts/PriceChart.tsx

Props:
  ticker: string                    # for API call + header
  timelineId?: number
  height?: number                   # default: 400
  showIndicators?: boolean          # toggle SMA/EMA overlay
  timeframe?: '1M' | '3M' | '6M' | '1Y' | 'ALL'

State handling:
  Loading:  CandlestickSeries placeholder skeleton
            (gray rects where candles would be, 8px tall, repeated)
  Empty:    "No trading data yet for {ticker}."
  Error:    "Could not load price history." + retry button
  Edge:     Only 1 data point → show a horizontal line at that price
  Edge:     All same price → show flat line with note "No movement"
```

### 5.2 MarketGrid (data grid)

```
File: components/market/MarketGrid.tsx

Props:
  timelineId?: number

Columns:
  Ticker    | 80px  | format: ticker, sortable, pinned left
  Name      | grow  | format: text, sortable
  Industry  | 100px | format: badge, sortable, filterable
  Price     | 100px | format: price, sortable, right-aligned
  Day Chg   | 90px  | format: pct, sortable, green/red
  IV Gap %  | 80px  | format: pct, sortable
  Mcap      | 90px  | format: large, sortable
  Volatility| 80px  | format: pct, sortable

Search bar above grid:
  - Debounced 200ms input
  - Filters by ticker (exact prefix) OR name (case-insensitive includes)
  - Clear button when active
  - "Showing {N} of 150 results" when filtered

Row click → router.push(`/companies/${ticker}`)

Data: useMarketGrid(timelineId) polling every 5s
State:
  Loading:  VirtualGrid with skeleton rows (15 rows)
  Empty:    "No companies loaded. Run seed data first."
  Error:    "Could not load market data." + retry
```

### 5.3 CompanyHeader

```
File: components/companies/CompanyHeader.tsx

Displays:
  [Ticker] — monospace 24px bold
  [Company Name] — 16px normal, text-secondary
  [Industry Badge] — pill badge
  [Current Price] — monospace 24px bold
  [Day Change %] — monospace 16px, green/red with arrow icon
  [IV Gap %] — small secondary

Layout: horizontal row, items spaced, compact (48px height)
```

### 5.4 DriverChart (horizontal bar chart)

```
File: components/charts/DriverChart.tsx

Props:
  drivers: { name: string; score: number; weight: number }[]

Renders 7 horizontal bars (one per price driver):
  - Bar: filled rect, width proportional to score/100
  - Color: gradient from --negative (score=0) to --positive (score=100)
    via a simple lerp: r = score/100 * g + (1-score/100) * r mix
  - Label: driver name on left, score value on right (mono)
  - Weight indicator: thin bar behind — reads as "capacity" (battery/progress
    track) using a subtly lighter shade of --bg-tertiary, not a second colored bar
  - Bar height: 16px, gap: 4px
  - Bars animate width on data change (not on mount) — 400ms ease-out,
    animated via transform: scaleX() (transform-origin: left), not CSS width
    (CSS transition on width causes layout thrash on Canvas-adjacent elements)
  - On hover: tooltip with driver's underlying calculation string
    ("Momentum: 30d price trend, weighted 15% of composite score")
    — pulls copy from a static driver-definitions map, not hardcoded per instance

State:
  Empty:  "No driver data available."
```

### 5.5 ValuationCard

```
File: components/companies/ValuationCard.tsx

Displays in a compact card:
  Intrinsic Score     | [0–100] bar + number
  Fair PE             | mono number
  Fair PEG            | mono number
  MOAT Score          | [0–100] mini bar
  Management Quality  | [0–100] mini bar
  FCF Quality         | [0–100] mini bar
  Growth Potential    | [0–100] mini bar

Each score bar: 4px tall, full width of label area, colored by value.
  - 0–33:   --negative
  - 34–66:  --warning
  - 67–100: --positive

State:
  Loading:  skeleton text lines
  Empty:    "Valuation data not available."
```

### 5.6 OrderForm

```
File: components/trading/OrderForm.tsx

Props:
  ticker: string
  currentPrice: number
  cashBalance: number
  onOrderPlaced?: () => void

Elements:
  1. Buy / Sell toggle pill (green/red)
  2. Order type dropdown: Market | Limit (stretch)
  3. Quantity input with +/- stepper buttons
     - Min: 1, Max: floor(cashBalance / price) for buy
     - Step: 1
  4. Quick-select percentage buttons for sell: [25%] [50%] [75%] [Max]
     — computed from current holdings, one tap to set quantity
  5. Real-time slippage/impact visualization: as quantity changes,
     show a small horizontal bar where the estimated fill price sits
     relative to the current bid/ask spread (mini DepthChart, ~120px wide)
  6. Estimated execution price display:
     - Market price + Kyle-lambda impact = final price
     - Show impact cost as separate line: "Impact: $0.XX"
  7. Total cost: quantity × estimated price (mono, large)
  8. Submit button:
     - Buy mode: green background
     - Sell mode: red background
     - Text: "Buy {N} {TICKER}" / "Sell {N} {TICKER}"
     - Disabled when: quantity = 0, insufficient funds (buy),
       no shares held (sell), market closed

Behavior:
  - Disable on click — prevent double-submit
  - Show loading spinner in button during submission
  - Order confirmation: slide-up micro-interaction (150ms, translateY + opacity)
    showing a receipt-style summary before final submit — NOT a blocking modal,
    an inline expansion within the form itself
  - On success: brief 200ms scale-pulse (1 → 1.05 → 1) on the total cost number
    — closest thing to "celebration" in a TERMINAL surface: data confirmation,
    not a party
  - On error: inline error message below the button
  - Reset quantity to 0 after successful order
  - Call onOrderPlaced() → triggers portfolio refetch

Edge cases:
  - Insufficient cash: "Need ${shortfall} more. Cash: ${balance}"
  - No shares to sell: "You don't hold any {TICKER}"
  - Market closed: disable entirely, "Market is closed"
  - Max quantity exceeded: clamp to max, show "Max: {N}"
```

### 5.7 HoldingsTable

```
File: components/portfolio/HoldingsTable.tsx

Columns:
  Ticker          | 80px  | format: ticker, pinned left
  Name            | grow  | format: text
  Qty             | 60px  | format: text, mono, right
  Avg Cost        | 90px  | format: price, mono, right
  Current Price   | 90px  | format: price, mono, right
  Market Value    | 90px  | format: large, mono, right
  Unrealized PnL  | 100px | format: price, mono, right, green/red
  PnL %           | 80px  | format: pct, mono, right, green/red
  Day Change      | 80px  | format: pct, mono, right, green/red

Row click → router.push(`/companies/${ticker}`)

State:
  Loading:  skeleton rows
  Empty:    "No holdings yet." + link to /market
```

### 5.8 AllocationDonut (custom Canvas donut)

```
File: components/charts/AllocationChart.tsx

Props:
  data: { label: string; value: number; color: string }[]

Renders a donut chart on Canvas:
  - Outer radius: 80px
  - Inner radius: 50px (donut hole)
  - Segments: arc paths with stroke/lineWidth
  - Center text: "Total" + formatted value (mono, bold)
  - Legend below or to the right: colored square + label + "%"
  - Max 5 segments. Group smaller into "Other" (gray).
  - On hover over a segment: that segment scales outward slightly
    (translate along its radial angle, 4px, 150ms) and all other
    segments dim to 40% opacity — a very common "focus" interaction
    in real analytics tools (Amplitude, Linear) that reads as
    expensive craft for cheap effort.
  - Center text transitions between "Total" and the hovered segment's
    label/value on hover, reverting on mouse leave — no layout shift,
    just a 100ms crossfade of the text content.

If data is empty: draw an empty donut (full circle in --border color)
  + "No holdings" centered.

State:
  Loading:  circle skeleton (border-radius: 50% pulse)
  Empty:    empty donut + "No holdings"
```

### 5.9 PerformanceLine (custom Canvas line chart)

```
File: components/charts/PerformanceChart.tsx

Props:
  portfolioValues: { date: number; value: number }[]
  indexValues?: { date: number; value: number }[]
  height?: number     // default: 250

Renders:
  - Line for portfolio value (--positive, 2px)
  - Line for market index (--text-tertiary, 1px, dashed) if provided
  - Area fill below portfolio line (gradient to transparent)
  - Y-axis: price axis (right side)
  - X-axis: date axis (bottom)
  - Hover crosshair: vertical line + tooltip with date + both values
  - Normalize: start both at 100 (percentage return view)
  - Toggle: absolute value vs percentage return

State:
  Loading:  skeleton rect
  Empty:    "No performance data yet."
```

### 5.10 AnalyticsCards

```
File: components/portfolio/AnalyticsCards.tsx

4 compact stat cards in a row:
  Win Rate      | mono percentage   | green/red tinted bg
  Sharpe Ratio  | mono 2 decimals   | >1 = green, <0 = red
  Volatility    | mono percentage   | --text-secondary
  Best Trade    | mono price        | --positive
  Worst Trade   | mono price        | --negative (hide if no trades)

Each card: icon (lucide) + label (small, secondary) + value (large, mono)

State:
  Loading:  4 skeleton cards
  Empty:    "Trade to see analytics."
  Edge:     No trades yet → Win Rate = "N/A", Best/Worst = "N/A"
```

### 5.11 OrderBook

```
File: components/trading/OrderBook.tsx

Props:
  asks: { price: number; size: number; total: number }[]
  bids: { price: number; size: number; total: number }[]
  lastPrice: number
  maxTotal?: number   # for depth bar scaling

Layout: 3-column compact table
  [Price (mono, right)] [Size (mono, right)] [Total (mono, right)]

  Top half: asks (red text, highest price at top, descending)
  Middle:   last price row (highlighted, --accent bg)
  Bottom half: bids (green text, highest bid at top, descending)

  Depth bars: semi-transparent colored bar behind each row
    width = (total / maxTotal) * 100%
    asks bar: --negative-dim, right-aligned
    bids bar: --positive-dim, left-aligned

  Hover: slight bg highlight on row

State:
  Loading:  skeleton rows
  Empty:    "No order book data."
  Edge:     Single row per side → still render correctly
```

### 5.12 NewsFeed / NewsCard

```
File: components/news/NewsFeed.tsx
       components/news/NewsCard.tsx

NewsFeed props:
  timelineId?: number
  companyId?: number     # for company-specific news
  simDate?: string

Layout: left 70% feed, right 30% filter sidebar

NewsCard renders:
  [Date] — mono small, text-tertiary
  [Headline] — bold, 14px
  [Sentiment Badge] — positive/green, negative/red, neutral/gray
  [Severity] — small badge (Low/Med/High/Critical)
  [Company/Industry Tag] — clickable pill
  [Snippet] — 2 lines of body text, text-secondary

Filter sidebar:
  Date range | Company search/select | Sentiment toggles | Severity slider
  "Clear filters" link when any filter active

Pagination: "Load More" button at bottom or infinite scroll

State:
  Loading:  5 skeleton cards
  Empty:    "No news yet. Advance the simulation."
  Error:    "Could not load news." + retry
  Edge:     No filters matched → "No news matching your filters."
```

### 5.13 LeaderboardTable

```
File: components/leaderboard/LeaderboardTable.tsx

Columns:
  Rank      | 60px  | format: text, bold for top 3
  Username  | grow  | format: text
  Value     | 120px | format: large, mono, right
  Return %  | 100px | format: pct, mono, right, green/red
  Trades    | 70px  | format: text, mono, right

Top 3 ranks: trophy icon + gold/silver/bronze accent color
Current user row: --accent-dim background

Pagination: "Showing 1–25 of N" + Prev/Next

State:
  Loading:  25 skeleton rows
  Empty:    "No players yet. Be the first to trade!"
```

### 5.14 SimControlPanel / TimelineBranch / CycleIndicator

```
File: components/simulation/SimControlPanel.tsx

Displays:
  Current date: "July 11, 2026 (Tick #142)" — mono, large
  Cycle phase badge: Expansion / Peak / Contraction / Trough
  Economic phase description: one-liner
  Buttons: [1 Day] [5 Days] [30 Days]
    - Each button shows countdown spinner during advance
    - Disabled when another advance is in progress

State:
  Loading:  "Advancing..." + spinner
  Error:    "Advance failed: {reason}" + retry
  Edge:     No active timeline → "Select or create a timeline first."

File: components/simulation/TimelineBranch.tsx

  List of timelines: name, created date, tick count, fork indicator
  Active timeline: highlighted with left border accent
  "Create Branch" button → modal with name input
  Empty: "No timelines yet. Create one to start."

File: components/simulation/CycleIndicator.tsx

  Badge: phase name (colored by phase)
    Expansion   → --positive bg
    Peak        → --warning bg
    Contraction → --negative bg
    Trough      → --accent bg
  Hover tooltip: "Day {N} of {N} total | {P}% complete"
```

### 5.15 StatCard (reusable)

```
File: components/ui/StatCard.tsx

Props:
  label: string
  value: string | number
  format?: 'price' | 'pct' | 'large' | 'text'
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'

Renders a compact card:
  [Icon] [Label]         — small, text-secondary
        [Value]          — mono, large, colored by trend
  If loading: skeleton text placeholder
  Size variants:
    sm:  value 16px, label 11px
    md:  value 20px, label 12px
    lg:  value 28px, label 13px
```

### 5.16 EmptyState / ErrorState

```
File: components/ui/EmptyState.tsx
File: components/ui/ErrorState.tsx

EmptyState props:
  icon?: LucideIcon       # default: Package or Inbox
  title: string
  description?: string
  action?: { label: string; onClick: () => void }

ErrorState props:
  title?: string          # default: "Something went wrong"
  message?: string
  onRetry?: () => void
```

### 5.17 PriceTickerTape (marketing-surface only)

```
File: components/marketing/PriceTickerTape.tsx

A horizontally scrolling ticker strip (classic Bloomberg/CNBC lower-third
aesthetic) showing the sim's top 20 movers, auto-scrolling at a constant
pixel/second rate (CSS transform, not JS interval — use a duplicated
content trick so the loop is seamless, translateX from 0 to -50% of a
doubled content block).
  - Green/red per direction, monospace, ticker + price + change%
  - Pauses on hover (mouse or touch)
  - Used ONLY on the marketing landing page header — exactly the kind of
    "recognizable finance-media signature" that reads as craft on a landing
    page and would be pointless clutter inside the actual terminal
```

---

## 6. Page-Specific Data Flow

### `/market` — Market Overview

```
Data flow:
  1. useMarketGrid(timelineId) — GET /api/v1/market?timeline_id=X
     → returns 150 companies with price, change, market cap, volatility
  2. Poll every 5 seconds via refetchInterval: 5000
  3. useCycleState(timelineId) — GET /api/v1/market/cycle
     → returns cycle phase, description, day progression
  4. CycleIndicator from cycle state
  5. MarketGrid renders data with sort + filter (client-side)

On advance: invalidate both queries
```

### `/companies/[ticker]` — Company Detail

```
Data flow:
  1. useCompany(ticker, timelineId)
     → returns: name, industry, price, day change, description
  2. usePriceHistory(ticker, timelineId, from, to)
     → returns OHLC[] for chart (param-controlled by timeframe selector)
  3. useDrivers(ticker, timelineId)
     → returns 7 driver scores
  4. useFinancials(ticker)
     → returns income/balance/cashflow for latest period
  5. useValuation(ticker, timelineId)
     → returns intrinsic score, fair PE, peg, sub-scores
  6. OrderForm uses currentPrice from company data + cash from portfolio
  7. On order success: invalidate portfolio + company queries
```

### `/portfolio` — Portfolio Dashboard

```
Data flow:
  1. usePortfolio(timelineId)
     → returns holdings[] + cash + totalValue
  2. usePortfolioAnalytics(timelineId)
     → returns winRate, sharpe, volatility, bestTrade, worstTrade,
       performanceHistory[]
  3. useTransactions(timelineId, limit, offset)
     → returns paginated transactions
  4. AllocationChart from holdings sector breakdown
   5. PerformanceChart from performanceHistory
   6. HoldingsTable from holdings
```

### `/` — Marketing landing page

```
Data flow:
  1. usePublicMarketSnapshot() — GET /api/v1/market?public=true
     → lightweight, cached 60s server-side, top 20 movers only
     → powers PriceTickerTape + HeroMarketPulse sector lines
  2. No auth required, no polling (staleTime: 60000, no refetchInterval)
  3. CTA → /register, secondary CTA → /login
  4. Below-fold sections use content-visibility: auto — not rendered/
     hydrated until scrolled near (hero's WebGL/Canvas work shouldn't
     compete with lazy sections for main-thread time on load)
```

---

## 7. Data Formatting Rules

```typescript
// Prices — always 2 decimal places, $ prefix
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// Percentages — always show sign, 2 decimal places
function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Large numbers — abbreviate with B/M/K
function formatLarge(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// Compact dates in tables — YYYY-MM-DD
function formatDate(ts: number | string): string {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

// Full date in headers — "July 11, 2026"
function formatDateFull(ts: number | string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

// Tickers — always uppercase
function formatTicker(s: string): string {
  return s.toUpperCase();
}

// Marketing hero numbers — for landing page stat callouts ONLY
// Splits into huge display number + small suffix for oversized typography
// Never use for actual portfolio/price data — marketing surfaces exclusively
function formatHeroNumber(value: number): { display: string; suffix: string } {
  if (value >= 1000) return { display: (value / 1000).toFixed(1), suffix: 'K' };
  return { display: value.toString(), suffix: '' };
}
```

---

## 8. Style Overrides for shadcn/ui Primitives

```css
/* Tables: dense, with borders */
.table { font-size: var(--fs-small); }
.table th {
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: none;
  letter-spacing: normal;
  border-bottom: 1px solid var(--border);
  padding: var(--space-2) var(--space-3);
}
.table td {
  border-bottom: 1px solid var(--border);
  padding: var(--space-2) var(--space-3);
  vertical-align: middle;
}

/* Cards: flat, no shadow */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.card:hover { border-color: var(--border-light); }

/* Badges: small, compact */
.badge {
  font-size: var(--fs-micro);
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  text-transform: none;
}

/* Buttons: compact */
.button {
  height: 32px;
  font-size: var(--fs-body);
  font-weight: 500;
  border-radius: var(--radius-sm);
}

/* Inputs: dark, compact */
.input {
  height: 32px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--fs-body);
  border-radius: var(--radius-sm);
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-dim);
}

/* Dialog/Modal: dark */
.dialog-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  max-width: 480px;
}

/* Tooltip: dark, small */
.tooltip {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--fs-micro);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

/* Marketing scoped overrides — @layer so they never leak into terminal */
@layer marketing {
  .mkt-button {
    height: 56px;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-full);
    background: var(--mkt-signature);
    color: #0a0a0b;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  .mkt-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px var(--mkt-signature-glow);
  }

  .mkt-headline {
    font-size: var(--mkt-fs-display);
    letter-spacing: var(--mkt-tracking-display);
    line-height: 0.95;
    text-wrap: balance;
  }
}
```

---

## 9. Motion Philosophy

- **Minimum viable motion.** Every animation must earn its place.
- **Data updates:** flash changed cell 150ms bg pulse.
- **Page transitions:** none. Instant.
- **Hover states:** bg color change, 150ms ease. No scale, no lift.
- **Modal/dialog:** 150ms opacity + scale 0.95→1. Ease-out.
- **Skeleton shimmer:** CSS animation, 1s cycle, subtle.
- **No enter/exit animations on list items.** No staggered reveals.
- **No scroll-triggered animations.** No parallax. No typewriter.
- **Chart crosshair:** instant. No fade-in.
- **Tab switches:** instant (no slide transitions).
- **Price flash on poll update:** 300ms color pulse on changed cells only.

### MARKETING motion budget (separate from terminal)

- Hero entrance: staggered fade+translateY on headline words
  (30ms stagger per word, 400ms duration, ease-out), runs once on
  page load only, never re-triggers on scroll-back.
- Scroll-driven reveals ARE allowed here (banned in terminal):
  sections fade+translateY into view via Intersection Observer,
  one-shot per section, 500ms, no bounce/spring.
- Cursor-following elements allowed in hero only (the sector-line
  brightening in HeroMarketPulse) — never elsewhere.
- Page transition between marketing routes: 200ms crossfade,
  View Transitions API (`document.startViewTransition`) where
  supported, graceful no-op fallback otherwise.
- Hard line: motion NEVER simulates false urgency (no countdown
  timers, no "3 people just signed up" toasts). Motion sells craft,
  not manufactured scarcity.
- The instant you cross from a marketing route into the authenticated
  app shell (post-login), motion budget snaps back to TERMINAL rules
  immediately — no lingering hero-style transitions into /market.

---

## 10. Performance Guidelines

### Rendering
- All charts render on Canvas (not SVG for data series).
- Chart animations use `requestAnimationFrame`, not setTimeout.
- Dirty flag pattern: only re-render chart when data or viewport changes.
- Grid virtualizes rows (no more than visibleCount + overscan DOM nodes).
- Grid cells are plain `<div>` elements, not heavy components for every cell.
- Use `React.memo` on grid rows, chart components, and stat cards.
- Use `useMemo` for sorted/filtered data arrays.
- Avoid `useEffect` for data transformation — compute in render or memo.

### Data fetching
- React Query with `refetchInterval: 5000` for market grid.
- React Query with `staleTime: 30000` for company detail (less volatile).
- Invalidate all queries on advance success via `queryClient.invalidateQueries()`.
- Paginate history data: load only visible timeframe, not all data.
- Debounced search (200ms) for grid filtering.

### Bundle size
- Charts are lazy-loaded per page (no chart code on login page).
- Lucide icons are tree-shakable — import specific icons, not the barrel.
- shadcn/ui components are local copies, fully tree-shakable.
- No moment.js, no lodash — use native Intl + Date APIs.

### Marketing-specific performance budgets

| Metric | Budget |
|---|---|
| Marketing hero FCP | < 2.0s (relaxed vs terminal's 1.5s — WebGL/Canvas init cost acceptable) |
| Marketing hero — main thread block during init | < 100ms |
| Marketing → terminal transition (login → /market) | < 800ms |

---

## 11. State Handling Matrix

| State | Component | Visual |
|-------|-----------|--------|
| **Loading** | All | Fixed-height skeleton with shimmer. No layout shift. |
| **Empty** | Grid | Descriptive message + link to action. |
| **Empty** | Chart | "No data yet" centered text. |
| **Empty** | Portfolio | "No holdings. Start trading on the market page." + link. |
| **Empty** | Leaderboard | "No players yet. Be the first to trade!" |
| **Empty** | News | "No news yet. Advance the simulation to generate events." |
| **Error** | All | Message + retry button. |
| **Zero price** | Market grid | Show "N/A" in price column. |
| **Zero price** | Order form | Disable buy/sell. "No price available." |
| **No history** | Price chart | "No trading data yet." |
| **No financials** | Company detail | Hide financials tab entirely. |
| **No shares held** | Order form (sell) | "You don't hold any {TICKER}" |
| **Insufficient funds** | Order form (buy) | "Need ${shortfall} more. Cash: ${balance}" |
| **Rate limited** | API client | Toast: "Too many requests. Slow down." |
| **Stale data** | After advance | Invalidate all query caches. |
| **Double-click** | Order submit | Disable button immediately. Loading spinner. |
| **401** | Auth | Clear token, redirect to /login. |
| **404 company** | Company detail | "Company '{ticker}' not found" + back link. |
| **404 route** | layout | Custom 404 page with link to /market. |
| **API offline** | All | React Query retry 3x with backoff. Toast after 3 failures. |
| **prefers-reduced-motion** | All | Disable HeroMarketPulse cursor-follow and scroll reveals; show static final-state frame instead. Terminal surfaces already minimal motion, no change needed. |

---

## 12. Pre-Flight Checklist

Before handing back any page or component:

- [ ] All text is real content (no filler, no Lorem Ipsum)
- [ ] No purple/indigo gradients
- [ ] All numerical data uses monospace with tabular-nums
- [ ] All prices formatted: `$XX.XX` (2 decimals)
- [ ] All percentages show explicit sign (+ or -)
- [ ] Green = positive/up/buy, Red = negative/down/sell
- [ ] No italic headers
- [ ] No Inter for numerical data
- [ ] No three-equal-cards pattern
- [ ] No centered hero or full-screen intro
- [ ] Loading/empty/error/edge states for every data-dependent component
- [ ] Skeleton loaders have fixed dimensions
- [ ] Tables are dense (compact padding, small font)
- [ ] Header is compact (48px max)
- [ ] Colors from design token palette (no invented hex values)
- [ ] No glassmorphism, no backdrop-blur, no particle effects
- [ ] No emoji in data contexts (lucide icons only)
- [ ] All tickers uppercase
- [ ] Chart uses Canvas (not an SVG chart library)
- [ ] Grid uses virtual scrolling (not rendering all rows)
- [ ] Click company row → navigates to /companies/[ticker]
- [ ] 401 response clears token + redirects to /login
- [ ] Order submit button disables on click
- [ ] All mutations invalidate affected caches on success
- [ ] No console.log / debug artifacts in production code
- [ ] Responsive: works at 375px / 768px / 1440px+
- [ ] Build passes: `npm run build` — zero errors
- [ ] Lint passes: `npm run lint` — zero warnings
- [ ] Every page is tagged TERMINAL or MARKETING per Section 0, and only pulls tokens from its own palette
- [ ] Marketing motion never appears inside an authenticated route

---

## 13. Component Architecture Patterns

### Composition Pattern
Every page is composed of small, single-responsibility components.
No component file exceeds 300 lines. If it does, split it.

```
pages/companies/[ticker]/page.tsx
  ├── CompanyHeader           # ticker, name, price, change
  ├── div.grid (2-col layout)
  │   ├── div.left
  │   │   ├── PriceChart      # Canvas candlestick chart
  │   │   ├── TimeframeSelector
  │   │   ├── IndicatorToggles
  │   │   ├── DriverChart     # Horizontal bar chart
  │   │   └── FinancialTabs   # Income / Balance / Cashflow
  │   └── div.right
  │       ├── ValuationCard   # Scores and fair PE
  │       └── OrderForm       # Buy/sell panel
```

### Data Cell Pattern (reusable across tables)

```tsx
function DataCell({ value, type = 'text', change, loading }: DataCellProps) {
  if (loading) return <Skeleton className="h-4 w-16" />;
  if (value == null) return <span className="text-tertiary">N/A</span>;

  const formatted = formatByType(value, type);
  const colorClass = change != null
    ? change > 0 ? 'text-positive' : change < 0 ? 'text-negative' : 'text-neutral'
    : '';
  const monoClass = ['price', 'pct', 'large', 'ticker', 'date'].includes(type)
    ? 'font-mono tabular-nums'
    : '';

  return (
    <span className={`${monoClass} ${colorClass} ${alignClass(type)}`}>
      {formatted}
    </span>
  );
}
```

### Skeleton Pattern (fixed dimensions, no layout shift)

```tsx
function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-tertiary rounded-sm ${className}`}
      style={{ width, height }}
    />
  );
}

// Usage — always specify width + height for no layout shift:
<Skeleton width={80} height={16} />
```

---

## 14. Build Order

Build in this exact dependency chain:

1. Scaffold (package.json, tsconfig, next.config, tailwind.config)
2. `lib/api/types.ts` (run typegen against running API)
3. `lib/api/client.ts` (fetch wrapper with auth)
4. `lib/utils.ts` (cn() helper + formatting functions + chart math utils)
5. shadcn/ui primitives (npx shadcn@latest add)
6. `components/layout/Providers.tsx` (React Query + Auth provider)
7. Auth components + hooks (LoginForm, RegisterForm, ProtectedRoute, useAuth)
8. Login + Register pages
9. `components/layout/Header.tsx` + `app/layout.tsx`
10. **Chart engine foundation:**
    - `lib/charts/core/` (ChartSurface, Axis, Grid, Crosshair, Viewport)
    - `lib/charts/types.ts`
11. `components/ui/StatCard.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `Skeleton.tsx`
12. Market hooks + VirtualGrid + MarketGrid component
13. `/market` page
14. **Chart series:** CandlestickSeries, VolumeSeries, LineSeries
15. Company hooks + PriceChart + DriverChart + ValuationCard
16. `/companies/[ticker]` page
17. Portfolio hooks + HoldingsTable + AllocationChart + PerformanceChart + AnalyticsCards
18. `/portfolio` page
19. OrderForm + orders hook + OrderBook component
20. Integrate OrderForm into company detail page
21. Leaderboard hooks + LeaderboardTable
22. `/leaderboard` page
23. News hooks + NewsFeed + NewsCard + filter sidebar
24. `/news` page
25. Simulation hooks + SimControlPanel + TimelineBranch + CycleIndicator
26. `/simulation` page
27. `/admin` page (stretch)
28. **Marketing landing page (build AFTER full terminal is functional):**
    - HeroMarketPulse (Canvas sector visualization)
    - PriceTickerTape
    - Landing sections (feature explainer, "how it works," CTA)
    - Uses only @layer marketing styles + --mkt-* tokens
    - Zero shared components with authenticated app shell except
      shadcn primitives (Button, Dialog base — restyled via
      @layer marketing, never the terminal's @layer components)
29. Polish: loading/empty/error states audit, responsive, dark mode consistency
30. E2E tests (Playwright)

---

## 15. API Integration Reference

All API calls use `lib/api/client.ts` with React Query hooks from
`lib/api/hooks/`.

```typescript
// Example hook pattern:
export function useMarketGrid(timelineId?: number) {
  return useQuery({
    queryKey: ['market', timelineId],
    queryFn: () => get(`/market${timelineId ? `?timeline_id=${timelineId}` : ''}`),
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order: PlaceOrderRequest) => post('/orders', order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['market'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });
}
```

Endpoints:
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `GET /api/v1/market?timeline_id=X`
- `GET /api/v1/market/cycle?timeline_id=X`
- `GET /api/v1/companies/{ticker}?timeline_id=X`
- `GET /api/v1/companies/{ticker}/history?timeline_id=X&from=Y&to=Z`
- `GET /api/v1/companies/{ticker}/drivers?timeline_id=X`
- `GET /api/v1/companies/{ticker}/financials`
- `GET /api/v1/companies/{ticker}/valuation?timeline_id=X`
- `GET /api/v1/portfolio?timeline_id=X`
- `GET /api/v1/portfolio/analytics?timeline_id=X`
- `GET /api/v1/transactions?timeline_id=X&limit=Y&offset=Z`
- `POST /api/v1/orders`
- `GET /api/v1/leaderboard?timeline_id=X&limit=Y&offset=Z`
- `GET /api/v1/news?timeline_id=X&sim_date=Y&company_id=Z&limit=W`
- `GET /api/v1/sim/state?timeline_id=X`
- `POST /api/v1/sim/advance`
- `GET /api/v1/sim/timelines`
- `POST /api/v1/sim/timelines`

Generate types: `npm run typegen` (requires API on port 8001).

---

## 16. Quality Gate

**Before any PR is ready:**

1. Every page passes the Pre-Flight Checklist (Section 12)
2. No component renders without handling loading/empty/error/edge states
3. All numerical data uses monospace + tabular-nums + right-alignment
4. Color scheme is consistent (no invented hex values)
5. Responsive layout passes at 375px, 768px, 1440px
6. No placeholder content, no filler text, no fake data
7. Every interactive element has hover + focus + active states
8. Charts render on Canvas (no SVG chart library imports)
9. Tables use virtual scrolling (not full DOM render)
10. Build passes: `npm run build` — zero errors, zero warnings
11. No console.log or debug artifacts
12. All React Query mutations invalidate correct caches

---

## 17. Keyboard & Command System

### Global shortcuts (TradingView-inspired, 70+ keybindings)

| Shortcut | Action | Context |
|---|---|---|
| `Space` | Pan mode toggle (hand tool) | Chart |
| `Alt + Up/Down` | Zoom in/out chart | Chart |
| `Ctrl/Cmd + Z` | Undo layout change | Global |
| `Ctrl/Cmd + Shift + Z` | Redo layout change | Global |
| `Ctrl/Cmd + \`` | Command palette | Global |
| `Ctrl/Cmd + F` | Symbol search | Global |
| `/` | Focus filter input | Grid/Table |
| `Escape` | Clear selection / close modal | Global |
| `Ctrl/Cmd + S` | Save layout profile | Global |
| `Ctrl/Cmd + 1-9` | Switch saved layout | Global |
| `G` | Go-to-line in grid | Grid |
| `R` | Reset chart viewport | Chart |
| `Shift + Click` | Add to selection (multi-row) | Grid |
| `Ctrl/Cmd + A` | Select all rows | Grid |
| `Delete` | Remove selected pane | Multi-pane |
| `Ctrl/Cmd + N` | New chart tab | Multi-pane |
| `T` | Enter order ticket sizing | Order Form |
| `Ctrl/Cmd + Enter` | Submit focused order | Order Form |
| `F1` | Toggle left sidebar | Layout |
| `F2` | Toggle right sidebar | Layout |
| `F3` | Toggle bottom panel | Layout |
| `F6` | Toggle performance overlay | Chart |
| `Ctrl/Cmd + Shift + R` | Reset layout to default | Global |
| `Ctrl/Cmd + Shift + D` | Duplicate current pane | Multi-pane |
| `Ctrl/Cmd + Shift + E` | Export chart as image | Chart |
| `?` | Show keyboard shortcut cheat sheet | Global |

### Command palette (like TradingView's "Go to...")

- Trigger: `Ctrl/Cmd + \`` or search icon in toolbar
- Commands organized by category: Navigation, Chart, Trade, Layout, View
- Fuzzy-search across all commands and symbols
- Results ranked: exact match > prefix match > fuzzy match
- Each result shows keyboard shortcut hint (right-aligned, muted)
- Top 8 results shown at once, 200ms debounce on input
- Arrows to navigate, Enter to select, Escape to dismiss
- Highlight typed characters in result text (bold)

### Implementation

```
lib/hooks/useKeyboard.ts      // Global keyboard registry
lib/hooks/useCommandPalette.ts // Palette state + filtering
components/CommandPalette.tsx  // Fuzzy-search UI (shadcn Command + Dialog)
components/ShortcutCheatSheet.tsx // ? overlay with all shortcuts grouped
```

- `useKeyboard` register/unregister on mount/unmount, priority system for nested contexts
- Block shortcuts when `input`/`textarea`/`contenteditable` focused (except explicit allowlist)
- No conflicts with native browser shortcuts (`Ctrl/Cmd + P`, `Ctrl/Cmd + T`)

### Discoverability mechanic (Figma/Linear-style modifier reveal)

- Holding `Alt` for 400ms+ reveals small keycap badges overlaid on every
  actionable element — the badge shows the keyboard shortcut for that
  action (e.g. `R` next to the reset-viewport button, `G` next to the
  grid). Badges fade out on modifier release.
- Implemented via a `useKeyboardReveal` hook that listens for modifier-
  key held state and toggles a `data-keyboard-hints` attribute on body,
  with CSS `::after` pseudo-elements for the badge rendering (no
  additional DOM nodes per element).

---

## 18. Color Accessibility (CVD — Color Vision Deficiency)

### Why

~8% of men and ~0.5% of women have some form of color blindness. For a trading platform, distinguishing green (buy/up) from red (sell/down) is critical. We ship 4 color modes.

### The four color modes

| Mode | Green / Buy / Up | Red / Sell / Down | Neutral |
|---|---|---|---|
| Normal (default) | `#22c55e` emerald-500 | `#ef4444` red-500 | `#6b7280` gray-500 |
| Protanopia (red-blind) | `#3b82f6` blue-500 | `#f97316` orange-500 | `#6b7280` gray-500 |
| Deuteranopia (green-blind) | `#6366f1` indigo-500 | `#eab308` yellow-500 | `#6b7280` gray-500 |
| Tritanopia (blue-blind) | `#22c55e` emerald-500 | `#ef4444` red-500 | Gray (higher contrast) |

### Additional accessibility

- All 4 modes pass WCAG 2.1 AA contrast minimum (4.5:1 for text, 3:1 for large text)
- All 4 modes pass WCAG 2.1 AAA for critical data indicators (7:1)
- Mode stored in `localStorage`, available in user Preferences dropdown
- Add visual indicators BEYOND color: patterns, icons, text labels, position
- Charts: dashed lines vs solid, triangle-up/down icons on candlesticks, "B" / "S" markers
- Order book: buy-side always top-aligned regardless of mode, size bars for depth
- P/L display: always includes `+`/`-` prefix and arrow icon, never just color
- Config driven: `lib/theme/cvd-modes.ts` exports all 4 palette objects + selector context

### Mode selector preview

- The CVD dropdown includes a live mini-preview swatch showing a sample
  up/down pair rendered in each mode, so a user can see the difference
  before committing — a real accessibility-craft detail, not just a
  settings toggle.

### Testing

- Use Chrome DevTools Rendering tab → Emulate vision deficiencies (protanopia/deuteranopia/tritanopia)
- Verify every page passes in all 4 modes — no ambiguous information
- Run `npm run test:a11y` (axe-core + cvd simulation) in CI

---

## 19. Multi-Pane / Multi-Monitor Layout System

### Philosophy (Renaissance / Citadel quant desk)

Professional trading desks run 3–6 monitors. Each monitor shows a purpose-built layout. Our app supports the same mental model in a single browser window.

### Layout primitives

```
lib/layout/
├── LayoutEngine.ts        // Core: split, merge, resize, move panes
├── LayoutContext.tsx       // React context + reducer
├── PaneManager.ts         // Pane lifecycle (mount/unmount serialization)
├── usePaneState.ts        // Per-pane state (symbol, timeframe, indicators)
├── useLayoutPersistence.ts // Save/load layout profiles
├── types.ts               // PaneNode, SplitOrientation, PaneType
└── presets/               // Factory functions for default layouts
    ├── default.ts
    ├── trader.ts
    ├── analyst.ts
    └── monitor.ts
```

### Pane tree structure (binary tree of splits)

```
LayoutTree
├── Split (vertical, 50%)
│   ├── Split (horizontal, 60%)
│   │   ├── Pane (Chart)         ← symbol: AAPL, interval: 1D
│   │   └── Pane (Chart)         ← symbol: SPY, interval: 1D
│   └── Split (horizontal, 40%)
│       ├── Pane (OrderBook)     ← symbol: AAPL
│       └── Pane (MarketGrid)
└── Split (vertical, 50%)
    ├── Pane (NewsFeed)
    └── Pane (Portfolio)
```

### Preset layouts for 4 personas

**Default** (single monitor, 1080p)
- Chart (70% width) | Market Grid (30% width)
- Order Book + Order Form in bottom tab group

**Trader** (dual monitor focus)
- Monitor 1: 2 charts stacked (symbol + index), order book right
- Monitor 2: Portfolio + Watchlist + News in 3-column grid

**Analyst** (deep research)
- 4 charts in 2×2 grid (different timeframes), bottom strip: grid + financials

**Monitor** (passive / overview)
- 1 large chart, right panel: top movers + sector performance + heatmap

### Interaction patterns

- Drag pane tab to reorder
- Drag pane edge to resize (min 200px width, 150px height) — show live
  numeric readout of the resulting pane dimensions in the resize handle's
  cursor tooltip while dragging (`420px × 680px`)
- Right-click pane tab → Split Vertical / Split Horizontal / Close / Duplicate
- Double-click pane tab → Maximize (full window), double-click again to restore
- Each pane remembers its state (symbol, timeframe, indicator flags)
- Pane title bar: symbol, interval, indicator indicators (e.g. "AAPL · 1D · SMA(20), RSI")
- Max 12 panes open simultaneously (performance guard)
- Layout serialized to JSON, saved to `localStorage` + exportable/importable

### Multi-monitor support (browser-level)

- `BroadcastChannel` API to sync settings across browser windows
- Open new window with: `window.open(url, 'monitor2', 'width=1920,height=1080')`
- Each window loads same app but shows different data via URL param `?layout=trader-right`
- Layout presets define which panes appear on which monitor
- Preferences, CVD mode, theme synced across windows in real time

---

## 20. TradingView-Inspired Interaction Patterns

### Symbol search ("Go to" dialog)

- Always available: Ctrl/Cmd + F, toolbar icon, or click symbol name in chart header
- Search experience:
  - Fuzzy match on ticker, company name, and description
  - Search results grouped: Exact > Prefix > Fuzzy
  - Recency + frequency-weighted ranking: recently/frequently viewed
    tickers surface above alphabetical/fuzzy matches when the query
    is short (1-2 chars) — traders overwhelmingly re-visit the same
    handful of symbols, matching how real terminal "go to" dialogs behave
  - Show ticker + exchange + sector icon on each result row
  - Highlight matched characters with `<mark>` styling
  - Keyboard: arrow keys select, Enter confirms, Escape dismisses
  - Add to watchlist button inline on hover
- Props: `onSelect(symbol: string)`, optional `initialQuery`, `maxResults` (default 10)
- Implementation: `components/SymbolSearch.tsx` using shadcn `Command` + `Dialog`
- Back: debounced 300ms API call to `GET /api/stocks/search?q=`

### Chart timeframes bar

- Buttons in chart header: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M, 3M, 1Y, All
- Actively rendering period shown in bold underline
- Clicking changes chart data and viewport simultaneously
- Rightmost: custom date range picker (calendar start/end)
- Keyboard: `1`→1m, `2`→5m, `3`→15m, `4`→30m, `5`→1H, `6`→4H, `7`→1D, `8`→1W, `9`→1M

### Crosshair and data probe

- Crosshair activates on mouse enter, deactivates on mouse leave
- Horizontal + vertical lines follow cursor across ALL charts in the same pane group
- Data point tooltip: O, H, L, C, Volume, Date for current candle
- Y-axis values: right-side mirror of crosshair Y position
- Click to lock crosshair in place (pinned crosshair)
- Double-click to reset to default crosshair behavior
- Long-press (500ms) to show multi-candle zoom window (10 candles centered on cursor)

### Chart comparison (overlay)

- Click "Compare" button in chart toolbar
- Symbol search dialog opens to select second symbol
- Second series rendered as LineSeries overlay on same chart
- Different color per overlay (up to 5 overlays)
- Each overlay has its own Y-axis scale (left or right, auto or fixed)
- Legend in top-left shows each symbol + its color + toggle visibility
- Remove overlay by clicking X on legend item

### Indicators panel

- Side panel (right or bottom) listing active indicators
- Each indicator row: name, parameter values, visibility toggle, color, gear icon
- Add indicator: search/filter from master list (categorized: Trend, Momentum, Volatility, Volume, Custom)
- Indicator parameters: modal with number inputs for each parameter (period, multiplier, etc.)
- Apply to: all panes, this pane group, or this pane only
- Draggable to reorder indicator render order (z-index)

### Layout lock

- Toggle button in toolbar (lock icon)
- Locked: no pane resizing, no pane dragging, no layout changes
- Unlocked: full layout editing
- Visual: locked state dims all resize handles, cursor becomes default

---

## 21. Top 1% Production Engineering Principles

### CSS architecture (2026 state of the art)

1. **One source of truth**: all design tokens in `tailwind.config.ts` → Tailwind generates CSS custom properties → consumed by components. Never hardcode a value.

2. **CSS Container Queries for responsive**: use `@container` over media queries for self-contained widgets. Each card/grid/pane is a container, queries on its own width.

3. **`content-visibility: auto`** on all below-fold panes. Lazy render panes not in viewport. Combined with `contain: layout style paint` on each pane.

4. **Subgrid for aligned financial tables**: `display: grid; grid-template-rows: subgrid` to align price rows across separate card sections.

5. **`@layer` cascade layering**: `base` → `components` → `utilities` → `overrides`. No `!important` anywhere. shadcn styles → our component layer → page-specific overrides.

6. **CSS `:has()` selector**: `.pane:has(.chart:focus-visible)` for focus trapping in pane groups. `.grid-cell:has(+ .grid-cell.selected)` for adjacency styles.

7. **`scroll-timeline` / `view-timeline`** (where supported): animate price flash on scroll into viewport.

8. **CSS `@property` for animated gradients**: register custom properties for price-change background flash animations (green flash on uptick, red flash on downtick).

9. **`text-wrap: pretty`** on column headers, **`text-wrap: balance`** on card titles.

10. **`font-size: clamp(...)`** for responsive typography on financial data cards.

### React component patterns (strict)

1. **Every component is one of**: Page, Widget, Primitive, Container, or Layout. Nothing else.

2. **No component > 300 lines**. Break into subcomponents or hooks.

3. **Props interfaces always exported**, JSDoc on non-obvious props.

4. **Default exports only on pages** (`export default function MarketPage`). Everything else is named export.

5. **Custom hooks extract ALL stateful logic** from components. A component's body should only contain hook calls, event handlers, and JSX.

6. **`React.memo`** on all grid cells, chart series, and price displays. Wrap with displayName.

7. **`useDeferredValue`** for search inputs and filter inputs (300ms framerate budget).

8. **`useOptimistic`** for order submission: show filled order immediately, roll back on error.

9. **No `useEffect` for data fetching** — all data via React Query `useQuery`/`useMutation`.

10. **`useSyncExternalStore`** for layout tree and pane state (two React 18 concurrent-mode-safe stores).

### Data consistency (Bloomberg-level)

1. Every price display component subscribes to a single `usePriceTicker(symbol)` hook that websocket-updates at 100ms intervals.

2. All derived values (change%, P/L, ratio) are computed from raw price data, never fetched separately.

3. Numeric formatting uses a single `lib/format.ts` function (Section 8) — every number passes through it. No inline `toFixed()` or `Intl` calls.

4. WebSocket reconnection: exponential backoff (1s → 30s max), jitter ±500ms, `IDLE` detection (no heartbeat for 10s → reconnect).

5. Stale-while-revalidate: React Query `staleTime: 5000` for market data, `staleTime: 30000` for reference data, `staleTime: 60000` for portfolio data.

6. Optimistic updates for trades: invalidate portfolio + position + cost basis caches simultaneously.

### Performance budgets

| Metric | Budget |
|---|---|
| First Contentful Paint (FCP) | < 1.5s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Interaction to Next Paint (INP) | < 200ms |
| Total Bundle Size (gzip) | < 250KB |
| Chart render (1000 candles) | < 16ms |
| Grid render (100 rows) | < 50ms |
| Layout save/load | < 5ms |
| Command palette search (1000 items) | < 10ms |
| WebSocket message → UI update | < 50ms |

### Error boundaries (every pane)

Each pane in the multi-pane layout is wrapped in its own `<ErrorBoundary>`. One broken pane never takes down others.

```
components/ErrorBoundary.tsx — generic boundary
components/PaneErrorBoundary.tsx — pane-specific (shows "Pane crashed — reload" with retry button)
components/ChartErrorBoundary.tsx — chart-specific (shows chart placeholder, no stack trace)
```

### Accessibility baseline

- WCAG 2.1 AA (AAA where feasible for financial data)
- All interactive elements keyboard accessible
- Screen reader announcements for price changes, trade executions, order fills
- Focus indicators: 3px offset ring, high contrast (not just color)
- Skip-to-content link
- Semantic HTML: `<table>` for data grids, `<nav>` for navigation, `<main>` for primary content
- Chart data available as accessible `<table>` fallback for screen readers (invisible but present in DOM)
- ARIA live region for order status updates

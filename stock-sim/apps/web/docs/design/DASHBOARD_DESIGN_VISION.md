# Dashboard Design Vision
Status: Inspiration / Design Reference
Source: Fable
Purpose: This is a visual design specification only. It must never override architecture or business logic. Future implementation should follow this document where technically feasible.

---

# MarketVerse Dashboard — "The Desk"
### Full Visual Design Specification · MERIDIAN v1.0
**A single-page deep dive. No code. Every pixel accounted for.**

---

## 1 · The Concept

Most dashboards are bulletin boards: a grid of equal rectangles pinned to a wall, each shouting for attention. The Desk rejects that. Its organizing metaphor is a **trading desk at 6:58 AM** — one large instrument directly in front of you, peripheral instruments arranged by glance-distance, and a room whose lighting tells you the market is about to open.

Three compositional rules replace the generic SaaS grid:

1. **One protagonist.** The Portfolio Pulse module is 2.4× larger than anything else and is the only module allowed a full-bleed chart. Everything else is supporting cast. A dashboard where everything is equal is a dashboard where nothing is.
2. **Glance-distance layout.** Modules are placed by how often a trader's eye returns to them, not by category. High-frequency (price, P&L) sits center-left at eye level; medium-frequency (movers, heatmap) below; ambient (news, calendar) in the right rail where peripheral vision catches motion.
3. **Asymmetry as craft.** The grid is 12 columns, but no row splits evenly. The rhythm is 8+4, then 3+5+4, then 7+5 — deliberate irregularity that reads as *composed*, the way Linear's marketing pages and Apple's macOS Ventura settings panels avoid mechanical symmetry.

---

## 2 · Overall Composition

Canvas: 1728×1117 reference frame (14" MacBook Pro fullscreen), fluid beyond.

```
┌──────┬────────────────────────────────────────────────────┬──────────────┐
│      │  HEADER — 56px, index tape ticking                 │              │
│      ├────────────────────────────────────────────────────┤              │
│  S   │  ROW 1 · THE PROTAGONIST                (8 cols)   │  RIGHT RAIL  │
│  I   │  ┌───────────────────────────────────────────────┐ │  (4 cols)    │
│  D   │  │ PORTFOLIO PULSE                               │ │ ┌──────────┐ │
│  E   │  │ ₹48,32,450   ▲ +1.24%                         │ │ │WATCHLIST │ │
│  B   │  │ [full-bleed area chart · 240px · live edge]   │ │ │ dock     │ │
│  A   │  └───────────────────────────────────────────────┘ │ │ (60% of  │ │
│  R   │  ROW 2 · THE INSTRUMENTS      (3 + 5 + 4 cols)     │ │  rail ht)│ │
│      │  ┌─────────┐ ┌───────────────┐ ┌────────────────┐  │ └──────────┘ │
│ 240px│  │ SESSION │ │ TOP MOVERS    │ │ AI MORNING     │  │ ┌──────────┐ │
│      │  │ vitals  │ │ dual ladder   │ │ BRIEF ✦        │  │ │ NEWS     │ │
│      │  └─────────┘ └───────────────┘ └────────────────┘  │ │ WIRE     │ │
│      │  ROW 3 · THE MAP              (7 + 5 cols)         │ │ (stream) │ │
│      │  ┌──────────────────────┐ ┌────────────────────┐   │ │          │ │
│      │  │ SECTOR HEATMAP       │ │ ECONOMIC CALENDAR  │   │ └──────────┘ │
│      │  └──────────────────────┘ └────────────────────┘   │              │
└──────┴────────────────────────────────────────────────────┴──────────────┘
```

The right rail is **not part of the module grid** — it is a structurally distinct dock: 8px narrower gutter, its own scroll region, surfaces one step *darker* (`bg-surface-1` instead of `-2`). It reads as a separate physical instrument bolted beside the main panel — the Bloomberg multi-monitor feeling compressed into one screen.

Below the fold (scroll): Holdings table (full width) and the Correlation Matrix + Dividend Timeline pair. The fold line is honored: everything above it answers "how am I doing and what's moving," everything below answers "why."

---

## 3 · Lighting

The Desk is lit like a photographed physical object, with one consistent imaginary light source: **upper-left, cool, soft** — roughly 10 o'clock, 35° elevation.

Every material decision derives from that single source:

- **Top-light gradients** on all cards run vertical, +3% lightness at the top edge fading out by 120px — panels catching overhead light.
- **Shadows fall down-right**: the contact shadow in `shadow-rest` offsets 0/1px; the ambient in `shadow-raised` offsets 0/4px. Never centered halos — halos are what make SaaS cards look like stickers.
- **The wet edge**: glass surfaces carry a 1px `rgba(255,255,255,0.10)` inner top border — the specular highlight where light grazes the glass rim.
- **The protagonist is brightest.** Portfolio Pulse's surface is nudged +1.5% lighter than the standard `bg-surface-2`, as if it sits closest to the light. Imperceptible consciously; hierarchically decisive.
- **The rail is in shadow.** The right dock's darker surface plus a 12px inward gradient scrim along its left border makes it recede — peripheral instruments in the room's dimmer zone.
- **Session lighting** (the signature atmospheric move): the canvas mesh subtly shifts with market session. Pre-market: the top-left radial warms toward amber `rgba(217,146,46,0.04)`. Open: standard cool cobalt. Post-close: the mesh dims 30% and cools further. The room knows what time it is. Transition over 90 seconds — never noticed happening, always noticed having happened.

---

## 4 · Background

Level-0 canvas, dark theme:

1. Base `#0A0C10`.
2. Radial A: cobalt `rgba(62,111,224,0.05)`, 1400px radius, centered −10%/−15% (off-canvas top-left).
3. Radial B: slate `rgba(78,143,184,0.04)`, 1100px radius, centered 105%/110%.
4. **The graticule**: an ultra-faint 80px grid of dotted hairlines at `rgba(255,255,255,0.015)` — visible only in the gutters between modules, like graph paper under instruments. This is the anti-template detail: emptiness between cards has *texture*, so gutters never read as dead void.
5. Grain: 1.5% monochrome noise, fixed (doesn't scroll), killing gradient banding.

Nothing in the background moves. Stillness behind, life in front.

---

## 5 · Spacing

- Base unit 4px. Page margin 24px (32px ≥1680px). Module gutter 20px; rail gutter 12px (tighter — the dock is denser by nature).
- **Internal rhythm is fixed across every module**: 16px padding → header block (20px tall) → 12px → body → 16px. This uniform pulse is what lets wildly different modules feel like one instrument.
- Charts break the padding: any chart area bleeds to the module's left/right/bottom edges. Data escapes the frame; chrome never does.
- Vertical page rhythm: rows separated by 20px; the below-fold section opens with a 32px gap plus a `micro` eyebrow ("DEEPER ANALYSIS") with the Ledger Line draw — a typographic breath, not a divider bar.
- Density toggle: Compact mode collapses paddings 16→12, row heights 40→28, chart heights ×0.85. The composition ratios (8+4, 3+5+4, 7+5) never change — density changes the zoom, not the design.

---

## 6 · Glass Usage

Exactly three glass moments on this page — scarcity is the luxury:

1. **The header on scroll**: transitions from solid `bg-surface-1` to `rgba(16,19,24,0.72)` + 24px blur over 200ms, wet edge appearing beneath. The index tape ticking over blurred content is the page's most cinematic moment.
2. **Chart tooltips**: the crosshair panel on Portfolio Pulse and the heatmap hover card — glass with the mono data grid, so live data floats *over* live data without occlusion.
3. **The AI Morning Brief header strip**: a 44px frosted band (18px blur) under the module's iris top edge, holding the ✦ badge and confidence chip. The one place glass marks *identity* rather than *elevation*.

Explicitly not glass: cards, sidebar, rail, buttons. When a modal or ⌘K palette opens, those are additional legitimate glass surfaces per the system — but at rest, the page shows exactly three.

---

## 7 · Card Hierarchy

Five tiers, each with a distinct physical treatment — this is what makes each section feel handcrafted rather than instances of one template:

| Tier | Module | Treatment |
|---|---|---|
| **1 · Protagonist** | Portfolio Pulse | +1.5% brighter surface, 20px padding, `display-xl` numerals, full-bleed chart, permanent Ledger Line on its top edge (this module is *always* "active") |
| **2 · Instruments** | Session Vitals, Top Movers, AI Brief | Standard `bg-surface-2` cards, `radius-md`, top-light gradient |
| **3 · The Map** | Heatmap, Calendar | Same surface but **zero body padding** — the treemap tiles and calendar rows run edge to edge; the card is a window, not a tray |
| **4 · The Dock** | Watchlist, News Wire | `bg-surface-1`, hairline only on the left separating from the grid, no radius on outer edges — fused to the rail, not floating in it |
| **5 · Wells** | Sub-elements inside modules | `bg-canvas`-toned inset with `shadow-inset-well` — carved into the card |

Hover behavior differs by tier (a micro-signature): Tier-2 cards raise their border to `stroke-emphasis`; Tier-3 windows do nothing (their *contents* respond); Dock rows paint hover fills. The protagonist never changes on hover — it is furniture, not a button.

---

## 8 · Chart Placement & Treatment

**Portfolio Pulse (the hero chart).** 240px tall, full-bleed. A 1.5px `accent-300` line over a 14%→0% area fade. The **live edge** owns the right 48px: breathing 4px dot, price tag chip pinned to the right axis, and the Ledger Line running horizontally at last price across the full plot at 20% opacity. Range pills (`1D 5D 1M 6M YTD 1Y MAX`) float top-right *inside* the plot on a 60%-opacity surface chip — TradingView's floating toolbar discipline. Baseline comparison: a dotted hairline at previous close with a `caption` tag ("Prev ₹47,73,200"). No y-axis line; values float as right-aligned mono ghosts that appear on hover only — at rest the chart is pure shape.

**Sparklines (Session Vitals, Watchlist, Movers).** 96×24 (dock) to 120×32 (vitals), single 1.5px stroke in market color, 12% fill, no axes, no dots except a 3px endpoint. Sparklines are punctuation, not paragraphs.

**Sector Heatmap.** Treemap, edge-to-edge in its Tier-3 window, 1px canvas-colored gaps, diverging ramp with opacity-mapped magnitude. Tile anatomy: `micro` ticker top-left, mono delta bottom-right; tiles under 64px drop the delta; under 40px drop to ticker only. Hover: the tile's hairline brightens and a glass tooltip shows name, price, delta, 1-day sparkline. Click drills into industry level with a 240ms shared-element zoom — the one "wow" transition on the page, and it's earned because it encodes hierarchy.

**Movers dual ladder.** Not a chart — two mirrored mono columns (gainers/losers) with 3px magnitude bars underlining each delta, growing from the center spine outward. Chart-like scanability, table-like precision.

**Rule of restraint:** the page has exactly one time-series chart above the fold. Multiple competing line charts is the crypto-dashboard tell.

---

## 9 · Typography on This Page

- The hero numeral: `display-xl` 40px **mono**, weight 500, tabular — ₹48,32,450 with the currency mark at 85% size in `ink-secondary`. Directly beneath: the delta line in `data` 13px (`▲ +₹59,230 · +1.24% today`) in market color. The pairing of an enormous quiet numeral and a small loud delta is the page's typographic thesis.
- Module headers everywhere: `micro` eyebrow (11px, +0.04em, `ink-secondary`) → `heading-2` (18px). Eyebrows carry the Ledger Line draw on load, staggered (§10).
- The AI Brief body is the only serif on the page: Tiempos 14/22, 2–3 sentences max — the voice of an analyst's morning note amid machine numerals.
- News Wire headlines: Tiempos 15/21; timestamps and tickers mono. The rail mixes serif and mono in adjacent lines deliberately — wire-service texture.
- Absolute rule: no two adjacent modules open with the same type size. Scale contrast at every boundary is what "handcrafted" means in practice.

---

## 10 · Iconography

- All chrome icons: 1.5px stroke, 20px nav / 16px inline, `ink-secondary` at rest.
- **This page's bespoke set** (drawn, not stocked): pulse-wave (Portfolio), thermometer-candle (Vitals), twin-arrows (Movers), ✦ four-point star (AI — the only filled glyph, iris), mosaic (Heatmap), ringed-calendar (Calendar), eye-line (Watchlist), wire-spool (News).
- Status dots: 6px, market-green breathing for LIVE, amber solid for delayed, gray for closed. The dot + mono timestamp pair appears in every module header's right cluster — the page's trust rhythm.
- Directional triangles never appear without their numeral; numerals never appear without their sign.

---

## 11 · Animations

**The Opening Sequence (page load, 900ms total, one-time).** The Desk boots like an instrument powering on, back-to-front:

1. 0–150ms — canvas mesh and graticule fade in.
2. 100–400ms — modules rise 6px and fade in, staggered 40ms in reading order; the protagonist lands first.
3. 300–700ms — Ledger Lines draw under each module eyebrow, same stagger.
4. 500–900ms — hero numeral counts up from ±2% of its value (mono digits rolling, 350ms, ease-out); the hero chart draws its path left-to-right.
5. 900ms — live dots begin breathing; the tape starts ticking.

Never replayed on tab-switch or navigation-back. `prefers-reduced-motion`: the entire sequence becomes a single 200ms fade.

**Steady-state (ambient) animation budget** — at most three things moving in any 5-second window:
- Price ticks: 240ms numeral crossfade + 8% market-color cell wash decaying over 800ms.
- Live-edge dot breathing (2.4s opacity 60↔100%).
- News items sliding into the wire (240ms, max one per 2s; excess batches into a "4 new" glass pill).

**Session transitions:** at open/close, the header session badge crossfades and the mesh begins its 90s lighting shift. No fanfare — the market opening is announced by the room, not by confetti.

---

## 12 · Micro-interactions

- **Hover a watchlist row** → row fill + its sparkline gains a crosshair dot under the cursor's x-position — even the 96px sparkline is an instrument.
- **Hover the hero chart** → crosshair with glass tooltip; the hero numeral above *becomes the scrubbed value* (with a `caption` "14 Jun · ₹47,10,340" tag), reverting on mouse-out over 160ms. The headline is the readout — no duplicate displays.
- **Press any range pill** → the chart path *morphs* (path interpolation, 280ms) rather than swapping — continuity of the same portfolio through time.
- **Drag a module** (grip appears on header hover) → module lifts to `shadow-raised` at 98% scale with 2° ease-in tilt; a 4px accent drop-line previews placement; on drop, settles over 200ms. Tilt is the single playful note on the page, and it lasts under half a second.
- **Click the session clock** → a popover with all exchange sessions on a 24h hairline timeline, current moment marked by — of course — a Ledger Line.
- **Copy affordance**: hovering any mono figure ≥ `data` size reveals a 12px copy glyph at 40% opacity; click → "Copied" micro-toast at cursor. Traders paste numbers all day; the interface knows.
- **Alt-hover the heatmap** → tiles re-label from delta to market cap while held — a professional's x-ray toggle, undocumented, discoverable.

---

## 13 · Empty States

Emptiness on The Desk is staged, never blank:

- **New user (no portfolio):** the protagonist shows a ghost chart — a plausible muted path at 6% opacity behind a centered invitation: "Connect your portfolio" (`heading-2`), one sentence, primary button "Import holdings" + ghost "Try a demo desk." *Demo desk* fills the entire dashboard with clearly-watermarked simulated data (a `micro` "SIMULATED" pill in every module header) — the strongest anti-empty move: the product demonstrates itself.
- **Empty watchlist dock:** framed sparkline illustration, "Build your first watchlist," + three suggested chips (`NIFTY 50 leaders · Your sector · Most active`) that add instantly.
- **No news matching filters:** "The wire is quiet for these filters" + ghost "Widen to all markets."
- Every empty module keeps its header, live dot, and timestamp — the instrument is on, just unloaded.

## 14 · Loading States

- **Skeletons are shape-true**: the hero skeleton shows the real layout — numeral bar, delta bar, and a static ghost path where the chart will be; watchlist skeletons show ticker/spark/price column widths exactly. Shimmer: 1.8s, 60° band at 4% white.
- **Progressive reveal, not page gate**: each module resolves independently as its data lands; fast modules never wait for slow ones. Sub-300ms loads skip skeletons entirely.
- **Reconnect state**: if the feed drops, modules keep last data, timestamps turn amber with a "Reconnecting ◌" spinner (12px arc) in the header cluster; on recovery, a single cobalt toast "Live data restored," and every stale value crossfades to current — no flash storm.
- Numbers never render as `0` or `—` while loading. A wrong number is worse than a skeleton.

---

## 15 · Why This Isn't a Template

A closing audit against the generic-SaaS checklist: no equal-width card grid (asymmetric 8+4 / 3+5+4 / 7+5 rhythm); no floating cards on flat void (graticule-textured canvas, dock fused to the frame); no four-KPI-tiles-in-a-row (one protagonist, tiered hierarchy); no gradient hero banner (lighting lives in the material, not a banner); no icon-in-circle empty states (staged ghosts and demo data); no purple (iris appears only as a 2px AI badge edge); and only one line chart above the fold. Every module has at least one behavior unique to it — the scrubbed hero numeral, the morphing range pills, the alt-hover heatmap x-ray, the wire's batching pill. That is what handcrafted means: not that each section looks different, but that each section *behaves* like it was built by someone who uses it.

**One-line summary:** *The Desk is a single lit instrument panel — one protagonist chart, a room that knows the market's hour, and nothing moving that isn't money.*

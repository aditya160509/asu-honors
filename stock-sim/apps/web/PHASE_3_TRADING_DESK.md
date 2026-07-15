# PHASE 3 — Trading Desk — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one. (Recommended prerequisite: Phase 2's Holdings/Analytics data model
should exist, since Position Summary consumes it.)

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome recedes to near-invisibility; only market/user data carries
color, motion, and visual weight — this principle matters more in this phase than any other, because a trading
desk is exactly where consumer fintech apps tend to over-decorate (confetti, coin animations, celebratory
sounds) and this spec explicitly forbids all of that.

The Five Laws:
1. Data is the only decoration.
2. One accent color everywhere — green/red belong exclusively to market direction.
3. Ink on glass — every surface behaves like a physical material.
4. Numbers are typography's first citizens — tabular, decimal-aligned, monospaced.
5. The interface never sleeps and never shouts.

**Ledger Line** — 1px luminous accent hairline (`transparent → accent-500 → transparent`, centered, 60% of
module width). Used in this phase as the active-tab marker (Order Book / Open Orders / Filled / History tabs)
and the focused-module edge.

### A2. Color rules (non-negotiable — read this twice for this phase specifically)
- No pure `#000000`/`#FFFFFF` anywhere.
- `market-up`/`market-down` are reserved **exclusively** for price direction. This phase is the **one and only
  place in the entire application** where market colors are also permitted on **buttons** — the spec's Buttons
  component explicitly carves out this single exception: "Market actions: Buy `market-up-deep` fill / Sell
  `market-down-deep` fill — the only buttons permitted to use market colors, always paired side-by-side at
  equal width." This exception is narrow and specific to the Buy/Sell ticket buttons only — it does not extend
  to any other button in this phase (Cancel Order, Confirm, etc. all use the standard button variants).
- Order **rejections** are the one case where **toasts** may use market-red (per the Toasts spec's semantic
  left-edge rule) — this is the only other market-color exception in this phase. Order cancellations
  (user-initiated) are NOT rejections and use the amber Destructive-confirm pattern, not red.
- Generic success (order confirmed, not rejected) uses accent, never green.
- **No 3D coins, confetti, or celebratory effects on trades** — this is explicit in the Don'ts list and is the
  single most important restraint in this phase given the subject matter. A filled order gets exactly: a
  price-flash-style cell animation (8% market-color tint, 800ms decay) and a toast. That is the entire "reward."

### A3. Typography rules (non-negotiable)
- **Data (Söhne Mono / IBM Plex Mono fallback)** dominates this phase almost entirely — every price, quantity,
  notional value, P&L figure, order-book row, and timestamp is mono, tabular, decimal-aligned. This is the
  highest-density, most numerically demanding phase in the app.
- **Interface (Söhne / Inter fallback)** — labels, order-type selectors, button text only.
- Editorial typeface is not used anywhere in this phase.
- Numeric rules apply without exception: tabular lining figures, right-align on decimal point, currency/percent
  symbols at 85% size and desaturated, signed deltas with explicit `+`/`−` (never parentheses), tickers mono
  uppercase tracked +0.02em, timestamps mono `caption` `ink-tertiary`.
- Relevant scale tokens: `data-lg` (28/32, featured prices — the ticket's live quote), `data` (13/18, table
  cells across Order Book/Open Orders/Filled/History), `data-sm` (11/14, dense order-book depth rows — this
  phase should default to Compact density given how information-dense a real trading desk is expected to be).

### A4. Layout & elevation rules
Five-layer elevation model, three simultaneous cues (background step + shadow + hairline) per layer:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | Ticket card, order book card, position summary card |
| 3 | Raised | `bg-surface-3/4` | Ticker typeahead dropdown, order-type dropdown |
| 4 | Overlay | `bg-glass` | Order confirmation modal, cancel confirmation modal |

- Nesting caps at two visible background steps.
- Active/focused state raises the border, never the surface.
- Radius scale: `radius-xs` 4px (status badges), `radius-sm` 6px (buttons/inputs), `radius-md` 10px (cards),
  `radius-lg` 14px (modals). **Nothing above 14px, ever.**
- Row height: Comfortable 40px / Compact 28px — default this phase to Compact given its density, but respect
  the user's global density preference if already set elsewhere.

### A5. Glass — strict allowlist
Permitted in exactly five places app-wide: command palette, modals/drawers, sticky header on scroll, chart
tooltips, AI card header strip. In this phase: the **order confirmation modal** and **cancel confirmation
modal** are glass (Level 4 overlays, per the Modals spec). The order ticket itself, the order book card, and
all tables are **not** glass — they are resting Level-2 solid surfaces.

### A6. Component library — reuse, don't reinvent
- **Buttons**: Primary (`accent-500`, one per view, used for the ticket's context-appropriate primary action —
  see C1), Secondary (`bg-surface-3` + hairline), Ghost (transparent, toolbar/table actions), Destructive-confirm
  (ghost at rest, `warn` amber fill only inside confirm modals — used for Cancel Order), **Market actions**
  (Buy `market-up-deep` / Sell `market-down-deep`, paired side-by-side at equal width — the ticket's core
  control, and the only buttons in the entire app permitted this treatment). Heights: 32px default, 40px modal
  primary. Loading state swaps label for 14px indeterminate arc, width locked.
- **Inputs**: 32px height, well one step darker than parent, inset shadow, hairline border, `radius-sm`. Focus
  = accent border + `glow-accent` ring. Numeric inputs are mono, right-aligned, stepper affordances on hover
  only. Quantity/price fields show a real-time notional value as **ghost text inside the field** — this exact
  behavior is spec-named for "Specialized fields" and is core to this phase's ticket UX. Ticker inputs
  auto-uppercase with a live match dropdown.
- **Modals**: `radius-lg`, `shadow-overlay`, scrim+blur, widths 420 (confirm)/560 (form)/800 (data/comparison).
  Order-confirmation modals **restate the trade in a raised well with mono figures** — the spec calls this the
  "institutional read-back pattern" by name; it is mandatory, not optional polish, for this phase. Never stack
  two modals — secondary detail opens as a right-side drawer.
- **Tables**: sticky `bg-surface-3` header, `micro` uppercase labels, sortable chevrons, 40px/28px rows,
  half-strength hairline separators, no zebra striping, hover fills full row width, numerics right-aligned
  mono, first column pinned with scroll scrim, row selection 2px accent left edge.
- **Order book card** (named pattern): mirrored mono bid/ask columns, depth shown as opacity-scaled horizontal
  bars from the spread outward.
- **P&L card** (named pattern): realized/unrealized split, mono figures, thin diverging bar centered on zero —
  used for Position Summary.
- **Toasts**: bottom-right stack, max 3, `radius-md`, `shadow-raised`, 360px wide, 5s auto-dismiss with
  draining progress hairline. Semantic left edge: accent (fill confirmation), amber (warning), **market-red
  reserved specifically for order rejections** — the one legitimate use of red in a toast anywhere in the app.
- Reuse Radix + shadcn/ui, react-hook-form+zod for the ticket form, TanStack Query for all server state
  including polling/streaming order status if applicable.

### A7. Motion — GSAP only, per this exact table

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Quote crossfade on tick; order-book depth-bar resize; fill flash 8% tint, 800ms decay |
| Micro-interactions | 120–160ms, ease-out | Hover, press, toggle, side-selector switch |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | Confirmation modal scale-in, dropdown fade+rise |
| Ledger Line draw-in | 400ms, ease-in-out | Tab underline, focused ticket edge |
| Ambient | 2–4s loops | Skeleton shimmer, live-dot breathing on the quote |

Rules: nothing bounces, overshoots, or rotates — **this includes fill notifications**: no spinning checkmarks,
no bouncing confirmation icons. `prefers-reduced-motion` collapses everything to opacity fades. Price-flash and
order-book depth updates are the two things in this phase allowed to recur >1/sec without user input (both are
live-market-driven, not decorative).

### A8. States every feature must define
Ticket: default, quote-loading, submitting (locked/disabled with indeterminate arc), validation-error (inline
amber), server-rejection (toast, red edge, plus an inline banner in the ticket restating why), success
(confirmation modal → toast). Tables (Order Book/Open/Filled/History): default, loading (shape-accurate
skeleton), empty (no open orders yet, no fills yet), error (module-level, contained), live-updating (new rows
insert without layout jank).

### A9. Accessibility (mandatory, not follow-up)
≥4.5:1 contrast; direction never color-only (▲/▼ glyph always paired with the signed numeral, critical here
since Buy/Sell buttons must not rely on color alone — label text "Buy"/"Sell" is always present, color is
reinforcement not the sole signal); full keyboard model (a keyboard user must be able to complete an entire
order — ticker search, quantity, price, submit, confirm — without a mouse); visible focus ring; live regions
announce fills/rejections, throttled to 1/3s/module (critical here: rapid successive fills must not spam
screen readers — batch or throttle announcements).

### A10. General engineering rules
Backend: FastAPI + SQLAlchemy + Alembic. New tables get real migrations. New/extended routers follow
`routers/<domain>.py` + `services/<domain>_service.py`. Frontend: Next.js 15 App Router, React 19, TypeScript,
JS/TS only, desktop-first, 64px icon-rail collapse minimum. Every module fault-isolated. Don't touch code
outside this phase's boundary without flagging it. Verify by running the dev server and placing real
(simulated) orders end-to-end, not just type-checking. Never hardcode secrets.

---

## PART B — Phase 3 Context: What Already Exists (read before writing anything)

- Backend `apps/api/routers/trading.py` currently has **only `POST /orders`**, with unconfirmed order-type,
  cancellation, and margin semantics. **Read the actual current implementation of this endpoint and the
  `Order`-related model(s) in `db/models/trading.py` in full before writing anything** — this phase assumes
  the order engine is substantially greenfield, but verify exactly how much exists rather than re-deriving
  from scratch if partial logic is already there.
- `db/models/trading.py` has `Portfolio`, `Holding`, `Transaction`, `Watchlist`, `Notification`, `User` —
  Position Summary (C6) derives from `Holding` + open orders, not new state.
- The simulation/market engine (`engine/`, `routers/market.py`, `routers/simulation.py`) already exists with a
  day-advance mechanism and simulated pricing — **read this fully before designing fill logic (C2)**. Market
  and limit order fills must be coherent with however the simulated market actually moves; do not design fill
  logic in isolation from how prices tick in this codebase.
- No chart/order-book-depth library is installed — the Order Book (C4) is a bespoke component, not a
  third-party widget.
- No margin, slippage, or buying-power logic exists anywhere today — fully greenfield (C5, C7).

---

## PART C — Feature Specifications (extreme detail)

### C1. BUY/SELL TICKET

**Route**: `/trading` (new). Layout: the ticket is the primary module (left or center column, ~360–420px
fixed width per typical trading-desk conventions — a ticket doesn't need to be fluid-width, precision over
flexibility here), with Order Book, Position Summary, and the order tables arranged around it (see C8 for full
page composition).

**Field-by-field spec:**

1. **Ticker input** — top of the ticket. Auto-uppercase (per the Inputs spec's "Specialized fields" rule),
   mono type, live match dropdown appears after 1+ characters typed (typeahead against the company/market
   search — reuse whatever search endpoint Market Explorer already uses, don't build a second one). Dropdown
   entries show ticker (mono, uppercase) + company name (`body`) + last price (mono, right-aligned) in a
   Level-3 raised surface. Selecting a result populates the ticket and triggers a live quote fetch. If the
   ticket is opened from a deep link (e.g. from Portfolio's Holdings row, or Watchlists' "Add to Portfolio"
   action from Phase 2), pre-fill this field and skip straight to the quote fetch.

2. **Live quote display** — directly below the ticker field once selected: `data-lg` mono last price, signed
   day-change ($ and %, direction glyph, market color), a breathing live-dot (per A7 ambient motion) if the
   simulated market session is open, or a "Delayed"/session-status indicator if closed (reuse the header's
   session badge component — don't build a second one).

3. **Side selector** — a two-way segmented control, "Buy" | "Sell", `body-strong` labels. This is a toggle, not
   yet the final submit buttons (those come at the bottom of the ticket, per #8) — selecting a side here
   determines which of the two market-colored buttons is primary-emphasized at the bottom and affects the
   available-quantity/buying-power context shown. Default selection: "Buy". Micro-interaction transition
   (120–160ms) between states, no color change on the segmented control itself beyond the standard selected-tab
   treatment (this control is neutral chrome — the market-color exception is reserved for the final action
   buttons only, not this selector, to avoid diluting that exception's meaning).

4. **Order type selector** — dropdown (Level-3 raised surface): Market, Limit, Stop, Stop-Limit. Changing this
   conditionally reveals/hides the Limit Price and Stop Price fields below (#6/#7) — animate the reveal as a
   height transition using the surface-transition timing (200–280ms), not an abrupt layout jump.

5. **Quantity field** — numeric, mono, right-aligned, `micro` label "QUANTITY". Stepper arrows appear on hover
   only (per Inputs spec). **Ghost text inside the field** shows the real-time notional value as the user
   types (e.g. typing "50" with a $142.30 quote shows ghost text "≈ $7,115.00" right-aligned inside the same
   field, `ink-tertiary`, smaller size) — this is spec-named behavior, implement it exactly, not as a separate
   line of text elsewhere. A "Max" ghost link inside/beside the field computes the maximum affordable quantity
   given current buying power (Buy side) or current holding quantity (Sell side) and fills the field on click.

6. **Limit Price field** (visible only when Order Type is Limit or Stop-Limit) — numeric, mono, right-aligned,
   `micro` label "LIMIT PRICE", currency prefix at 85% size/desaturated per the Inputs spec.

7. **Stop Price field** (visible only when Order Type is Stop or Stop-Limit) — same treatment, `micro` label
   "STOP PRICE".

8. **Time in Force** — a small pill selector or dropdown: Day, GTC (Good-Til-Cancelled). `micro` label "TIME IN
   FORCE". Default: Day.

9. **Buying Power / Available Shares line** — a `caption` line above the submit buttons: on Buy side, "Buying
   power: $X,XXX.XX" (mono); on Sell side, "Available: N shares" (mono). Updates live as the side selector
   changes.

10. **Estimated cost/proceeds summary** — a small raised well (one step darker/lighter than the ticket card,
    per the "raised well" pattern used elsewhere for read-back summaries) directly above the submit buttons,
    showing: Estimated Price (mono — the quote for Market orders, the entered limit for Limit orders),
    Quantity (mono), **Est. Slippage** (mono, signed, only shown for Market orders — see C5, e.g. "+$4.20
    (0.06%)"), Estimated Total (mono, `body-strong` weight, the sum). This live-updates on every field change,
    debounced (~150ms) to avoid recalculating on every keystroke.

11. **Submit buttons** — the spec's Market-action buttons, paired side-by-side at equal width, but **only the
    button matching the currently selected side (#3) is rendered as the emphasized/primary one** — recommend
    rendering only the single relevant action button (not both Buy and Sell simultaneously) sized full-width,
    since the side selector already exists above and showing both again as equal-width actions would be
    redundant with #3 and confusing (which one actually submits?). Label reads "Buy {TICKER}" / "Sell {TICKER}"
    (mono ticker inline with interface-type label). Clicking opens the confirmation modal (C3) — **the ticket
    itself never submits directly to the order-creation endpoint; the confirmation modal is the actual
    submission trigger**, per the mandatory read-back pattern.

**Validation (client-side, react-hook-form + zod, checked before the confirmation modal opens):**
- Ticker: required, must be a valid/selected symbol (not free-typed text that never matched a dropdown result).
- Quantity: required, integer > 0 (fractional shares out of scope unless confirmed otherwise with the user —
  flag this assumption), and — for Sell orders — must not exceed the currently held quantity (client-side
  pre-check; the backend re-validates authoritatively regardless, since holdings can change between page load
  and submission).
- Limit/Stop price fields: required when their order type requires them, must be > 0.
- Buying power pre-check (Buy side): estimated total must not exceed available buying power — if it does, show
  an inline amber caption under the summary well: "This exceeds your buying power by $X,XXX.XX." and disable
  the submit button (do not silently clamp the quantity — let the user see and correct the actual number).

**Empty/initial state**: before a ticker is selected, the ticket shows only the ticker input with placeholder
guidance text below it in `ink-tertiary`: "Search for a company to start a trade."

### C2. ORDER TYPE / FILL LOGIC (backend)

- **Extend the Order model** (or confirm it already covers this — read first): `id`, `user_id` FK, `ticker`/
  `company_id` FK, `side` (buy/sell), `order_type` (market/limit/stop/stop_limit), `time_in_force`
  (day/gtc), `quantity`, `limit_price` nullable, `stop_price` nullable, `status`
  (open/partially_filled/filled/cancelled/rejected), `filled_quantity` (default 0), `avg_fill_price` nullable,
  `created_at`, `updated_at`, `filled_at` nullable, `cancelled_at` nullable, `rejection_reason` nullable.
- **Market orders**: fill immediately (synchronously, within the `POST /orders` request/response cycle) at the
  current simulated price, adjusted by slippage (C5). Set `status = filled`, `filled_quantity = quantity`,
  `avg_fill_price` = simulated price ± slippage, `filled_at = now()`.
- **Limit orders**: do not fill immediately unless the limit condition is already satisfied by the current
  simulated price at submission time (a limit buy at or above current price, or a limit sell at or below
  current price, should fill immediately just like a market order would — this is standard limit-order
  semantics, not a special case). Otherwise, `status = open`, and the order becomes eligible for fill on
  subsequent price movement. **This requires the order engine to check open limit orders whenever the
  simulated price updates** (i.e. on each simulation "tick" or day-advance from Phase 4's engine) — read how
  Phase 4's day-advance mechanism actually updates prices before implementing this check, since it must hook
  into that same update path rather than polling independently. Confirm with the user whether limit-order
  checking happens on every simulated tick or only on explicit day-advance events, since this depends entirely
  on how granular the simulation engine's price updates actually are.
- **Stop / Stop-Limit orders**: a stop order converts to a market (or limit, for stop-limit) order once the
  simulated price crosses the stop price. Same tick-driven evaluation requirement as limit orders above.
- **Partial fills**: out of scope for v1 unless the simulation engine's liquidity model already supports partial
  execution — a single-user simulation against a synthesized price feed most likely fills orders atomically
  (fully or not at all) rather than partially; **confirm this assumption with the user rather than building
  partial-fill UI/logic against a backend that can't actually produce partial fills.** If confirmed unsupported,
  remove `partially_filled` from realistic status transitions in the UI (still keep it in the schema/enum for
  forward-compatibility, just don't design UI states for a status that can't occur).
- **Order cancellation**: `DELETE /orders/{id}` — only permitted while `status = open` (or `partially_filled`
  if that's real). Sets `status = cancelled`, `cancelled_at = now()`. Reject (409) if the order has already
  filled or been cancelled, with a clear error the frontend surfaces as a toast: "This order has already been
  {filled/cancelled} and can no longer be cancelled."
- **Order rejection reasons** (set `status = rejected`, populate `rejection_reason`, return 4xx): insufficient
  buying power (Buy), insufficient shares held (Sell), invalid ticker/market closed if the simulation session
  status blocks trading, quantity ≤ 0. Each maps to a specific, human-readable frontend toast message — do not
  surface raw backend error strings/stack traces to the user.

### C3. ORDER CONFIRMATION (institutional read-back pattern — mandatory)

- Triggered by the ticket's submit button (C1 #11). Modal width 420 (per the Modals spec's "confirm" width).
- **Anatomy**: padded header ("Confirm Order", ghost close icon) → divider → body → footer with right-aligned
  actions.
- **Body — the read-back well**: a raised well (one step lighter/darker than the modal surface) restating the
  trade in mono figures, row by row: Side + Ticker (`body-strong`, e.g. "Buy AAPL"), Order Type, Quantity,
  Price (limit price for limit orders, "Market" + current quote for market orders), Time in Force, Estimated
  Total (`body-strong`, mono), Est. Slippage (market orders only, mono, muted), Buying Power After (mono,
  computed: current buying power − estimated total, shown so the user sees the consequence before committing).
  This is a direct restatement of the ticket's own summary well (C1 #10) — do not introduce new copy or a
  different number format between the ticket and the modal; they must match exactly or the read-back pattern
  loses its entire purpose (catching input errors before submission).
- **Footer**: Ghost "Cancel" (left or as the secondary action) + the same market-colored action button as the
  ticket ("Buy AAPL" / "Sell AAPL", `market-up-deep`/`market-down-deep` fill) as the primary/confirming action
  — this is the second and final legitimate use of market-colored buttons in this phase, directly extending
  the ticket's exception, not a new one.
- **On confirm click**: button enters loading state (indeterminate arc, locked width) while `POST /orders`
  is in flight. On success: modal closes, a success toast appears (accent left edge, "Order filled" or "Order
  placed" depending on whether it filled immediately or is now open, with a ghost "View" action routing to the
  Open/Filled Orders table), and the relevant table (C6) gets the new row with a brief fill-flash cell
  animation if applicable. On rejection: modal stays open (do not close it and lose the user's inputs), an
  inline amber-to-red-appropriate banner appears at the top of the modal body explaining the specific
  rejection reason (reuse the backend's `rejection_reason` mapping from C2), and the confirm button re-enables
  — additionally, a toast with the market-red left edge fires (per A2/A6 — this is the one legitimate red
  toast case in the app).

### C4. ORDER BOOK

- **Use the spec's named Order Book card pattern verbatim**: mirrored mono bid/ask columns, depth shown as
  opacity-scaled horizontal bars extending from the spread outward (i.e. the bar for each price level's size
  grows the bar's opacity/length as it represents more volume, anchored at the center spread and extending
  outward on the bid side in one market color and the ask side in the other).
- **Data availability caveat — confirm before building**: since this is a simulated single-price-feed market
  (not a real exchange with genuine order-book depth from other participants), **check what the simulation
  engine can actually provide** before designing a book that implies more market-depth realism than exists.
  If the engine only produces a single simulated price (no synthesized bid/ask spread or depth-at-price-levels),
  this card needs either (a) a simple synthesized spread/depth model on the backend (e.g. a small fixed or
  volatility-scaled spread around the last price, with volume-decaying depth at a handful of price levels
  purely for visual/UX purposes, clearly understood as illustrative rather than a real market-microstructure
  simulation), or (b) descoping this card to a simpler "current bid/ask spread" display without full depth
  levels if synthesizing believable depth isn't worth the effort. **Ask the user which of these they want**
  rather than fabricating exchange-grade depth data that has no basis in the actual simulation.
- **Layout**: two mono columns (Bid | Ask), each row showing Price (mono) and Size (mono), with the
  opacity-scaled horizontal bar rendered behind/beside the size figure. Spread shown as a thin divider row
  between the two columns' innermost rows, with the numeric spread value (`caption`, `ink-tertiary`) e.g.
  "Spread: $0.02 (0.01%)".
- **Live updates**: rows update via the data-tick motion class (240ms crossfade) as simulated prices move — no
  layout-shifting row insertion/removal on every tick; if depth levels are relatively stable, prefer updating
  existing rows in place over remounting the whole table.
- **Clicking a price level** pre-fills the ticket's Limit Price field with that price (a natural, expected
  trading-desk interaction) — implement this as a direct callback into the ticket's form state, not a page
  navigation.

### C5. SLIPPAGE

- Applies to **market orders only** (limit/stop orders execute at their specified price by definition, no
  slippage concept applies to them).
- **Model**: keep the formula simple and centralized in one place — `apps/api/services/trading_service.py`, a
  single function, not scattered across the router/model. Recommended v1 formula: a small fixed basis-point
  slippage (e.g. 2–5 bps) scaled by order size relative to a configurable "typical size" threshold — orders
  below the threshold get the minimum slippage, larger orders scale up modestly. Direction: slippage always
  moves the fill price against the trader (worse for them) — buys fill slightly above quote, sells fill
  slightly below quote. Document the exact formula in a single comment at its definition site since the "why
  these specific numbers" isn't self-evident from the code alone.
- **Surfaced to the user**: in the ticket's estimated-cost well (C1 #10) and the confirmation modal's read-back
  (C3) as "Est. Slippage" — always shown before the order is placed, never a silent difference the user
  discovers only after the fact. After fill, the actual realized slippage (if it differs from the estimate due
  to price movement between quote and fill, which should be near-zero for a synchronous simulated fill but
  worth handling) is visible in the Filled Orders table's Avg Fill Price column compared against the order's
  originally quoted price.

### C6. BUYING POWER

- **v1 definition (cash-account only, per the scope recommendation)**: Buying Power = Cash Balance. Margin is
  explicitly deferred (see C7) — do not build a compound buying-power formula that includes margin capacity
  unless margin is confirmed in scope.
- **Backend**: derive from the `Portfolio` model's cash balance field (check it exists; if the current
  `Portfolio` model doesn't track a cash balance explicitly — e.g. if simulated accounts start with a fixed
  balance and only track holdings — this is a meaningful gap to flag, since buying power is meaningless without
  a real cash-balance concept. Confirm how account funding/starting balance currently works before assuming
  this field exists.)
- **Frontend**: surfaced live in the ticket (C1 #9) and available as its own small metric elsewhere if useful
  (e.g. a Position Summary card line, C8) — always mono, always currency-formatted, always right-aligned.

### C7. MARGIN

- **Explicitly recommended to defer full margin mechanics for v1** — margin trading (margin calls, maintenance
  requirements, interest accrual, buying-power multipliers) is a substantial feature in its own right and risks
  ballooning this phase. **Confirm this deferral with the user before proceeding** rather than silently
  building or silently skipping it.
- **If deferred (recommended)**: still design the ticket and Position Summary with a visible-but-disabled
  concept — e.g. a "Margin" toggle or badge in the ticket UI that's present but disabled with a tooltip "Margin
  trading is not yet available", so the information architecture doesn't need to be reworked later when margin
  does ship. This is a deliberate, minimal placeholder — not a half-built feature; do not wire any backend
  logic behind it while disabled.
- **If the user wants margin in v1 instead**: this needs to be scoped as its own detailed sub-spec before
  building (maintenance margin %, margin call trigger logic, interest accrual schedule) — treat that as a
  follow-up planning conversation, not something to improvise inline while building the rest of the ticket.

### C8. POSITION SUMMARY

- **A read model, not new state** — derives from Holdings (Phase 2's `Holding` data) filtered/joined with any
  currently open orders on the same ticker (to show "pending" exposure alongside "held" exposure).
- **Uses the spec's P&L card pattern verbatim**: realized/unrealized split, mono figures, a thin diverging bar
  centered on zero (visually showing where the position sits between max loss and max gain observed, or simply
  a zero-centered bar showing unrealized P&L sign/magnitude — keep the exact semantics simple: bar fills toward
  market-up-deep on the right of center for positive unrealized P&L, market-down-deep on the left for negative).
- **Contents**: Ticker + current quote (if a ticket is open for that ticker), Quantity Held (mono), Avg Cost
  (mono), Market Value (mono), Unrealized P&L ($ + %, signed, market color + glyph), Realized P&L (this
  position's closed-lot realized gains, $ signed, market color + glyph, mono), Open Orders on this ticker (a
  small inline list: side, quantity, type, status badge — links to the Open Orders table filtered to this
  ticker).
- **Placement**: appears in the Trading Desk layout adjacent to the ticket once a ticker is selected (see C8
  page composition) — this is contextual to whatever ticker is currently in the ticket, not a full portfolio-
  wide summary (that's Phase 2's Analytics tab).

### C9. ORDER BOOK / OPEN ORDERS / FILLED ORDERS / TRADE HISTORY — table architecture

- **One backend query shape, filtered, not four separate endpoints**: `GET /orders?status=open` (Open Orders),
  `GET /orders?status=filled` (Filled Orders), `GET /orders` with a broader/no status filter plus date-range
  params (Trade History — effectively all historical orders regardless of status, filterable). Do not build
  `/open-orders`, `/filled-orders`, `/trade-history` as three parallel routes with duplicated query logic.
- **One frontend table component, parameterized by the filter/columns needed per view** — Open Orders shows a
  Cancel action per row (ghost icon, hover-reveal, opens the cancel confirmation — Destructive-confirm pattern,
  amber fill inside the modal, never red since this is user-initiated not a rejection); Filled Orders and Trade
  History are read-only (no row actions beyond navigating to the ticker's Company Details page).
- **Columns (shared base set)**: Date/Time (mono, `caption`, `ink-tertiary`) → Ticker (mono, uppercase,
  clickable) → Side (neutral badge, "BUY"/"SELL", not market-colored — same reasoning as Phase 2's
  Transactions table: side is not itself a price direction) → Order Type → Quantity → Price (limit/stop price
  if applicable, or "Market") → Status (badge: open=accent-tinted neutral, filled=accent-tinted neutral,
  cancelled=`ink-tertiary` muted, rejected=amber-tinted — status badges are informational chrome, not market
  data, so they follow the badge color rules in A2/A6, never market green/red) → Filled Qty / Avg Fill Price
  (Filled/History views only) → Cancel action column (Open Orders view only).
  - **These tables reuse the exact Table component conventions from Phase 2** (sticky header, sortable
    chevrons, pinned first column, hairline separators, no zebra striping, hover row fill, column manager) —
    if Phase 2 has already been built by the time this phase starts, import and reuse that table component
    directly rather than reimplementing table chrome a second time.
- **Live updates**: newly filled/placed orders should appear in the relevant table without a manual refresh —
  wire this via TanStack Query's refetch-on-window-focus plus invalidating the orders query on every successful
  order submission/cancellation (simplest correct approach; true real-time push/websocket updates are a
  reasonable future enhancement but not required for v1 given this is a simulated, user-driven market rather
  than a fast-moving live one).
- **Empty states**: Open Orders — "No open orders" heading, "Orders you place will appear here until they fill
  or are cancelled." Filled Orders / Trade History — "No trade history yet", "Your filled orders will show up
  here.", secondary CTA "Place your first trade" scrolling/focusing the ticket rather than navigating away
  (the ticket is already on this same page).

### C10. Page composition (Trading Desk full layout)

Recommended layout (confirm with the user if a different arrangement is preferred, but this follows the
spec's three-pane/module-grid conventions used elsewhere in the app): Buy/Sell Ticket fixed-width column
(left) → Order Book + Position Summary stacked (center) → Open Orders / Filled Orders / Trade History as a
tabbed table module (right or full-width below, tabs using the Ledger-Line-underline pattern per A6). Every
module in this composition is independently fault-isolated (A10) — if the Order Book fails to load, the
ticket and tables remain fully usable.

---

## PART D — Strict Do-Not List (Phase 3)

- **Do NOT** use market green/red anywhere in this phase except: (a) the Buy/Sell action buttons on the ticket
  and in the confirmation modal (the spec's one explicit button exception), (b) actual price/P&L deltas and
  their direction glyphs, and (c) the order-rejection toast's left edge. Every other button, badge, and status
  indicator in this phase (side badges, status badges, cancel confirmation) uses neutral/accent/amber only.
- **Do NOT** add sound effects, confetti, 3D coin animations, or any celebratory effect on order fills — the
  spec explicitly bans this. A fill gets a cell-flash animation and a toast, nothing more.
- **Do NOT** let the ticket submit directly to `POST /orders` without going through the confirmation modal's
  read-back step — this is spec-mandated ("institutional read-back pattern"), not optional.
- **Do NOT** let the read-back modal's figures diverge from the ticket's own summary well — they must match
  exactly, or the confirmation step loses its purpose.
- **Do NOT** fabricate exchange-grade order-book depth without confirming with the user what the simulation
  engine can actually support — ask before building a book that implies more realism than exists.
- **Do NOT** build full margin mechanics (margin calls, interest accrual, maintenance requirements) without
  explicit confirmation — default to deferring margin, with a visible-but-disabled placeholder in the UI only.
- **Do NOT** build four separate endpoints/table components for Order Book/Open Orders/Filled Orders/Trade
  History — one filtered query shape, one parameterized table component.
- **Do NOT** design UI for partial fills unless the simulation engine's fill mechanism actually supports them
  — confirm first; most likely orders fill atomically in this simulated context.
- **Do NOT** silently clamp a user's entered quantity to the maximum affordable amount — show the actual amber
  over-limit message and let them correct it themselves.
- **Do NOT** skip client-side buying-power/shares-held pre-validation just because the backend re-validates —
  both layers matter (fast feedback client-side, authoritative enforcement server-side).
- **Do NOT** surface raw backend error strings or stack traces in rejection toasts — map every rejection reason
  to a specific, human-readable message.
- **Do NOT** exceed 14px border radius, use pure black/white, or add glass anywhere in this phase except the
  two confirmation modals (order confirmation, cancel confirmation).
- **Do NOT** touch Portfolio, Simulation, Dashboard, or Company Details internals beyond importing/reusing
  already-built shared components (e.g. the Table component from Phase 2, the session badge, the ticker
  typeahead if Market Explorer already has one) — this phase's file boundary is `app/trading/**`,
  `apps/api/routers/trading.py` extensions, `apps/api/services/trading_service.py`, and the relevant Alembic
  migrations for any Order-model extensions.
- **Do NOT** skip the Alembic migration for any Order-model schema changes — no manual schema edits.
- **Do NOT** ship this phase without manually placing a market order, a limit order that fills immediately, a
  limit order that stays open, a cancellation, and a rejection (e.g. by intentionally exceeding buying power)
  end-to-end in a running browser — this phase touches real (simulated) money movement and deserves the most
  thorough manual verification of any phase in this plan.

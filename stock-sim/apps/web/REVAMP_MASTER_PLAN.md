# MarketVerse Revamp — 6-Phase Master Plan

Status: **DRAFT FOR REVIEW — no code changes made yet.** Paste a phase's prompt back to begin execution of that phase.

Every phase inherits these non-negotiables. They are not repeated in full inside each phase prompt — reference them.

## Global Non-Negotiables (apply to all 6 phases)

1. **DESIGN_SPEC.md (`stock-sim/apps/web/DESIGN_SPEC.md`) is the single source of visual truth.** Meridian tokens (`mer-*` in `tailwind.config.ts`) are already wired — use them, do not invent new colors, radii, shadows, or gradients. No pure black/white, no radius above 14px, no neon glow beyond `glow-accent`, no zebra tables, no rotated axis labels, no market green/red outside price direction.
2. **JavaScript/TypeScript only, responsive and smooth.** Next.js 15 App Router + React 19 + TypeScript. Desktop-first per spec (unbounded content width), but every screen must degrade gracefully to a collapsed 64px sidebar rail at minimum — no phase may ship a layout that breaks below ~1280px without a stated plan.
3. **Motion = GSAP**, already a dependency. Follow the GSAP Motion Principles table exactly: data ticks 240ms, micro-interactions 120–160ms, surface transitions 200–280ms `cubic-bezier(0.32,0.72,0,1)`, Ledger Line draw-in 400ms, ambient loops 2–4s. Nothing bounces, overshoots, or rotates. Respect `prefers-reduced-motion`.
4. **Reuse existing infrastructure, don't reinvent it:**
   - Radix UI + shadcn/ui primitives (`components.json` already configured) for dialog, dropdown, tabs, select, tooltip, toast, avatar, separator.
   - `react-hook-form` + `zod` + `@hookform/resolvers` for all new forms — the existing auth forms use raw `useState` and should be migrated, not copied.
   - TanStack Query for all server state; do not hand-roll fetch/loading/error state per component.
   - No new chart library without explicit approval — nothing is installed yet (no recharts/visx/lightweight-charts/d3). Phase prompts below flag where a decision is needed.
5. **Backend**: FastAPI + SQLAlchemy + Alembic, monorepo at `stock-sim/apps/api` and `stock-sim/db`. New tables get an Alembic migration, never manual schema edits. New routers follow the existing `routers/<domain>.py` + `services/<domain>_service.py` split.
6. **Every module is fault-isolated** — a widget failing must show the module-level error state (spec's Error States section), never take down the page.
7. **Accessibility is mandatory, not a follow-up**: 4.5:1 contrast, direction never color-only, full keyboard model, live regions throttled to 1/3s/module.
8. **Do not touch unrelated code.** Each phase prompt states its file boundary. If a phase's work reveals a cross-cutting need (e.g., a shared `useCountdown` hook both Simulation and Trading Desk want), build it once in a shared location and note the reuse — don't duplicate, don't scope-creep into other phases' territory.
9. **After implementation**: run the code-reviewer pass, fix CRITICAL/HIGH, verify against this document's Do/Don't list for the phase, and actually exercise the feature (dev server + browser) before calling it done — per your standing instructions, type-checking is not feature verification.

---

## Current State Snapshot (context, not instructions)

Confirmed via repo audit, 2026-07-15:

- **Already Meridian-revamped**: Landing/marketing hero (WebGL), Dashboard (15-module grid), Portfolio (institutional workspace — but only as a single workspace view, not the 8 sub-sections listed below), Market Explorer (screener), Company Details (research terminal). These establish the visual precedent — match their patterns, don't reinvent card/table/chart chrome from scratch.
- **Auth is mid-revamp right now** (uncommitted changes on disk): `AuthShell`, `LoginForm`, `RegisterForm`, new `AuthInput` exist with a split-panel layout. Backend has register/login/me with JWT bearer tokens (no cookies, no refresh tokens). This is exactly Phase 1's starting point — Phase 1 continues this work, it doesn't start cold.
- **No middleware.ts exists** — there is currently no edge-level route protection. This is a real gap Phase 1 must close.
- **Trading backend** has `POST /orders` but order-type/cancel/margin semantics are unconfirmed and likely minimal — Phase 3 treats this as substantially greenfield backend work.
- **Simulation backend is further along than expected** — `Timeline`, `SimulationState`, `MarketEvent`, `EventInstance`, `NewsTemplate`, `NewsFeed` models and an `engine/` directory already exist with day-advance and admin event injection. Phase 4 is more frontend-weighted than the others.
- **AI backend is fully greenfield** — zero LLM integration anywhere in the codebase today.
- **Settings backend is fully greenfield** — no preferences/notification/profile endpoints exist.

---

# PHASE 1 — Authentication

## Master Prompt

```
Continue the in-progress Meridian revamp of authentication in stock-sim/apps/web. AuthShell, LoginForm,
RegisterForm, and AuthInput already exist with a split-panel layout (market-pulse hero left, form right) —
read them first and preserve that pattern rather than rebuilding from scratch. Backend already has
POST /auth/register, POST /auth/login, GET /auth/me with bcrypt + JWT bearer tokens (apps/api/auth.py,
routers/auth.py) — extend it, don't replace it.

Build, in this order:

1. FORGOT PASSWORD flow
   - Frontend: /forgot-password page (AuthShell variant, single email field), a "check your email" confirmation
     state, and a /reset-password?token=... page (new password + confirm, same validation rules as register).
   - Backend: POST /auth/forgot-password (always returns 200 regardless of whether the email exists — no user
     enumeration), generates a short-lived signed reset token (reuse the JWT infra with a distinct `type: "reset"`
     claim and ~15min expiry, or a separate token table if you want revocability — pick one and justify it in a
     one-line comment only if the reasoning is non-obvious). POST /auth/reset-password validates token, updates
     password hash, invalidates the token (single-use).
   - Email delivery: there is no email service in this codebase yet. Stub it behind a clearly named interface
     (e.g. services/email_service.py with a send_password_reset(to, token) function) that logs to console/dev
     in local env — do not wire a real provider (SendGrid/SES/etc) without asking, that's a credential/cost
     decision for the user.

2. OTP (two-factor / step-up verification)
   - Scope this as email-based OTP for now (no SMS provider decision without asking). Add an `otp_codes` table
     (Alembic migration) — user_id, code_hash, purpose (login|register|reset), expires_at, consumed_at.
   - Backend: POST /auth/otp/request, POST /auth/otp/verify. Rate-limit via the existing rate_limiter.py —
     do not build a second rate-limiting mechanism.
   - Frontend: a 6-digit segmented OTP input component (new, in components/auth/) — auto-advance per digit,
     paste-to-fill, resend-with-cooldown (ghost button, disabled + mono countdown per spec's "Timestamps are
     mono, caption size" rule). This is a natural moment to also build a reusable OTPInput since none exists.
   - Decide with the user whether OTP is mandatory post-registration or opt-in via Settings (Phase 6 territory)
     before wiring it into the main login flow — don't silently make it mandatory.

3. SESSIONS
   - Current JWT is a single long-lived bearer token with no refresh and no revocation — that's a real gap.
     Add refresh tokens: short-lived access token + longer-lived httpOnly-cookie refresh token (do NOT store
     the refresh token in localStorage — that's the whole point of this change). New table `sessions` or
     `refresh_tokens` (device/user-agent, issued_at, expires_at, revoked_at) so "sign out of this device" and
     "sign out everywhere" are real operations, not fiction.
   - Backend: POST /auth/refresh, POST /auth/logout (revokes current session), POST /auth/logout-all.
   - Frontend: a Sessions panel is Phase 6 territory (Settings) — here you're only building the underlying
     mechanism and the silent-refresh interceptor in the API client (lib/api/client.ts — read it first, don't
     assume its shape) so an expiring access token refreshes transparently instead of bouncing the user to
     /login mid-session.

4. PROTECTED ROUTES
   - Add apps/web/middleware.ts (this file does not exist yet — confirmed gap). Gate all authenticated routes
     (/dashboard, /portfolio, /market, /companies/*, trading, simulation, ai, settings) at the edge: check for
     a valid session cookie/token, redirect unauthenticated requests to /login?redirect=<original path>, and
     redirect already-authenticated users away from /login and /register to /dashboard.
   - Do this at the edge, not just client-side in AuthContext — client-only gating flashes protected content
     before redirecting, which is both a UX and security smell.

DESIGN — apply DESIGN_SPEC.md precisely:
- AuthShell's split panel is already established — new pages (forgot-password, reset-password) must reuse it,
  not introduce a new auth layout.
- OTP input: `data` mono type, tabular, each digit in its own well (bg one step darker, inset shadow, hairline,
  radius-sm per Inputs spec) — this is a numeric input, treat it like one.
- Error/validation states: amber caption line below the field per spec, never red (red is market-only).
- Success states (email sent, password reset): use accent color, never market green — spec explicitly bans
  "saturated consumer-green success UI."
- Loading: button label swaps for the 14px indeterminate arc, button width locked — do not let buttons resize
  while submitting.
- Toasts for async confirmations (password reset email sent, session revoked) per the Toasts spec — bottom-right,
  max 3, 5s auto-dismiss, accent/amber/market-red-for-rejections-only semantics.

DO:
- Reuse AuthShell, AuthInput, the existing AuthContext, and the existing API client — extend, don't fork.
- Migrate LoginForm/RegisterForm to react-hook-form + zod while you're in this code, since you're already
  touching validation logic for reset/OTP forms and consistency matters more than leaving it half-migrated.
- Make token refresh silent and invisible to the user in the common case.
- Write the Alembic migrations for every new table.

DON'T:
- Don't wire a real email or SMS provider without asking — stub behind an interface.
- Don't store refresh tokens in localStorage/sessionStorage.
- Don't make protected-route checks client-side-only.
- Don't invent a second rate-limiter — extend rate_limiter.py.
- Don't touch Dashboard/Portfolio/Market Explorer/Company Details internals — this phase is auth + the shell-
  level middleware.ts only.

ADDED SCOPE beyond your list (flag for approval, don't build silently):
- Refresh-token session mechanism (your "Sessions" item implies this, but it's a meaningfully sized addition
  worth calling out explicitly before starting).
- Email service stub interface (needed for both Forgot Password and future notification work in Phase 6 —
  build it once, reusably).
- Reusable OTPInput component — will likely get reused if 2FA ever extends beyond auth (e.g. confirming a
  large trade in Phase 3 could plausibly want a step-up check; not in scope now, just noting the reuse path).
```

---

# PHASE 2 — Portfolio

## Master Prompt

```
The Portfolio route (stock-sim/apps/web/app/portfolio/) was already revamped into "an institutional management
workspace" (commit 279d594) — read the existing implementation first. This phase does NOT redo that work; it
expands it into the full 8-section structure the spec implies but the current single-workspace view doesn't
yet fully cover: Holdings, Transactions, Performance, Allocation, Analytics, Dividend History, Watchlists, Goals.

Structure this as a tabbed sub-navigation under /portfolio (ghost tab row, Ledger Line active-tab underline,
per spec's Tabs component — sticky below the page identity bar on scroll, matching the Company Details tab
pattern from commit 85c7a23). Each tab is a route: /portfolio/holdings, /portfolio/transactions,
/portfolio/performance, /portfolio/allocation, /portfolio/analytics, /portfolio/dividends,
/portfolio/watchlists, /portfolio/goals — or parallel routes/intercepting routes if that fits Next.js App
Router better than full page loads per tab; your call, but tab switches must feel instant (no full-page
loading skeleton flash on every tab click — prefetch or share layout state).

Per section:

1. HOLDINGS — table per spec's Tables component: sticky header, ticker+name pinned column with scroll scrim,
   sparkline column (96x24px), delta cells with signed value + direction glyph, row selection (2px accent
   left edge), column manager behind ghost icon. Backend: GET /portfolio already exists — check if it returns
   enough (cost basis, unrealized P&L, weight %) or needs extending.

2. TRANSACTIONS — list/table of historical fills. Backend: GET /transactions already exists — verify its
   shape covers filter/sort needs (date range, ticker, side, type) before adding query params.

3. PERFORMANCE — hero-style chart (full-bleed, spec's Charts section: accent price line, gradient fill,
   range selector ghost pills 1D-5D-1M-6M-YTD-1Y-5Y-MAX) showing portfolio value over time vs. a benchmark
   (comparison mode: normalized % change, floating glass legend). CHART LIBRARY DECISION NEEDED: no chart lib
   is installed (no recharts/visx/lightweight-charts). Flag this to the user before picking one — Dashboard/
   Company Details apparently hand-rolled their charts; confirm whether to match that (SVG/Canvas, full control,
   more code) or introduce a library now that Portfolio needs comparison-mode overlays (faster, one more dep).

4. ALLOCATION — sector/asset-class breakdown. Use the diverging/categorical ramp per spec (max 6 categorical
   series: cobalt/slate/iris/warm-gray/amber/teal) — a treemap or donut, not an arbitrary-hue pie chart.

5. ANALYTICS — risk/return metrics (beta, Sharpe, volatility, drawdown) as a metric-card grid (eyebrow →
   data-lg value → delta line → sparkline footer, per Card grammar). Backend: GET /portfolio/analytics exists
   — check its current metric set against what's needed here.

6. DIVIDEND HISTORY — use the spec's named "Dividend tracker" card pattern verbatim: ex-date timeline on a
   hairline with amount chips. Backend: no dividend endpoint confirmed to exist — check db/models for a
   Dividend model; if absent, this needs a new table + endpoint (dividends are typically derived from
   holdings + a corporate-actions data source — confirm with the user whether dividend data exists anywhere
   in the market data model before building UI against nothing).

7. WATCHLISTS — backend already has full CRUD (GET/POST/DELETE /watchlist) and a Dashboard "Watchlist Dock"
   already exists as a compact rail widget — this section is the full-page expansion of that same data,
   reusing its row component rather than rebuilding ticker rows from scratch. Support multiple named
   watchlists if the backend model allows it (check the Watchlist model's shape first).

8. GOALS — fully greenfield, no backend model exists. This is a real feature, not just UI: users set a target
   (e.g. net worth by date, or a return %), and the app tracks progress. Needs a new Goal model (user_id,
   type, target_value, target_date, created_at) + CRUD endpoints + a progress-ring or progress-bar card. Keep
   the first version simple — one goal type (target portfolio value by date) rather than a generalized goals
   engine, per YAGNI. Confirm this scope with the user before over-building it.

DESIGN:
- Every section is composed from the spec's three card grammars (Metric / List / Chart) — don't invent new
  card shapes per section.
- Tab row sticks below the identity bar, matches Company Details' established pattern exactly.
- No zebra striping, no rotated axis labels, decimal-aligned mono figures everywhere numbers stack vertically.

DO:
- Read the existing /portfolio implementation fully before adding anything — reuse its data-fetching hooks,
  layout shell, and any card components it already built.
- Reuse the Dashboard's watchlist row and sparkline components rather than duplicating them.
- Ask before adding a charting library — this is the first phase that actually needs one for comparison
  overlays.

DON'T:
- Don't rebuild Holdings/Transactions from zero if the existing workspace view already has usable table logic
  — extract and reuse.
- Don't invent a generalized "goals engine" — one goal type, shipped simply, beats a speculative framework.
- Don't build Dividend History against fabricated data — confirm the data source exists first.

ADDED SCOPE beyond your list:
- Goals needs a genuinely new backend model — flagging so it's not underestimated as "just a progress bar."
- Dividend History likely needs new backend work too (corporate actions data) — flagging the same way.
- Multiple named watchlists (vs. a single implicit one) — worth confirming as in-scope since it's a natural
  extension of existing CRUD and materially more useful than one flat list.
```

---

# PHASE 3 — Trading Desk

## Master Prompt

```
Build a professional order-entry "Trading Desk" — this is substantially new surface area, both frontend and
backend. Current backend has only POST /orders with unconfirmed type/cancel/margin semantics — treat the
order engine as mostly greenfield and confirm/extend rather than assuming capability that isn't there. Read
apps/api/routers/trading.py and db/models/trading.py fully first to know exactly what exists before writing
a single new line.

BACKEND — order engine:
1. Extend the Order model (or confirm/extend it) to support: order type (market, limit, stop, stop-limit),
   time-in-force (day, GTC), status (open, filled, partially_filled, cancelled, rejected), side (buy/sell),
   quantity, limit_price, stop_price, filled_quantity, avg_fill_price, created_at, updated_at.
2. Endpoints: POST /orders (extend existing), DELETE /orders/{id} (cancel — only if still cancellable),
   GET /orders?status=open|filled|cancelled (order book / open orders / filled orders / trade history are
   all this endpoint with different filters — don't build four endpoints for one query shape).
3. Matching/fill logic: this is a simulation, so fills happen against the simulated market price from the
   existing market/simulation engine (engine/, routers/market.py) — market orders fill immediately at
   current simulated price; limit orders fill when the simulated price crosses the limit (check how price
   ticks/advances currently work via the simulation engine before designing this — Phase 4's day-advance
   mechanism is directly relevant here, so read that code too).
4. SLIPPAGE: model a small configurable slippage on market orders (e.g. basis points of order size vs.
   available liquidity) — keep the formula simple and documented in one place (services/trading_service.py),
   not scattered.
5. BUYING POWER / MARGIN: buying power = cash balance + (if margin enabled) margin capacity. Decide with the
   user whether margin trading is in scope for v1 or explicitly deferred — it's a meaningfully complex
   feature (margin calls, maintenance requirements, interest accrual) that could easily balloon this phase.
   Recommend: ship cash-account buying power first, stub margin as a visible-but-disabled UI concept, and
   treat full margin logic as a follow-up once cash trading is solid.
6. POSITION SUMMARY: derived from Holdings (Phase 2 territory) + open orders — a read model, not new state.

FRONTEND — apps/web/app/trading/ (new route):
1. BUY/SELL TICKET — the spec's Buttons component defines this exactly: "Market actions: Buy market-up-deep
   fill / Sell market-down-deep fill — the only buttons permitted to use market colors, always paired
   side-by-side at equal width." Ticket includes: ticker input (auto-uppercase, live match dropdown per
   Inputs spec), order type selector, quantity/price fields showing real-time notional value as ghost text
   inside the field (spec explicitly calls this out), buying power display, estimated cost/proceeds.
2. ORDER CONFIRMATION — spec mandates the "institutional read-back pattern": modal restates the trade in a
   raised well with mono figures before submission. This is not optional polish, it's specified behavior —
   implement it as a real confirm step, not a toast-and-done.
3. ORDER BOOK — spec's named card type: "mirrored mono bid/ask columns, depth shown as opacity-scaled
   horizontal bars from the spread outward." Since this is simulated (not a real exchange), the "book" is
   likely synthesized from the simulation engine's price/volatility model — confirm what data is actually
   available before designing a book that implies more market depth realism than the sim provides.
4. OPEN ORDERS / FILLED ORDERS / TRADE HISTORY — one table component, three filtered views (per backend
   endpoint above), following the standard Tables spec.
5. SLIPPAGE / BUYING POWER / MARGIN — surfaced in the ticket itself (live-updating as quantity/price change)
   and in a Position Summary card (P&L card pattern: realized/unrealized split, mono figures, diverging bar
   centered on zero).
6. CONFIRMATION DIALOGS — order cancellation and any destructive action uses the Destructive-confirm button
   pattern (ghost at rest, fills warn amber inside the modal — never market red for a cancel action, red is
   reserved for order *rejections* specifically per the Toasts spec).

DESIGN:
- This is the highest-density screen in the app — lean into Compact density mode by default here, data-sm
  mono type, 28px rows.
- Order rejections are the one case toasts may use market-red — everywhere else in this phase, rejections/
  errors use amber, per spec.
- No sound, no confetti, no 3D coin effects on fills — spec explicitly bans celebratory effects on trades.
  A filled order gets a price-flash-style cell animation (8% market-color tint, 800ms decay) and a toast, and
  that's the full extent of the "reward" — this is an instrument panel, not a game.

DO:
- Read the simulation engine's price-tick model before designing limit-order fill logic — the fill mechanism
  must be coherent with how the simulated market actually moves (see Phase 4).
- Treat Order Book/Open Orders/Filled/Trade History as one data source with different filters, not four
  parallel implementations.
- Confirm margin scope before building it — recommend deferring full margin mechanics.

DON'T:
- Don't fabricate market depth for the Order Book beyond what the simulation engine can actually justify.
- Don't skip the read-back confirmation modal — it's spec-mandated, not optional.
- Don't use market-red for anything except the numeral/glyph on negative deltas and order rejections.
- Don't build full margin-call/interest-accrual logic without explicit sign-off — likely out of scope for v1.

ADDED SCOPE beyond your list:
- Order cancellation (DELETE /orders/{id}) — implied by "Open Orders" existing as a concept but worth calling
  out explicitly as new backend work.
- A single filtered-query order endpoint design decision, to avoid four redundant endpoints.
- Explicit recommendation to scope margin down for v1 — flagging so it's a decision, not a silent omission.
```

---

# PHASE 4 — Simulation

## Master Prompt

```
Simulation backend is further along than the other phases — Timeline, SimulationState, MarketEvent,
EventInstance, NewsTemplate, NewsFeed models already exist, plus routers/simulation.py (POST /advance,
POST/GET /timelines, GET /state, admin POST /admin/events, PUT/GET /admin/config) and an engine/ directory.
Read all of this fully before writing anything — this phase is more frontend-weighted than Trading Desk or
AI Workspace, and duplicating existing engine logic on the frontend would be a mistake.

Build, at apps/web/app/simulation/ (new route):

1. TIMELINE — visual representation of GET /timelines + GET /state: a horizontal timeline showing simulated
   days, with markers for events (from EventInstance) and news (NewsFeed) plotted at their simulated date.
   Mono date labels, hairline axis, per Charts spec conventions even though this isn't a price chart.

2. ADVANCE DAY — the control that calls POST /advance. This is a significant state transition (prices move,
   events may fire, news may generate) — treat it with the same weight as an order submission: a clear
   primary action, a loading state that doesn't let the user double-fire it (lock the control, not just the
   button label), and a summary of what changed after advancing (price deltas, new events, new news) rather
   than silently refreshing data underneath the user.

3. MACRO VARIABLES — check what PUT/GET /admin/config actually exposes (rates, inflation, sentiment, whatever
   the engine models) and surface the current values as a metric-card row. If admin/config is genuinely
   admin-only, this section may need a read-only non-admin GET endpoint added — don't expose admin mutation
   routes to regular users; add a scoped read endpoint if one doesn't exist.

4. EVENTS — list/timeline of MarketEvent/EventInstance, using the spec's Economic calendar card pattern
   (day-grouped rows, amber impact dots 1-3, actuals flash on release) since that's the closest existing
   pattern to "macro event calendar."

5. NEWS — use NewsFeed data with the spec's editorial serif (Tiempos) for headlines per the typography table
   ("News headlines, long-form analysis" is explicitly Tiempos' job) — this is the one area outside Company
   Details' About section and AI cards where editorial serif is correct to use.

6. RIPPLE EFFECTS — this term isn't backed by an existing model name; clarify with the user whether this means
   (a) a visualization of how one event cascades into correlated price movements across sectors/companies
   (in which case it likely reuses the spec's Correlation matrix card — diverging-ramp opacity grid with
   crosshair highlight), or (b) something engine-side (event chains that trigger further events) that may
   already partially exist in engine/ and just needs surfacing. Don't build a guessed interpretation of a
   named-but-undefined feature.

7. FUTURE LAB — appears to be a forward-looking "what if" projection tool, distinct from the historical
   Timeline. Clarify scope: is this Monte Carlo-style projection from current state, or manual scenario
   authoring (set macro variables, advance N simulated days in a sandbox, see outcome without affecting the
   real timeline)? The latter is more buildable given the existing engine and ties directly into #8 below —
   recommend that interpretation unless the user means something else.

8. SCENARIO COMPARISON — depends on Future Lab existing: run/save multiple hypothetical trajectories and
   compare them side-by-side using the Charts spec's comparison mode (normalized % change, categorical ramp
   per series, floating glass legend). Needs a way to persist a scenario run (new lightweight table, or reuse
   Timeline if its schema already supports branching/forking — check before adding a new one).

9. SIMULATION CONTROLS — a persistent control rail/panel: current simulated date, session/market status badge
   (OPEN/PRE/CLOSED per spec's session badge pattern), advance-day trigger, speed/pace setting if the engine
   supports variable-rate advancement, and a link into Macro Variables. This is likely the module that
   anchors the whole Simulation page, similar to how Portfolio Pulse anchors Dashboard.

DESIGN:
- Advance Day is the single primary action on this page — one primary button, everything else is secondary/
  ghost, per spec's "one primary action per view" rule for the Primary button variant.
- Event/news timelines use hairlines + amber impact dots, not colored backgrounds — don't let this page turn
  into a calendar app with colored blocks.
- Live/ambient signals: if the simulation clock is "ticking" even between manual advances, show that with the
  spec's breathing live-dot — but don't fake continuous motion if the engine only moves state on explicit
  Advance Day calls; false liveness violates "no stale data presented as if it were live" in spirit.

DO:
- Read engine/ and routers/simulation.py completely before designing Future Lab/Ripple Effects/Scenario
  Comparison — these three depend entirely on what the engine can actually do today.
- Ask for clarification on "Ripple Effects" and "Future Lab" before building — they're named features without
  a clear existing backend counterpart, and guessing wrong here wastes real backend work.
- Reuse the Correlation matrix and Economic calendar card patterns rather than inventing new ones.

DON'T:
- Don't build a second event-calendar visual language when the spec already defines one.
- Don't let Advance Day be double-firable — lock the control during the request.
- Don't fabricate simulated "liveness" between explicit day-advances.

ADDED SCOPE beyond your list:
- A non-admin read-only macro-config endpoint, since the existing PUT/GET /admin/config is admin-scoped and
  regular users need to *see* macro variables without being able to *set* them.
- Scenario persistence (a way to save/name/retrieve a Future Lab run) — implied by "Scenario Comparison"
  needing something to compare, worth confirming as in-scope.
```

---

# PHASE 5 — AI Workspace

## Master Prompt

```
Fully greenfield — zero LLM integration exists anywhere in this codebase today (confirmed: no openai/
anthropic/llm/gpt/claude references in apps/api). This phase builds both the backend integration and the
frontend workspace.

BACKEND:
1. Provider choice: use the Claude API (Anthropic) — this is the natural default for a Claude Code-managed
   project, and the claude-api skill/reference is available for model IDs, streaming, and tool-use patterns.
   Confirm the actual model choice and API key provisioning with the user before writing code — API keys are
   a credential decision, not something to default silently. Do not hardcode a key; use environment variables
   validated at startup per the security rules already in force in this project.
2. New router apps/api/routers/ai.py + apps/api/services/ai_service.py. Streaming responses (SSE) for chat-
   style interactions — FastAPI supports StreamingResponse natively, use that rather than polling.
3. Six capabilities map to six focused endpoints/prompt templates, not one do-everything endpoint:
   - AI CHAT — general assistant, freeform, context-aware of the user's portfolio/session if relevant.
   - PORTFOLIO REVIEW — takes the user's current Holdings/Analytics (Phase 2 data) as structured context,
     returns a narrative review. Ground every claim in the actual portfolio data passed in — no fabricated
     numbers.
   - COMPANY REVIEW — same pattern using Company Details data (financials, key stats, news).
   - EXPLAIN METRICS — short-form, takes a specific metric name + value + company/portfolio context, returns
     a plain-language explanation. This is the natural backend for the spec's "Definition tooltips" (dotted-
     underlined financial terms) — reuse this endpoint there rather than building a second explain-a-term path.
   - EXPLAIN NEWS — takes a NewsFeed item (Phase 4 data) as context, returns a summary/implication.
   - STRATEGY BUILDER — more open-ended, likely multi-turn (user describes goals/constraints, AI proposes an
     approach). This is the most complex of the six — scope its v1 narrowly (e.g. a single-turn strategy
     suggestion based on stated risk tolerance + goals, not a full conversational planning agent) and confirm
     with the user before over-building.
   - MARKET ASSISTANT — general market Q&A, likely overlaps heavily with AI Chat; consider whether this is a
     distinct endpoint or a system-prompt variant of Chat scoped to market-wide (vs. portfolio-specific)
     questions — don't build two nearly-identical chat endpoints if one parameterized one covers both.
4. Cost/rate control: add basic per-user rate limiting on AI endpoints via the existing rate_limiter.py — LLM
   calls cost real money per request, this isn't optional the way it might be for other endpoints.
5. Every AI response that makes a factual claim about the user's data must be traceable to the source data
   passed into the prompt — this directly serves the spec's "every claim traceable to a source" rule for AI
   cards, so design the prompt/response contract to include citations/evidence references from the start,
   not bolted on later.

FRONTEND — apps/web/app/ai/ (new route) + reusable AI card components used elsewhere (Dashboard already has
an "AI briefing" module per the dashboard grid diagram — extend that same card pattern here, don't create a
second AI visual language):
1. Follow the spec's AI card pattern EXACTLY — it's fully specified, not open to interpretation: 2px iris
   top edge, header badge (✦ glyph + "AI BRIEFING"-style label + confidence chip), header strip is glass (one
   of the five allowlisted glass surfaces), body in Tiempos editorial serif, tappable evidence-source chips,
   NEVER market green/red in its own chrome (may only quote colored deltas inside evidence chips).
2. AI CHAT — a chat interface that still obeys Meridian: no bubble-chat consumer-app styling with rounded
   colorful bubbles. Use the AI card grammar for AI messages, standard body type for user messages, mono
   timestamps, streaming text render (token-by-token) tied to the SSE backend — but keep the motion calm,
   this is a data channel not a typing-indicator show.
3. PORTFOLIO REVIEW / COMPANY REVIEW / EXPLAIN NEWS — surfaced as AI cards embedded contextually (a "Review"
   action on the Portfolio page opens this in an AI card, not a separate disconnected page) as well as
   accessible from the central AI Workspace.
4. EXPLAIN METRICS — wire directly into the spec's Definition tooltip component (dotted-underlined terms
   throughout the app) — this is the one AI capability that should NOT live only in the AI Workspace, it
   should be ambient wherever a financial term appears.
5. STRATEGY BUILDER / MARKET ASSISTANT — workspace-native views, likely multi-panel (input/constraints on one
   side, AI output as cards on the other).
6. Every AI-generated block carries the ✦ badge and evidence chips — the spec bans unlabeled AI content
   outright, this isn't a nice-to-have.

DESIGN:
- The `ai` iris color (#8B7CF6) is reserved exclusively for AI content markers — never as a general UI fill,
  never reused for anything non-AI.
- AI sentiment glyphs (▲ ▽ ◇ in iris outline) always ship with a definition tooltip explaining the judgment —
  they're labeled machine opinion, never styled as if they were market data.
- Confidence chips are a labeled, honest signal — don't fabricate false precision (e.g. "94% confidence") if
  the underlying model call has no calibrated confidence score; use a coarser label (high/medium/low) unless
  the provider actually returns something numeric and meaningful.

DO:
- Ground every AI response in real structured data passed into the prompt, with source attribution designed
  into the response contract from day one.
- Reuse Dashboard's existing AI briefing card as the starting pattern rather than reinventing AI card chrome.
- Confirm model/provider/API key handling with the user before writing integration code.
- Wire Explain Metrics into definition tooltips app-wide, not just inside the AI Workspace.

DON'T:
- Don't hardcode API keys or default to a provider choice without confirmation.
- Don't build six fully separate, redundant chat-shaped endpoints — parameterize where capabilities genuinely
  overlap (Chat vs. Market Assistant especially).
- Don't fabricate confidence scores or unsourced claims.
- Don't skip rate limiting on AI endpoints — these have real per-call cost.
- Don't style AI chat as a consumer bubble-chat UI.

ADDED SCOPE beyond your list:
- Explain Metrics wired into the app-wide Definition tooltip component, not confined to the AI Workspace page
  — this is a much more useful shipped feature than a standalone "explain metrics" page nobody navigates to.
- A citation/evidence-chip contract baked into every AI endpoint's response shape from the start, since the
  design spec requires it and retrofitting it later touches every prompt template again.
```

---

# PHASE 6 — User Settings

## Master Prompt

```
Fully greenfield backend — no preferences/notification/profile endpoints exist today. Build both backend and
frontend.

BACKEND:
1. New table `user_preferences` (Alembic migration): user_id (FK, unique), theme (dark/light, default dark
   per spec's "Terminal" default), density (comfortable/compact), notification_settings (jsonb — keep this
   flexible since notification types will grow), keyboard_shortcuts_overrides (jsonb, optional per-user
   rebinding), accessibility_settings (jsonb — reduced_motion override, font_size, etc), updated_at.
2. Endpoints: GET /users/me/preferences, PATCH /users/me/preferences (partial update). Keep it one row per
   user with a flexible jsonb payload rather than a rigid column-per-setting schema that requires a migration
   every time a new preference ships — this is exactly the kind of setting surface that grows over time.
3. PROFILE: extend the existing User model/GET /auth/me if display name/avatar/email aren't already fully
   editable — check current User model fields first. Add PATCH /users/me for profile fields, and a separate
   PATCH /users/me/password (requires current password confirmation) rather than folding password change
   into the general profile update.
4. SESSIONS panel (this is where Phase 1's session/refresh-token mechanism actually gets surfaced to the
   user): GET /users/me/sessions (list active sessions with device/user-agent/last-active), DELETE
   /users/me/sessions/{id} (revoke one), DELETE /users/me/sessions (revoke all but current). This endpoint
   only makes sense if Phase 1 built real session records — confirm Phase 1 is complete before starting this
   part, otherwise there's nothing to list.

FRONTEND — apps/web/app/settings/ (new route), tabbed sub-nav (ghost tabs + Ledger Line, same pattern as
Portfolio's Phase 2 tabs and Company Details):

1. PREFERENCES — general app behavior settings (default landing page, default chart range, etc. — keep v1
   narrow, this can grow).
2. NOTIFICATIONS — toggle groups for notification categories (price alerts, order fills, news, AI briefings)
   — reuse the spec's badge/toggle patterns, not raw checkboxes; this feeds the notification_settings jsonb.
3. APPEARANCE — theme toggle (dark "Terminal" / light "Research Desk" — both are fully speced, this isn't
   greenfield design, just wiring the toggle to persisted preference), density toggle (Comfortable/Compact,
   already spec'd and apparently used at the header level elsewhere — this page should be the canonical place
   it's also settable, with the header toggle as a quick-access mirror of the same state).
4. KEYBOARD SHORTCUTS — a reference list of existing shortcuts (⌘K command palette, table row navigation,
   chart focus shortcut) at minimum; per-shortcut rebinding is a bigger feature — confirm with the user
   whether v1 needs actual rebinding UI or just a reference/cheat-sheet view. Recommend shipping the reference
   view first since it requires zero backend changes beyond what's already scoped, and treating rebinding as
   a clearly separate follow-up.
5. ACCESSIBILITY — reduced motion override (independent of OS-level prefers-reduced-motion, since some users
   want to force it regardless of system setting), font-size preference, high-contrast toggle if the design
   system can support one without breaking Meridian's token system (check before promising this — a true
   high-contrast mode may need its own token overrides, which is a bigger lift than a simple toggle implies).
6. PROFILE — display name, email (with re-verification if changed, ties back to Phase 1's email/OTP infra),
   avatar, password change (separate form, current-password-required), and the Sessions list from the backend
   section above.

DESIGN:
- This page is pure interface chrome with no live market data — resist the urge to add decorative motion or
  gradients here "to match the rest of the app." Quiet surfaces, standard form patterns, Inputs/Dropdowns/
  Tabs components exactly as specced. Settings pages are where restraint matters most.
- Toggles/switches: check if Radix's Switch primitive is already available via the existing Radix set: if not
  already in package.json, adding it here is reasonable (it's a standard Radix primitive, consistent with the
  rest of the already-adopted set) — don't hand-roll a toggle.
- Theme toggle must apply instantly and persist — no flash of wrong theme on reload (check how theme state
  hydrates on first paint; this is a common SSR/hydration pitfall in Next.js and worth testing explicitly).

DO:
- Use a flexible jsonb payload for preferences/notifications rather than rigid columns.
- Confirm Phase 1's session mechanism is actually in place before building the Sessions panel against it.
- Reuse Radix Switch/Dialog/Tabs rather than custom-building settings-page primitives.
- Test theme persistence across a hard reload, not just in-session toggling.

DON'T:
- Don't add decorative motion to this page — it's the one place in the app with zero live data justifying it.
- Don't build keyboard-shortcut rebinding without confirming it's actually wanted for v1 — a reference view
  is much cheaper and may be sufficient.
- Don't promise a full high-contrast theme without checking what that actually requires in the token system.

ADDED SCOPE beyond your list:
- Password change as its own confirmed-current-password flow, separate from general profile edits — a
  standard security practice worth calling out since your list said "Profile" generically.
- Sessions management UI, since Phase 1's refresh-token work only becomes user-visible/useful once it's
  surfaced here — flagging the dependency explicitly.
```

---

# What Else I'd Flag (cross-phase, not asked for but worth knowing)

- **No middleware.ts exists at all today** — every phase after Phase 1 assumes route protection exists. If
  Phase 1 doesn't ship the edge middleware, every subsequent phase is building authenticated-feeling pages
  that aren't actually gated. Recommend treating Phase 1's middleware.ts as a hard prerequisite gate before
  starting Phase 2.
- **No chart library is installed anywhere in this repo**, despite Dashboard/Portfolio/Company Details already
  shipping charts (they're apparently hand-rolled SVG/Canvas, possibly leaning on the already-installed
  `three`/`@react-three/fiber` for the WebGL hero specifically, not for 2D financial charts). Phase 2
  (Performance/Allocation comparison mode) is the first place this decision can't be deferred further —
  recommend resolving the "hand-roll vs. adopt a library" question once, explicitly, rather than each phase
  guessing independently.
- **Order-of-operations dependency chain worth being explicit about**: Phase 1 (middleware) → Phase 2
  (Holdings/Analytics data that Phase 3's Position Summary and Phase 5's Portfolio Review both consume) →
  Phase 3 and Phase 4 can run in parallel (Trading Desk's fill logic depends on Phase 4's price-tick model,
  but the two aren't otherwise blocking) → Phase 5 (AI Workspace, consumes Portfolio/Company/News data from
  2 and 4) → Phase 6 (Sessions panel specifically depends on Phase 1's refresh-token mechanism). Suggest
  running them roughly in this order rather than the numeric order if backend dependencies matter more than
  the list's original sequence — happy to keep numeric order if you prefer, just flagging the real dependency
  graph.
- **"Ripple Effects" and "Future Lab"** (Phase 4) are named in your list without corresponding backend
  concepts today — these need a short clarifying conversation before that phase starts, not a guess.
- **Margin trading** (Phase 3) and **keyboard shortcut rebinding** (Phase 6) are both scoped down in the
  prompts above with an explicit recommendation to defer the harder version — flagging both here since
  they're the two places I most likely under-scoped relative to what "professional" might imply, on purpose,
  to avoid over-building speculative complexity per YAGNI.
```

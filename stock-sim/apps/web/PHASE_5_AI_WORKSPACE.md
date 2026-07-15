# PHASE 5 — AI Workspace — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one.

**This phase is fully greenfield on the backend — zero LLM integration exists anywhere in this codebase
today.** Confirm model/provider/API-key handling with the user before writing any integration code — this is
explicitly flagged throughout Part C, not a detail to decide unilaterally.

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome recedes to near-invisibility; only market/user data — and, in
this phase specifically, clearly-labeled AI-generated content — carries color, motion, and visual weight.

The Five Laws:
1. Data is the only decoration.
2. One accent color everywhere — green/red belong exclusively to market direction. **The `ai` iris color
   (`#8B7CF6`) is this phase's one additional reserved color**, and it is reserved exclusively for AI content
   markers — never a general fill, never reused for anything non-AI.
3. Ink on glass — every surface behaves like a physical material.
4. Numbers are typography's first citizens.
5. The interface never sleeps and never shouts — this phase must resist the temptation to over-animate a chat
   interface (typing indicators, bouncing dots, etc.) beyond what the spec's calm motion table allows.

**Ledger Line** — 1px luminous accent hairline. In this phase it appears as the active-tab marker if the AI
Workspace uses tabs, and as the focused-module edge — it does **not** replace or compete with the AI card's own
2px iris top edge (see A6), which is a distinct, separately-specified treatment.

### A2. Color rules (non-negotiable — read this section twice for this phase specifically)
- No pure `#000000`/`#FFFFFF` anywhere.
- `market-up`/`market-down` reserved exclusively for actual price/P&L direction. **AI cards may only quote
  colored deltas inside evidence chips (i.e. when citing a real data point that itself has a direction) — the
  AI card's own chrome (border, badge, background) never uses market green/red.**
- **`ai` iris `#8B7CF6` is reserved exclusively for AI-generated content markers** — the AI card's 2px top
  edge, the ✦ badge glyph, AI sentiment glyph outlines (▲ ▽ ◇), and nothing else. Never used as a background
  fill, never used for a non-AI button or badge, never used decoratively.
- Generic UI success/confirmation (e.g. "message sent") uses accent, never green.
- Confidence chips must be **honest** — do not fabricate false numeric precision (e.g. "94% confidence") if the
  underlying model call has no calibrated confidence score. Use a coarse label (High/Medium/Low, or omit the
  chip entirely) unless the provider genuinely returns something numeric and meaningful.

### A3. Typography rules (non-negotiable)
- **Editorial (Tiempos Text / Georgia fallback)** is the body typeface for AI narrative content — the spec
  explicitly states AI cards use Tiempos for body copy, alongside News (Phase 4) and Company Details' About
  section as the only three places editorial serif appears at body size anywhere in the app.
- **Data (Söhne Mono)** — any numeric figure an AI response cites (a price, a percentage, a metric value) must
  still be rendered in mono/tabular form even inside otherwise-editorial AI text — do not let narrative
  prose swallow numerals into plain serif body text; numbers remain typography's first citizens even inside AI
  copy (e.g. inline mono spans for cited figures within a Tiempos paragraph).
- **Interface (Söhne / Inter)** — chat input, buttons, the AI card's badge label ("AI BRIEFING"-style text),
  navigation, evidence chip labels.
- Numeric rules apply without exception wherever a number appears, AI-generated or not.

### A4. Layout & elevation rules
Five-layer elevation model:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | AI card bodies, chat message list container |
| 3 | Raised | `bg-surface-3/4` | Suggested-prompt dropdown, model/context pickers |
| 4 | Overlay | `bg-glass` | The AI card's header strip specifically (see A5) |

- Nesting caps at two visible background steps.
- Radius scale: `radius-xs` 4px (chips/badges), `radius-sm` 6px (buttons/inputs), `radius-md` 10px (cards),
  `radius-lg` 14px (modals). **Nothing above 14px.**

### A5. Glass — strict allowlist
Permitted in exactly five places app-wide, and **this phase owns one of the five explicitly**: "The AI card
header strip" is a named, allowlisted glass surface — it separates the machine-narrative badge/header from
the live data below it. This is the only glass surface unique to this phase; everything else (the AI card
body, the chat input, resting message bubbles) is a normal solid Level-2 surface. Command palette and modals/
drawers remain glass per the app-wide rule if this phase uses any (e.g. a "clear conversation" confirm modal).

### A6. The AI Card — fully specified, not open to interpretation
This is the single most load-bearing component in this phase and it is **exactly** specified by the design
system, not a starting point for invention:
- **2px iris top edge** (the `ai` color, `#8B7CF6`) — a hairline-weight accent border strictly along the top
  edge of the card, distinct from and in addition to the card's normal hairline border on other edges.
- **Header badge**: a ✦ glyph (a simple 4-point sparkle/star glyph, 1.5px stroke consistent with the app's
  icon grid) + a label in the "AI BRIEFING" style (i.e. `micro` uppercase tracked type, e.g. "AI REVIEW",
  "AI ANALYSIS" — vary the label per context, always uppercase micro type) + a **confidence chip** (badge,
  `radius-xs`, honest per A2).
- **The header strip itself is glass** (20–24px blur, 140% saturation, wet-edge) — this is what separates
  "machine narrative" from "live data" per the spec's stated intent; it is one of the five allowlisted glass
  surfaces.
- **Body copy uses Tiempos** editorial serif (per A3), with **tappable evidence-source chips** inline or
  appended — every factual claim the AI makes about the user's actual data must be traceable to a chip that,
  when tapped, shows or links to the underlying source data point (a specific holding, a specific metric, a
  specific news item).
- **Never uses market green/red in its own chrome** — the card's border, background, badge, and any decorative
  element stay within accent/iris/neutral tokens. The **only** place market color may appear inside an AI card
  is *inside an evidence chip that itself quotes a real colored data point* (e.g. a chip reading "AAPL +2.4%"
  where the +2.4% legitimately uses market-up color because it's quoting real market data, not because the AI
  card chrome itself is colored).
- **AI sentiment glyphs** (▲ ▽ ◇, drawn in iris outline, never filled, never market-colored) always ship with a
  definition tooltip clarifying that this is a labeled machine judgment, not real market data — e.g. hovering
  an iris ▲ shows a tooltip "AI sentiment: Positive — a qualitative assessment, not a price movement."

### A7. Component library — reuse, don't reinvent
- Reuse the AI card pattern from wherever it's first established — **Dashboard already has an "AI briefing"
  module per the existing 15-module dashboard layout** (read that implementation first; extend/reuse its card
  component rather than building a second, divergent AI visual language for this phase).
- **Definition tooltips**: dotted-underlined financial terms open a small explainer card with a one-line
  formula/explanation in mono — this phase's Explain Metrics capability should wire directly into this exact,
  already-specified component, not invent a new "AI explains this" popover style.
- **Toasts, buttons, inputs, modals, dropdowns**: all per the standard component specs used everywhere else in
  the app (Primary/Secondary/Ghost buttons, 32px inputs with inset-shadow wells, `radius-lg` glass modals,
  Level-3 raised dropdowns). Chat message composition should not invent new button/input treatments.
- Reuse Radix + shadcn/ui, TanStack Query (with streaming support — see C1's SSE handling), react-hook-form+zod
  where a structured input form makes sense (Strategy Builder's constraint inputs, C7).

### A8. Motion — GSAP only, per this exact table, with a phase-specific caveat

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Cited numeral crossfades if a source figure updates live |
| Micro-interactions | 120–160ms, ease-out | Hover, press, evidence-chip tap, toggle |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | AI card mount, dropdown fade+rise |
| Ledger Line draw-in | 400ms, ease-in-out | Module/tab header underline |
| Ambient | 2–4s loops | Skeleton shimmer while an AI response streams in (if used instead of token-by-token render) |

**Phase-specific rule**: streaming text (token-by-token SSE render) is **not** decorative motion in the banned
sense — it's a direct visualization of the actual response arriving, analogous to a data tick, and is
permitted to render continuously while a response streams. However: **keep it calm** — no bouncing typing-
indicator dots, no pulsing avatar, no rotating spinner beyond the standard 14px indeterminate arc already used
app-wide for loading states. A simple blinking-cursor-style caret (opacity fade, not blink-snap) at the end of
the streaming text is sufficient to signal "still generating." Nothing bounces, overshoots, or rotates, per the
universal rule. `prefers-reduced-motion` disables token-by-token animation in favor of chunked/instant reveal.

### A9. States every feature must define
Chat: default/empty (suggested prompts), sending, streaming (partial response rendering), complete, error
(model call failed — module-level, contained, retry), rate-limited. Review/Explain features: default (trigger
action visible), loading (AI card renders its skeleton — shape-accurate: badge placeholder, header-strip
placeholder, body-copy placeholder lines of varied width mimicking real paragraph rag), success (full AI card),
error (contained "Couldn't generate this review" with retry, not a full-page failure), no-data (e.g. Company
Review requested for a company with insufficient underlying data to ground a response — explicitly say so
rather than letting the model hallucinate around a data gap).

### A10. Accessibility (mandatory, not follow-up)
≥4.5:1 contrast including iris-on-surface combinations (verify `ai` color at every elevation level in both
themes, same as market colors must be verified); direction never color-only; full keyboard model (chat input
focus, message history navigation, evidence chip focus/activation via keyboard); visible focus ring; live
regions announce new AI messages as they complete (not per-token, which would spam screen readers — announce
once the full response finishes streaming), throttled to 1 per 3 seconds per module.

### A11. General engineering rules
Backend: FastAPI + SQLAlchemy + Alembic. New router `apps/api/routers/ai.py` + `apps/api/services/
ai_service.py`, following the existing `routers/<domain>.py` + `services/<domain>_service.py` split. Streaming
via FastAPI's `StreamingResponse` (SSE), not polling. **Never hardcode an API key** — environment variable,
validated at startup, per the security rules already in force. Frontend: Next.js 15 App Router, React 19,
TypeScript, JS/TS only, desktop-first. Every module fault-isolated — an AI feature failing must never break the
underlying page it's embedded in (e.g. a failed Portfolio Review AI card on the Portfolio page must not take
down the Portfolio page itself). Verify by running the dev server and actually exercising each of the six AI
capabilities end-to-end with a real (or sandboxed/test) API key before calling this phase done, not just
type-checking.

---

## PART B — Phase 5 Context: What Already Exists (read before writing anything)

- **Confirmed via repo audit: zero LLM integration exists anywhere in `apps/api` today** — no references to
  openai/anthropic/llm/gpt/claude in the backend. This phase is genuinely greenfield on the backend AI
  integration, not an extension of existing partial work.
- **Dashboard already has an "AI briefing" module** per the existing 15-module dashboard layout (commit
  `2373270`) — **read this component fully first.** It is very likely the closest existing implementation of
  the AI card pattern (A6) in the codebase and should be extended/reused, not duplicated, as the foundation
  for every AI card built in this phase.
- **Definition tooltips** (dotted-underline financial terms) are referenced throughout DESIGN_SPEC.md as an
  existing component category — check whether any instance of this component already exists anywhere in the
  app (Company Details' Key Stats rail is a likely candidate) before building Explain Metrics' integration
  point; reuse the existing tooltip shell and wire AI content into it rather than building a new tooltip
  component.
- The `claude-api` skill (available in this environment) has reference material for Claude API model IDs,
  pricing, streaming, and tool-use patterns — consult it when making the concrete model/integration decisions
  in C0 rather than relying on possibly-stale training knowledge about model names or API shapes.
- Portfolio (Phase 2), Company Details (already revamped), and News (Phase 4) are the three data sources this
  phase's review/explain capabilities ground themselves in — read their actual current data shapes
  (whichever of those phases have been built by the time this phase starts) before designing prompt/context
  payloads in C2–C5, since the AI service must pass real, structured data into prompts, not assume field names.

---

## PART C — Feature Specifications (extreme detail)

### C0. Provider & architecture decision — resolve before writing integration code

**Ask the user to confirm, do not decide unilaterally:**
1. **Provider/model**: recommend the Claude API (Anthropic) as the natural default for a Claude-Code-managed
   project — confirm the specific model tier (balance of quality/cost/latency for a chat + structured-review
   use case) using the `claude-api` skill's current model reference rather than guessing a model ID from
   memory.
2. **API key provisioning**: where does the key live in this project's environment setup (`.env` pattern
   already used elsewhere in `apps/api`— check `config.py` for the existing pattern and match it), and does
   the user want to provide their own key now or have this phase's code wired-but-unconfigured until they add
   one (recommended: wire it fully, validate presence at startup with a clear error if missing, but do not
   generate placeholder/fake responses if the key is absent — fail loudly in dev, not silently).
3. **Cost/rate posture**: confirm an acceptable per-user rate limit for AI endpoints (LLM calls cost real money
   per request, unlike most other endpoints in this app) before picking a default number — recommend starting
   conservative (e.g. a low per-minute and per-day cap per user) and easy to adjust via config rather than
   hardcoded.

### C1. AI CHAT

- **Route**: `/ai` (new) or `/ai/chat` if the workspace uses a tabbed structure with Chat as one tab among the
  six capabilities (recommended — a persistent tab row, Ledger Line active-tab marker, consistent with the
  sub-navigation pattern used in Phase 2's Portfolio).
- **Backend**: `POST /ai/chat` (SSE streaming response). Request: conversation history (array of
  `{role, content}` turns) + optionally a lightweight context flag (e.g. "include my portfolio summary as
  context" toggle — see below). Response: streamed tokens via `StreamingResponse`.
- **System prompt**: establishes the assistant's identity as MarketVerse's market/portfolio assistant, and —
  critically — instructs it to **never fabricate specific user data**; if the user asks something requiring
  their actual portfolio/holdings and no context was provided/available, the assistant should say so and
  suggest enabling context or using the dedicated Portfolio Review capability instead, rather than inventing
  plausible-sounding numbers.
- **Context toggle**: a small control near the chat input, e.g. "Use my portfolio as context" (off by default
  — opt-in, since not every question needs it and it's a meaningful token-cost/privacy consideration to send
  automatically). When on, the backend fetches the user's current Holdings/Analytics summary (Phase 2 data) and
  injects it into the system/context prompt for that turn.
- **UI — NOT a consumer bubble-chat interface.** Per A6/A7, style AI messages using the AI card grammar
  (2px iris top edge, glass header strip with the ✦ badge, Tiempos body) rather than rounded colorful chat
  bubbles — this is explicitly called out as a Do-Not. User messages use standard `body` Interface type in a
  neutral (non-iris) container — no color-coding by "who sent it" beyond the AI card's own distinct chrome
  already differentiating AI turns from user turns.
- **Streaming render**: token-by-token as they arrive via SSE, with a calm trailing caret (per A8) — not a
  bouncing/animated typing indicator.
- **Message composer**: standard 32px-height input (multi-line capable, grows with content up to a max height
  then scrolls), Primary send button (or Enter-to-send with Shift+Enter for newline, standard chat convention),
  disabled while a response is streaming (prevent overlapping requests in the same conversation).
- **Suggested prompts (empty state)**: when a conversation is empty, show 3–4 example prompt chips (ghost-style
  pills) relevant to the app's domain (e.g. "What's driving my portfolio's performance today?", "Explain P/E
  ratio", "Summarize the latest market news") — clicking one populates and sends it.
- **Evidence chips**: whenever the assistant cites a specific data point (a price, a metric, a news item), it
  renders as a tappable chip inline in the response per A6 — tapping it could open the relevant Company
  Details page, Definition tooltip, or News drawer depending on what's cited.
- **Error/rate-limit states**: model call failure → contained error within the AI card for that turn ("Couldn't
  generate a response. Retry.") rather than breaking the whole conversation view; rate-limited → a clear inline
  message with, if available, a mono countdown until the limit resets (same countdown pattern used in Phase 1
  for login rate-limiting — reuse that small hook rather than rebuilding it).

### C2. PORTFOLIO REVIEW

- **Trigger points**: available both as a standalone view in the AI Workspace (select "Portfolio Review" from
  a capability list/tab) and as a contextual action embedded directly in the Portfolio page (Phase 2) — e.g. a
  "Review" ghost action in the Portfolio identity bar or Analytics tab that opens this same capability inline
  as an AI card, not a disconnected separate page. Build the underlying component once, reusable in both
  contexts.
- **Backend**: `POST /ai/portfolio-review`. Request: implicitly the authenticated user (no need to pass
  portfolio data from the client — fetch it server-side to guarantee the AI is grounded in authoritative,
  current data rather than whatever stale state the client happened to have). The service function assembles a
  structured context payload from Phase 2's Holdings/Transactions/Analytics data (cost basis, unrealized P&L,
  sector allocation, risk metrics if available) and passes it into a dedicated prompt template — **every
  numeric claim the response makes must be traceable back to a field in this payload**; design the prompt to
  explicitly instruct the model to only reference figures present in the provided context and to cite which
  field/holding backs each claim (this citation instruction is what makes the evidence-chip UI in C1/A6
  possible — the response format should be structured, e.g. requesting the model return claims paired with
  source references, not free-flowing prose the frontend then has to guess at parsing for citations).
- **Response contract** (recommend a lightweight structured format, not pure freeform text, specifically so the
  evidence-chip requirement is satisfiable): narrative body text (rendered in Tiempos) with inline markers the
  backend resolves into `{ text, evidence: [{ type: "holding"|"metric"|"transaction", ref_id, label }] }` — the
  frontend renders `text` with tappable chips at each `evidence` marker position. Keep this contract consistent
  across C2–C5 since they're structurally the same problem (grounded narrative + citations) applied to
  different data sources.
- **UI**: renders as a full AI card (A6) — badge "AI PORTFOLIO REVIEW", confidence chip (honest per A2 — if the
  model doesn't return a real confidence signal, consider omitting the chip here rather than fabricating one),
  Tiempos body with evidence chips linking back to specific Holdings rows/Analytics metrics.
- **Regeneration**: a ghost "Regenerate" action in the card header (hover-reveal, per the app's hover-reveal
  convention for module actions) re-runs the review against current data — useful since portfolio data changes
  over time and a stale review should be easy to refresh.

### C3. COMPANY REVIEW

- **Trigger point**: primarily from Company Details (an "AI Analysis" tab already exists per that page's tab
  row per DESIGN_SPEC.md's Company Details layout — read the current Company Details implementation to see if
  this tab is already scaffolded/empty, and fill it, rather than adding a new tab), also reachable from the AI
  Workspace directly with a company search/selector.
- **Backend**: `POST /ai/company-review`. Request: `{ ticker }`. Service assembles context from the company's
  financials, key stats, recent price history/news (whichever of Company Details' existing data endpoints
  already expose this — reuse them server-side rather than re-fetching duplicate data) into the same
  structured evidence-citing prompt/response contract as C2.
- **UI**: same AI card treatment, badge "AI COMPANY ANALYSIS", evidence chips linking to specific financial
  line items, key-stat fields, or cited news articles (tying into Phase 4's News if that's been built).
- **No-data guard**: if a company has insufficient underlying data (e.g. very sparse financials in the
  simulated market data), the backend should detect this and return a specific "insufficient data" response
  rather than letting the model generate a review that sounds confident but is thin/fabricated — the frontend
  renders this as a contained state: "Not enough data available yet for a full analysis of {ticker}." rather
  than a low-quality AI card.

### C4. EXPLAIN METRICS

- **This is the one capability that must NOT live only in the AI Workspace** — it should be **ambient
  throughout the app**, wired directly into the existing Definition tooltip component (per A7) wherever a
  financial term already appears with a dotted underline (Company Details' Key Stats rail, Phase 2's Analytics
  metric cards, anywhere else Definition tooltips exist or get added).
- **Backend**: `POST /ai/explain-metric`. Request: `{ metric_name, value?, context? }` (value/context optional
  — e.g. explaining "Sharpe Ratio" generically needs no user-specific data, but explaining "why is AAPL's P/E
  47.3 notable" benefits from passing the actual value and perhaps a peer/sector comparison if available).
  Response: a short-form explanation, **not a full AI card** — this is meant to be lightweight and fast, so
  render it directly inside the existing Definition tooltip's explainer card (small, `caption`/`body` sized,
  one-line formula in mono already part of that component per the spec — the AI-generated portion is the plain-
  language explanation layered in alongside, not replacing, the existing static formula line).
- **Caching**: since generic metric explanations (e.g. "what is Beta") don't vary per user or per request,
  cache these server-side (in-memory or a simple cache table, not re-calling the LLM on every hover across
  every user) — this is both a cost optimization and a latency improvement (a tooltip that takes 2 seconds to
  populate because it re-calls an LLM every time defeats the "quiet, quick" feel this component needs). Only
  value-specific explanations (tied to a specific number that varies) need a live call; generic term
  definitions should be pre-generated or cached after first generation.
- **Labeling**: even in this lightweight tooltip context, the AI-generated portion should carry a small ✦ glyph
  or "AI" micro-label distinguishing it from the static formula line — the spec's "no unlabeled AI-generated
  content" rule applies here too, just at a smaller visual scale appropriate to a tooltip rather than a full
  card.

### C5. EXPLAIN NEWS

- **Trigger point**: from Phase 4's News feed / Article reading drawer (an "Explain" or "AI take" ghost action
  on a news item) — if Phase 4 hasn't been built yet, this capability can still be built against the `NewsFeed`
  data model directly and wired into Phase 4's UI later; check whether `NewsFeed`/`NewsTemplate` already exist
  in the backend (confirmed they do, per the repo audit) and build against them now regardless of Phase 4's
  frontend status.
- **Backend**: `POST /ai/explain-news`. Request: `{ news_id }`. Service fetches the news item's content plus,
  if it references a specific ticker/event, that entity's current data, and generates a plain-language
  summary/implication ("what this likely means for {ticker}/the market") using the same structured evidence-
  citing contract as C2/C3.
- **UI**: renders as an AI card (badge "AI NEWS TAKE" or similar), Tiempos body, evidence chips — appears
  either inline below the news item in the feed (expandable) or as a distinct panel within the Article reading
  drawer.
- **Honesty guard**: the prompt must explicitly instruct the model to distinguish between the news item's
  stated facts and its own inferred implications — e.g. structure the response to visually/textually separate
  "What happened" from "Why it might matter," so users aren't left unable to tell reported fact from AI
  speculation.

### C6. STRATEGY BUILDER

- **Scope explicitly narrowed for v1 — confirm with the user before building beyond this.** Recommend: a
  **single-turn strategy suggestion**, not a full multi-turn conversational planning agent. The user fills a
  short structured form (react-hook-form): risk tolerance (a segmented control: Conservative/Moderate/
  Aggressive), investment goal (a short free-text field or a small set of preset goals, e.g. "Growth,"
  "Income," "Capital preservation"), time horizon (a stepper or select: e.g. <1yr / 1-5yr / 5yr+), and
  optionally current portfolio context (reuse the same opt-in context toggle pattern as C1). Submitting
  generates one structured strategy suggestion — not an open-ended back-and-forth.
- **Backend**: `POST /ai/strategy-builder`. Request: the structured form fields + optional portfolio context.
  Response: a structured strategy narrative (same evidence-citing contract where it references the user's
  actual holdings) covering suggested allocation direction, general risk considerations, and — **critically —
  a clear, prominent disclaimer that this is an illustrative/educational suggestion within a simulation, not
  real financial advice** (this app is a simulator; the AI must not present itself as licensed financial
  advice regardless of how realistic the simulation is — bake this disclaimer into the prompt's system
  instructions AND render it as a persistent, visible line on the Strategy Builder AI card, not just a buried
  legal footnote).
- **UI**: the structured input form on one side (or above), the resulting AI card below/beside it, same AI card
  grammar as elsewhere. A "Generate another" action re-runs with adjusted inputs rather than a chat-style
  refinement loop, consistent with the single-turn v1 scope.
- **Explicitly out of scope for v1** (flag if the user wants these, don't build silently): multi-turn
  negotiation/refinement of the strategy, automatic execution of suggested trades (this must always require the
  user to manually act via the Trading Desk, Phase 3 — the AI never places orders on the user's behalf),
  backtesting the suggested strategy against historical simulation data.

### C7. MARKET ASSISTANT

- **Likely overlaps heavily with AI Chat (C1) — do not build a second, nearly-identical chat endpoint.**
  Recommend implementing this as a **parameterized variant of the C1 chat endpoint** (e.g. a `scope` field in
  the request: `"portfolio"` vs `"market"`, adjusting the system prompt to focus on market-wide/general
  questions rather than the user's specific holdings) rather than a fully separate `POST /ai/market-assistant`
  route with duplicated streaming/session logic.
- **If the user specifically wants Market Assistant to be a genuinely distinct experience** (e.g. a dedicated
  UI surfaced differently, perhaps pinned to the Market Explorer or Dashboard rather than living in the AI
  Workspace's chat tab), that's a legitimate product decision — confirm it, since it changes this from "one
  parameterized endpoint" to "two related but separately-surfaced chat experiences," which is still cheap on
  the backend (same parameterization) but means building a second frontend entry point/UI shell.
- **Default recommendation**: one chat endpoint, parameterized by scope, with the AI Workspace's tab row
  offering both "Portfolio Chat" and "Market Assistant" as two entry points that both route to the same
  underlying chat UI/component with a different `scope` and correspondingly different suggested-prompt chips
  (C1's empty-state prompts) and system-prompt framing.

---

## PART D — Strict Do-Not List (Phase 5)

- **Do NOT** hardcode an API key anywhere in source — environment variable, validated at startup, matching the
  existing `config.py` pattern for secrets in this codebase.
- **Do NOT** pick a provider or model without confirming with the user first — this is a credential and cost
  decision, not a unilateral engineering choice.
- **Do NOT** skip rate limiting on any AI endpoint — every LLM call costs real money per request; extend the
  existing `rate_limiter.py`, don't build a second rate-limiting mechanism.
- **Do NOT** let the AI fabricate specific numeric claims about the user's actual data — every review/explain
  capability must ground its response in a structured data payload fetched server-side, and the prompt must
  instruct the model to only cite figures present in that payload.
- **Do NOT** fabricate confidence scores — use coarse honest labels or omit the confidence chip if no real
  signal exists.
- **Do NOT** use market green/red anywhere in an AI card's own chrome (border, background, badge) — the only
  legitimate market color inside an AI card is within an evidence chip quoting a real, independently-colored
  data point.
- **Do NOT** use the `ai` iris color for anything that isn't an AI content marker — never as a general UI fill,
  never on non-AI buttons or badges.
- **Do NOT** style the chat interface as a consumer bubble-chat UI (rounded colorful bubbles, avatar-heavy,
  bouncing typing indicators) — use the AI card grammar for AI turns and standard neutral Interface-type
  containers for user turns.
- **Do NOT** build six fully separate, redundantly-implemented chat-shaped endpoints — Market Assistant should
  be a parameterized variant of AI Chat's endpoint, not a duplicate.
- **Do NOT** let the Strategy Builder (or any AI capability) execute trades on the user's behalf — every
  suggestion requires the user to manually act via the Trading Desk. The AI never has write access to orders.
- **Do NOT** omit the "illustrative/educational, not real financial advice" disclaimer from the Strategy
  Builder's output — this must be prominent on the card, not buried.
- **Do NOT** ship unlabeled AI-generated content anywhere, including inside a small Definition tooltip (Explain
  Metrics) — every AI-touched surface, regardless of size, carries a visible label distinguishing it from
  static/human-authored content.
- **Do NOT** re-call the LLM on every tooltip hover for generic, non-user-specific metric explanations — cache
  these server-side; only value-specific explanations need a live call per request.
- **Do NOT** exceed 14px border radius, use pure black/white, or add glass anywhere beyond the AI card's header
  strip and standard modal/drawer/tooltip allowlisted uses.
- **Do NOT** animate a bouncing/pulsing typing indicator or rotating spinner beyond the app's standard 14px
  indeterminate arc — streaming text itself, rendered calmly with a simple fading caret, is the correct "still
  generating" signal.
- **Do NOT** touch Portfolio, Company Details, Simulation, or Trading Desk internals beyond calling their
  existing read endpoints server-side to assemble AI context payloads — this phase's file boundary is
  `app/ai/**`, the Definition-tooltip integration point wherever it already exists in other pages,
  `apps/api/routers/ai.py`, `apps/api/services/ai_service.py`, and any small caching table needed for C4.
- **Do NOT** skip the Alembic migration for any new table (e.g. a metric-explanation cache table, if built as a
  DB table rather than in-memory) — no manual schema edits.
- **Do NOT** ship this phase without manually exercising all six capabilities end-to-end against a real (or
  sandboxed test) API key in a running browser — including deliberately testing a rate-limit hit, a model-call
  failure, and a no-data guard case (e.g. Company Review on a company with sparse data) to confirm the error
  states are contained and honest rather than just testing the happy path.

# Landing Page Audit
Status: Analysis / Planning Reference
Scope: `/` (marketing landing page) only — no other route
Inputs read: `DESIGN_SPEC.md`, `docs/design/DASHBOARD_DESIGN_VISION.md` (Fable "The Desk"), `docs/design/GEMINI_150_POINT_CHECKLIST.md`, `SKILL.md` (surface-class split + marketing sections), and the actual current implementation
No code was changed to produce this document.

---

## 0 · A load-bearing observation before anything else

The two documents this audit was asked to weigh the landing page against are both written for the **wrong surface class**.

- `docs/design/DASHBOARD_DESIGN_VISION.md` ("The Desk") is explicitly a **Dashboard** spec — Portfolio Pulse, Watchlist dock, Sector Heatmap, Economic Calendar. It's a TERMINAL-surface document.
- `docs/design/GEMINI_150_POINT_CHECKLIST.md` opens with "we are building a high-precision instrument, not a consumer app," and point 141 is **"Zero Gamification: no animations, confetti, badges."** It is explicitly written for the trading terminal itself, not for a landing page.

This codebase already has a documented, deliberate answer to that tension — `SKILL.md` §0 defines a **Surface Class Split**:

> `TERMINAL` → zero-exception density/motion discipline. `MARKETING` → "full Awwwards license: hero motion, scroll narrative, WebGL/Three.js, signature typography moments allowed." `/` is explicitly tagged `MARKETING`.

So: neither "The Desk" nor the Gemini checklist should be applied to `/` literally — doing so would mean stripping the one page in the app that's *allowed* to have a hero animation, in favor of terminal-grade restraint that belongs on `/market` and `/portfolio` instead. What **does** transfer from both documents, and what this audit uses throughout, is the *underlying craft discipline* — single-accent color rule, real-data-driven motion (never decorative-for-its-own-sake), scarcity of glass, shape-true skeletons, staged (never blank) empty states, and "every module/section has one behavior unique to it." Those principles are surface-agnostic. The literal card grids, terminal chrome, and "no confetti ever" rule are not.

The rest of this audit treats `SKILL.md §2` ("The one Awwwards moment worth building") and `DESIGN_SPEC.md`'s marketing-token section as the actual governing spec for this page, cross-checked against the craft principles above.

---

## 1 · Current implementation analysis

**Files in scope:**
- `app/page.tsx` — the whole page (84 lines, single file, three `<section>`s)
- `components/marketing/HeroMarketPulse.tsx` — full-viewport Canvas sector-line visualization
- `components/marketing/PriceTickerTape.tsx` — scrolling ticker strip
- `lib/api/hooks/usePublicMarket.ts` — the one data source
- `app/globals.css` `@layer marketing` + `--mkt-*` tokens (lines 132–148, 298–325)

**Structure today:**

```
<PriceTickerTape>                          — 36px strip, top of viewport
<section: hero>                            — h-[calc(100vh-36px)]
  <HeroMarketPulse>  (absolute, full-bleed background)
  headline + subhead + 2 CTAs              (foreground, left-aligned, max-w-4xl)
<section: "how it works">                  — 3 numbered feature rows, content-visibility:auto
<footer>                                    — one line, copyright
```

**Data flow:** one hook, `usePublicMarketSnapshot()`, fetches the *full* `/market` endpoint (150 companies) with no auth, `staleTime: 60_000`, `retry: 1`. Feeds both `PriceTickerTape` (slices to top 20 by `|day_change_pct|`) and `HeroMarketPulse` (groups by `industry_name`, 15 sector lines).

**What's already good and should be preserved as-is:**
- The core idea — the hero is literally the sim's own market data rendered as art, not a stock photo or a particle field. This is exactly `SKILL.md §2`'s "one Awwwards moment," already built.
- Single-accent discipline is honored: `--mkt-signature` (`#d4ff3f`) is the only color that ever appears in the hero besides muted text — matches every source document's "one accent" rule.
- `content-visibility: auto` on the below-fold section (`app/page.tsx:46`) — a real, correctly-applied performance technique, and it matches `SKILL.md §6`'s explicit instruction for this exact page.
- The doubled-content CSS-transform ticker loop (`PriceTickerTape.tsx:18,22`) is the correct technique (no JS interval, no layout thrash) and matches `SKILL.md §5.17`'s spec precisely, including pause-on-hover.
- Numbered feature rows (`01/02/03`) use real product facts (PEG valuation, seven price drivers, timeline branching) — not filler copy.

**What's missing relative to the project's own written spec for this exact component** (`SKILL.md §2`, lines 262–276):
- **No scroll parallax.** Spec: "Lines drift vertically on scroll (parallax by sector volatility — higher volatility sectors have more vertical motion)." Current `HeroMarketPulse.tsx` has no scroll listener at all — the hero is inert once the cursor leaves it.
- **`prefers-reduced-motion` is undocumented in code but documented in `SKILL.md §11`'s state matrix**: "Disable HeroMarketPulse cursor-follow and scroll reveals; show static final-state frame instead." Nothing in `HeroMarketPulse.tsx` checks this media query — cursor-follow always runs.
- Fetches the full company list instead of the spec'd "top 20 movers only" public snapshot — see Performance §7.

---

## 2 · Everything that should be removed

- **Nothing needs deleting outright** — the page is small (84 + 113 + 35 lines) and every line currently does something. This is a case for *addition and restructuring*, not subtraction. Calling that out explicitly matters: the instinct on an audit like this is to find things to cut, and there isn't slop here to cut.
- One real removal candidate: the hero's `cursor-default` on `ChartSurface` (`HeroMarketPulse.tsx:102`) actively suppresses the crosshair cursor a data-hover surface would normally want — worth removing once hover interactions get richer (§6), so the cursor affords the interaction instead of hiding it.

---

## 3 · Everything that should be redesigned

1. **The hero is a static single beat.** Right now: load → headline + two buttons, forever, until the user scrolls past it. There's no scroll story (see §8) and no secondary hero state (e.g., a "watch the market move" idle micro-narrative). The Fable doc's underlying principle — "the room knows what time it is" — has no landing-page analog yet: the hero doesn't know or show whether the sim market is currently in an up or down phase, pre/open/closed session, etc., even though `useCycleState`-equivalent public data could inform that.
2. **The "how it works" section is plain text, not storytelling.** Three rows of number + heading + paragraph is a spec sheet, not a narrative. Compare to the Fable doc's own governing principle #15 ("no equal-width... no generic... every module has one behavior unique to it") — the three rows here are visually identical to each other (same grid pattern repeated 3×), which is precisely the kind of "instances of one template" the reference documents both warn against.
3. **The footer is an afterthought** — one gray line, no secondary nav, no real signal that this is a considered product close.
4. **No social proof / trust section.** For a fintech-adjacent product (even simulated), a landing page with zero indication of "why should I trust the math" (the PEG valuation, Kyle-lambda impact model, economic cycle engine are real, interesting, differentiating facts already used as copy in section 2) undersells the engineering.
5. **Metadata is a placeholder.** `app/layout.tsx` metadata is `{ title: "Stock Sim", description: "Simulated stock market trading terminal." }` — no Open Graph tags, no Twitter card, no favicon beyond Next's default. Every share of this link renders a bare title.

---

## 4 · Every reusable component

Genuinely reusable across the codebase already, and safe to lean on further without touching Design System/TERMINAL scope:

| Component | Where it lives | Reusable for landing page work |
|---|---|---|
| `PriceTickerTape` | `components/marketing/PriceTickerTape.tsx` | Already marketing-scoped; could be reused a second time (e.g., a closing-section ticker) without modification |
| `HeroMarketPulse` | `components/marketing/HeroMarketPulse.tsx` | Its `buildSectorLines` derivation is a clean, pure function — reusable as the data source for a second, smaller visualization (e.g., an inline sparkline strip in the "how it works" section) without duplicating the sector-grouping logic |
| `usePublicMarketSnapshot` | `lib/api/hooks/usePublicMarket.ts` | The one hook every new marketing section should reuse rather than adding a second public-data fetch |
| `.mkt-button` / `.mkt-headline` | `app/globals.css` `@layer marketing` | Already token-driven (`--mkt-signature`, `--mkt-fs-display`); new marketing CTAs/headings should use these classes rather than inventing new ones |
| `--mkt-*` custom properties | `app/globals.css:132–148` | The complete marketing palette already exists (void/elevated backgrounds, signature/signature-dim/signature-glow, mesh tones) — any new section should draw only from this set, never introduce a new color |
| `ChartSurface` | `lib/charts/core/ChartSurface.tsx` | The DPI-aware Canvas wrapper `HeroMarketPulse` already uses — the right primitive for any *new* Canvas-based marketing visual too (avoids a second ad-hoc Canvas setup) |
| `formatPrice` / `formatPct` | `lib/utils.ts` | Already used correctly in `PriceTickerTape`; any new section showing live numbers should reuse these, not reformat manually |

Not reusable, and shouldn't be reached for: any `components/ui/*` primitive that assumes the TERMINAL surface's `bg-*`/`text-*` tokens (e.g. `Card`, `StatCard`) — mixing those into `/` would be exactly the "beautiful animated hero bleeding into the order book" failure mode `SKILL.md §0` calls out by name, just in reverse.

---

## 5 · Animation opportunities

All of the below are scroll-, cursor-, or real-data-driven — never decorative-looping, per `SKILL.md`'s marketing anti-slop list ("Motion must be tied to scroll position, cursor, or real data").

- **Scroll parallax on the hero's sector lines**, exactly as already specified in `SKILL.md §2` but never implemented — highest-priority gap because it's not a new idea, it's a documented one that's missing.
- **Headline reveal on load** — word-by-word or line-by-line stagger (the codebase already has `revealStagger` in `lib/motion`, currently only consumed by TERMINAL-surface shell components; a marketing-appropriate variant of the same technique is a natural, low-risk addition since the primitive already exists).
- **Numeral count-up for any live stat introduced** (e.g., "150 companies," "15 industries" if promoted from body copy to a stat treatment) — `lib/motion`'s `useAnimatedCounter` already exists and is unused outside the shell/dashboard.
- **Scroll-linked section transitions** between hero → "how it works" → close, so the page reads as one continuous piece rather than three stacked, independent blocks.
- **Ticker-tape "handoff" on scroll** — as the user scrolls past the hero, the top ticker could subtly intensify (opacity/contrast) as if reacting to attention leaving the hero visualization, tying two existing elements together without adding a new component.

---

## 6 · Background animation opportunities

- **Session-aware mesh tint**, the Fable doc's most exportable idea despite being written for the Dashboard: shifting `--mkt-mesh-accent`'s warmth based on the sim's actual cycle phase (available via the same public data already fetched) is real-data-driven, matches the anti-slop rule, and gives the hero a "the room knows what time it is" quality without inventing fake data.
- **Volatility-driven line density** — sectors with higher `volatility` (already computed in `buildSectorLines`) could get a subtly thicker glow or more frequent micro-jitter, extending the existing hover-brighten behavior into an ambient (but still data-tied) resting state.
- **Cursor-follow radial gradient is already implemented** (`HeroMarketPulse.tsx:44-48`) and correctly matches spec — no change needed there, just noting it as the one background-animation element already done well.

---

## 7 · Hero improvements

- Implement scroll parallax (§5) — the single highest-leverage, spec-documented gap.
- Wire `prefers-reduced-motion` — currently a correctness gap, not just a nice-to-have (§11 accessibility).
- Give the hero a **live session state**: pull the same `market_factor_return`/cycle-phase concept the Dashboard now surfaces (via the public snapshot or a lightweight public cycle endpoint) and reflect it in copy or in the mesh tint, so the hero communicates "this market is alive right now," not just "here is some abstract line art."
- Consider promoting the hover label (`HeroMarketPulse.tsx:106-110`, currently just a sector name) into a small live stat chip (sector name + return%) — the sector's `points` already encode an average return; surfacing the number, not just the name, turns a decorative hover into an informative one and better matches the "art driven by real data" thesis.
- The headline currently competes with the hero visualization for the same vertical band on smaller viewports (`h-[calc(100vh-36px)]` + `max-w-4xl` text block sitting over a full-bleed Canvas) — worth an explicit small-viewport hero composition rather than relying on the Canvas simply having less room.

---

## 8 · Storytelling improvements

- Turn "how it works" from three parallel spec rows into an actual sequence: each of the three real mechanics (intrinsic value engine, seven price drivers, timeline branching) could get its own small live-data visual proof (e.g., driver #2 shown as an actual mini driver-weight bar using the same `DriverChart` data shape already defined in `lib/charts/types.ts`, without duplicating that chart's logic — just reusing its data contract for a marketing-scaled visual).
- Add a **"why simulated" trust beat** — one short section making the explicit case that "real math, fictional money" is a feature, not a caveat, addressing the natural skepticism ("is this just a toy") before it's asked.
- Close with a stronger final CTA section instead of an unstyled copyright line — the page currently has exactly one CTA moment (the hero) and then just ends.

---

## 9 · Conversion improvements

- Second CTA placement: right now "Start trading" only exists in the hero. A returning/scrolled-past visitor who reads all the way to the feature rows has no CTA in view — add one at the close of "how it works" or as a persistent (but non-intrusive, no sticky-bar spam) element.
- Reduce ambiguity between the two CTAs — "Start trading" (primary, `/register`) vs. "Sign in" (ghost, `/login`) is already correctly weighted (`app/page.tsx:34-41`), this is good and should be preserved, not changed.
- Add the missing Open Graph/Twitter metadata (§3.5) — this is a direct, low-effort conversion lever for any shared link (Slack, Twitter, iMessage previews).

---

## 10 · Performance concerns

- **`usePublicMarketSnapshot` over-fetches.** `SKILL.md §6` specifies this endpoint should return "top 20 movers only" server-side; the current hook (`lib/api/hooks/usePublicMarket.ts:11`) calls plain `GET /market` with no `public=true`/limit param, meaning the client downloads and JSON-parses all 150 companies' full grid payload just to keep 20 in `PriceTickerTape` and derive 15 sector groups in `HeroMarketPulse`. This is a payload-size and parse-time concern on every landing-page load, for both new visitors and search bots — worth flagging even though fixing it touches the API layer (out of scope for this no-code audit, but the frontend-visible symptom belongs here).
- **Full-viewport Canvas on mobile.** `HeroMarketPulse` renders at `height=800` by default from `app/page.tsx:19` inside a `h-[calc(100vh-36px)]` section with no viewport-based reduction — on a phone this is a large, continuously-listening (`onPointerMove`) Canvas surface for a visualization whose main payoff (cursor-follow hover) doesn't meaningfully exist on touch. Worth a smaller/simpler mobile treatment.
- **No `will-change` / layer hint audit** on the ticker's `translateX` animation — likely fine at 20 items, but worth confirming under the marketing performance budget already defined in `SKILL.md §10` ("Marketing hero FCP < 2.0s," "main-thread block during init < 100ms") once parallax/scroll listeners are added, since scroll handlers are the most common way to blow that budget.
- Bundle: no evidence of Three.js/Spline/WebGL libraries currently installed (`package.json` has `gsap` but no `three`, `@splinetool/*`, or similar) — any future recommendation involving those (see the separate landing-page visual-spec request) is a new dependency decision, not a drop-in.

---

## 11 · Accessibility concerns

- **`prefers-reduced-motion` is unimplemented** despite being explicitly specified for this exact component in `SKILL.md`'s state-handling matrix (line 1443). This is the single clearest, most concrete accessibility gap on the page — cursor-follow and (once built) scroll-parallax should both collapse to a static final-state frame.
- **The hero has no text alternative.** A full-viewport Canvas visualization with no `aria-label`/`role` and no adjacent text equivalent means screen reader users get nothing from the page's central visual — at minimum it needs a concise `aria-label` describing what it represents ("Live simulated sector performance visualization"), consistent with this project's own precedent of never letting a chart be screen-reader-invisible (the TERMINAL surface's chart components carry this expectation already per the Gemini checklist's accessibility section, point 93 — a principle worth importing here even though the checklist itself is terminal-scoped).
- **Ticker tape as a moving text region** — auto-scrolling text is a WCAG 2.2.2 (pause, stop, hide) concern; the component does pause on hover (`PriceTickerTape.tsx:22`), which covers mouse users, but there's no keyboard-accessible way to pause it and no `aria-live` consideration for whether screen readers should announce it at all (they likely shouldn't — it should probably be `aria-hidden` with the underlying data available elsewhere, since it's decorative-informational, not primary content).
- **Color-only direction encoding in the hero's hover label** — the sector label color-shifts to `--mkt-signature` but carries no directional glyph; low-severity here since it's not conveying up/down, only "this is the hovered one," but worth noting given the rest of the app's strict "never color alone" rule.
- **Contrast**: `--mkt-text-muted` (`#7a7a82`) on `--mkt-bg-void` (`#030304`) — worth a explicit contrast-ratio check before any copy is set in it at small sizes; the feature-row body copy (`text-mkt-text-muted`) is exactly this pairing at `text-body` size.

---

## 12 · Phased implementation plan — highest impact → lowest impact

**Phase 1 — Close the documented gaps (spec compliance, not new ideas)**
1. Implement `prefers-reduced-motion` handling in `HeroMarketPulse` (accessibility correctness + already-written spec).
2. Implement scroll parallax on the sector lines (already-written spec, highest visual-impact single change).
3. Add hero `aria-label` / text alternative.

**Phase 2 — Fix the one real structural weakness**
4. Redesign "how it works" from three identical rows into a differentiated sequence (§8), each row getting one unique visual behavior — directly addresses the "instances of one template" finding, which is the most-repeated criticism across every source document read for this audit.
5. Add a second CTA at the close of that section.

**Phase 3 — Extend what's already working**
6. Session-aware mesh tint (§6) — highest craft-per-effort ratio: reuses data already being fetched, touches only CSS custom properties, no new dependency.
7. Promote the hero hover label into a live stat chip (name + return%).
8. Replace the placeholder footer with a real closing section + CTA.

**Phase 4 — Trust, metadata, and polish**
9. Add Open Graph/Twitter metadata.
10. Add the "why simulated" trust section.
11. Audit and fix the muted-text contrast pairing.
12. Add keyboard-pause affordance / `aria-hidden` decision for the ticker tape.

**Phase 5 — Bigger bets (require a scoping decision first)**
13. Mobile-specific hero composition/sizing.
14. Any Three.js/Spline/WebGL upgrade — new dependency, needs an explicit go-ahead before scoping further (flagged, not planned, in this audit).
15. `usePublicMarketSnapshot` payload optimization to match the "top 20 only" spec — frontend-visible symptom, but the actual fix is API-layer and out of this audit's no-code, frontend-only scope.

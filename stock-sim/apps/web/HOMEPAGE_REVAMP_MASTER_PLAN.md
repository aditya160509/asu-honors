# MarketVerse Homepage Revamp — 9-Phase Master Plan
### Design language: **Aurora** (landing-only layer, sibling to Meridian)

Status: **DRAFT FOR REVIEW — no code changes made yet.** Paste a phase's prompt back to begin execution of that phase, exactly like `REVAMP_MASTER_PLAN.md`.

This document governs `app/page.tsx` and `components/marketing/**` only. It does not touch `DESIGN_SPEC.md`, the Meridian tokens (`mer-*`), or any authenticated route. Where this document and `DESIGN_SPEC.md` conflict, **this document wins inside `components/marketing/**` and `app/page.tsx`; Meridian wins everywhere else.** The two systems coexist deliberately — the public marketing surface is allowed to be louder, rounder, and more emotionally driven than the instrument-panel product behind login, because it is selling the product, not operating it.

---

# Why a second design language

The current landing page (`app/page.tsx`, `components/marketing/*`, ~1,330 lines across 12 files) already made this call once — `--mkt-bg-void` is pure `#000000`, an explicit documented deviation from Meridian's "no pure black" rule, and `--mkt-action-hue: #0055ff` already exists as an unused-until-now blue accent separate from Meridian's `accent-500`. Aurora continues that precedent rather than inventing a third system: it keeps `--mkt-action-hue` as the accent, keeps the pure-black canvas, and *adds* the vocabulary the current landing page never finished — glow, pill radii, depth, and a bolder type scale — on top of tokens that already exist in `app/globals.css`.

Full rebuild, not a restyle: the current `AiHero`, `OrderFlowTape`, `DashboardMockSection`, `CrossAssetMatrix`, `ExecutiveTearSheet`, `OrderTicketMock`, `ContextualCrosshair` components are **reference material for Phase 8 (integration & cleanup)**, not a foundation to build on. Read them before each phase for tone and data-wiring patterns (especially `usePublicMarketSnapshot`, `useReducedMotion`, and the WebGL background technique in `OrderFlowTape`), but the new sections listed below replace them structurally.

---

# Global Non-Negotiables (apply to all 9 phases)

1. **This document (`HOMEPAGE_REVAMP_MASTER_PLAN.md`) is the single source of visual truth for `app/page.tsx` and `components/marketing/**`.** Aurora tokens (`land-*` in `app/globals.css` / `tailwind.config.ts`, defined in Phase 0) are canonical for this surface — do not reach into Meridian's `mer-*` tokens here, and do not invent one-off hex values inline in a component. If a value isn't in the Phase 0 token table, add it to the token table in the same PR, don't hardcode it.
2. **JavaScript/TypeScript only, responsive and smooth.** Next.js 15 App Router + React 19 + TypeScript, matching the rest of the repo. Mobile-first for this surface specifically — unlike the authenticated app (desktop-first per Meridian), the landing page is the first thing a phone browser sees and must be excellent down to 360px width, not merely "not broken."
3. **Motion = GSAP + ScrollTrigger**, already dependencies (`gsap: ^3.15.0`). Every animated component registers `ScrollTrigger` exactly once at module scope guarded by `typeof window !== "undefined"` (see `ScrollProgressBar.tsx` for the existing pattern — copy it, don't reinvent it). The full Aurora Motion Timing Table lives in Phase 0 and every later phase must cite it by name (e.g. "hover: `land-hover` timing") rather than picking new numbers ad hoc. `prefers-reduced-motion` is checked via the existing `useReducedMotion()` hook (`lib/marketing/useReducedMotion.ts`) in every component that animates — no exceptions, including hover/glow effects, which must degrade to instant or CSS-only transitions.
4. **Reuse existing infrastructure, don't reinvent it:**
   - `Button` (`components/ui/button.tsx`, CVA-based) gets a new `variant: "glow"` and the existing `size` scale extended with a `"xl"` pill size in Phase 0 — do not create a parallel `LandingButton` component from scratch when CVA variants solve it.
   - `usePublicMarketSnapshot` (`lib/api/hooks/usePublicMarket.ts`) remains the only data source for any live numbers on the page (ticker tape, live preview panels, stats). No new public endpoints are in scope for this plan — if Phase 2's live preview needs a field the hook doesn't return, flag it and stop; don't invent mock data that pretends to be real.
   - `cn()` (`lib/utils.ts`) for all conditional classNames, `clsx`/`tailwind-merge` already wired.
   - Three.js / `@react-three/fiber` are available (already dependencies) but **only Phase 1's hero background may use WebGL** — every other section uses CSS/SVG/GSAP for depth and glow. One WebGL canvas on the page, not five; this is a performance non-negotiable, not a style preference.
5. **No backend work is in scope for this plan.** Every section is built from data the public snapshot endpoint already returns, or is static marketing copy. If a phase's ambition implies a new endpoint (e.g. a live "total simulated trades" counter with no existing source), the phase prompt below says so explicitly and treats it as a stretch goal gated on backend availability, never as a silent mock.
6. **Every section is fault-isolated and independently lazy-loadable.** Follow the existing `app/page.tsx` pattern of `dynamic(() => import(...), { ssr: false })` for anything WebGL/ScrollTrigger-heavy that isn't needed for first paint. The hero's headline and primary CTA must be visible and interactive before any GSAP or Three.js bundle finishes downloading — this is already how `OrderFlowTape` and `DashboardMockSection` are wired; preserve and extend the pattern, don't regress it.
7. **Accessibility is mandatory, not a follow-up.** 4.5:1 contrast for all body text against its actual rendered background (glow gradients make this easy to violate — check contrast *with* the glow visible, not against the flat canvas color). Every animated entrance must have a static, fully-readable end state reachable instantly via `prefers-reduced-motion`. All interactive elements keyboard-reachable in visual order, visible focus rings using `land-accent`, no purely-hover-revealed content that has no keyboard-accessible equivalent.
8. **Do not touch unrelated code.** Each phase prompt states its file boundary. Global CSS additions happen only in the `land-*`-namespaced block of `app/globals.css` (Phase 0 creates it) — never edit the Meridian `mer-*` block or the pre-existing `mkt-*` block's *values* (Phase 0 may *add* new `mkt-`-adjacent `land-` variables alongside them, never rename or repoint the existing ones, since `mkt-action-hue` etc. may still be referenced elsewhere).
9. **After each phase's implementation**: run the code-reviewer pass, fix CRITICAL/HIGH, verify against that phase's Do/Don't list, and actually exercise the section in a real browser (dev server, both a ~1440px desktop viewport and a ~390px mobile viewport, both color-scheme states if applicable, and with `prefers-reduced-motion: reduce` forced on once) before calling the phase done. Type-checking is not feature verification.
10. **Every phase prompt below is self-contained enough to paste into a fresh session** — it restates the relevant token names, file paths, and constraints it depends on rather than assuming the executing session remembers earlier phases. Cross-phase dependencies are called out explicitly under each phase's "Depends on" line.

---

# Aurora Motion Timing Table (canonical — cite by name, do not redefine)

| Name | Duration | Easing | Used for |
|---|---|---|---|
| `land-instant` | 100ms | `power1.out` | Active/pressed state feedback |
| `land-hover` | 180ms | `power2.out` | Button/card hover, glow intensity change |
| `land-reveal` | 600ms | `power3.out` | Element entrance (fade + rise 24px) |
| `land-reveal-stagger` | 80ms offset | — | Delay between siblings in a staggered reveal group |
| `land-hero-in` | 900ms | `power4.out` | Hero headline/CTA entrance timeline on load |
| `land-scroll-scrub` | scrubbed to scroll position, `scrub: 0.6` | linear (scrub-driven) | Parallax depth layers tied to scroll |
| `land-pin-step` | 500ms per step transition | `power2.inOut` | Scroll-story pinned step changes (Phase 4) |
| `land-glow-pulse` | 3200ms loop | `sine.inOut`, yoyo | Ambient background glow breathing |
| `land-count-up` | 1400ms | `power2.out` | Stat number count-up on scroll-into-view |
| `land-nav-collapse` | 240ms | `power2.inOut` | Nav background/blur appearing on scroll |

Nothing on this page bounces, overshoots past its rest state, or spins. Glow may pulse; layout never does.

---

# Aurora Token Table (canonical — full definitions written in Phase 0)

| Token | Value | Role |
|---|---|---|
| `--land-canvas` | `#050608` | Page background (near-black, not pure — leaves room for glow falloff) |
| `--land-surface-1` | `#0B0E14` | Card/panel base |
| `--land-surface-2` | `#12161F` | Elevated card, nav-on-scroll background (with blur) |
| `--land-border` | `rgba(255,255,255,0.08)` | Hairline borders |
| `--land-border-glow` | `rgba(62,111,224,0.35)` | Hover/active borders |
| `--land-text-primary` | `#F5F6F8` | Headlines, primary copy |
| `--land-text-secondary` | `#9BA4B5` | Body copy, subheads |
| `--land-text-tertiary` | `#5C6577` | Captions, meta |
| `--land-accent` | `#0055FF` | Primary accent — reuses existing `--mkt-action-hue` value verbatim |
| `--land-accent-bright` | `#3E8BFF` | Hover/active accent, glow core color |
| `--land-accent-glow` | `rgba(0,85,255,0.45)` | `box-shadow`/`filter: drop-shadow` glow color |
| `--land-accent-glow-soft` | `rgba(0,85,255,0.18)` | Ambient background aurora blobs |
| `--land-market-up` | `#3FBF85` | Reused verbatim from Meridian dark-theme `market-up` — direction-only, never decorative |
| `--land-radius-pill` | `999px` | Buttons, badges, pills |
| `--land-radius-lg` | `28px` | Hero cards, feature cards |
| `--land-radius-md` | `20px` | Small cards, inputs |

Full token block, including responsive type scale and spacing scale, is written out completely in Phase 0 below — this table is the index, Phase 0 is the source.

---

# PHASE 0 — Aurora Design Tokens & Primitives

**Depends on:** nothing. This is the foundation every other phase imports from.
**File boundary:** `app/globals.css` (new `land-*` block only, additive), `tailwind.config.ts` (new `land` color/radius/spacing extensions, additive), `components/ui/button.tsx` (new CVA variant, additive), new files under `components/marketing/aurora/` for shared primitives.
**No page sections are built in this phase.** This phase produces the vocabulary every later phase speaks.

## Master Prompt

```
Lay the foundation for the Aurora landing design language, defined in HOMEPAGE_REVAMP_MASTER_PLAN.md. This is
purely infrastructure — tokens, primitives, no page content — but every later phase depends on it being exact,
so treat naming and values as final, not draft.

1. TOKENS — app/globals.css
   Add a new block, clearly commented as the Aurora landing-only layer, placed after the existing --mkt-*
   block (do not remove, rename, or repoint any existing --mkt-* variable — --mkt-action-hue, --mkt-bg-void,
   --mkt-text-hero etc. must continue to resolve to their current values verbatim, since components not yet
   migrated in this plan may still reference them until Phase 8).

   Colors (exact hex/rgba, no deviation):
     --land-canvas: #050608;
     --land-surface-1: #0B0E14;
     --land-surface-2: #12161F;
     --land-surface-3: #1A1F2B;          /* new: third elevation, for nested elements inside cards */
     --land-border: rgba(255,255,255,0.08);
     --land-border-strong: rgba(255,255,255,0.14);
     --land-border-glow: rgba(62,111,224,0.35);
     --land-text-primary: #F5F6F8;
     --land-text-secondary: #9BA4B5;
     --land-text-tertiary: #5C6577;
     --land-accent: #0055FF;              /* identical value to --mkt-action-hue, intentionally */
     --land-accent-bright: #3E8BFF;
     --land-accent-dim: #0040C4;          /* identical value to --mkt-action-hue-pressed */
     --land-accent-glow: rgba(0,85,255,0.45);
     --land-accent-glow-soft: rgba(0,85,255,0.18);
     --land-accent-glow-faint: rgba(0,85,255,0.08);
     --land-market-up: #3FBF85;
     --land-warn: #D9922E;

   Radii:
     --land-radius-pill: 999px;
     --land-radius-lg: 28px;
     --land-radius-md: 20px;
     --land-radius-sm: 14px;              /* matches Meridian's cap, used for the smallest Aurora elements
                                              (badges, chips) so nothing on the page reads as *less* rounded
                                              than the app shell — everything on the landing page is >= as
                                              round as Meridian's ceiling, never less */

   Type scale (Inter, already loaded via next/font/google in app/layout.tsx as --font-inter — do not add a
   second font import):
     --land-text-display: clamp(2.75rem, 6vw, 5.5rem);   /* hero headline, weight 800, tracking -0.02em,
                                                              line-height 0.98 */
     --land-text-h1: clamp(2rem, 4vw, 3.25rem);           /* section headlines, weight 700, tracking -0.015em,
                                                              line-height 1.05 */
     --land-text-h2: clamp(1.375rem, 2.2vw, 1.75rem);     /* card/subsection titles, weight 700, line-height 1.15 */
     --land-text-body-lg: 1.125rem;                       /* hero subhead, weight 500, line-height 1.5 */
     --land-text-body: 1rem;                              /* default copy, weight 400, line-height 1.6 */
     --land-text-small: 0.875rem;                         /* captions, nav links, weight 500 */
     --land-text-micro: 0.75rem;                          /* eyebrow labels, badges, weight 600, tracking 0.08em,
                                                              uppercase */

   Spacing (4px base grid, same discipline as Meridian's grid-* scale but under a land- prefix to keep the two
   systems visually and mechanically separate):
     --land-space-section-y: clamp(4rem, 10vw, 8rem);     /* vertical padding between major sections */
     --land-space-container-x: clamp(1.25rem, 5vw, 4rem); /* horizontal page margin */
     Container max-width: 1440px, centered, via a shared AuroraContainer primitive (below) — no section
     hand-rolls its own max-width/margin-auto.

   Shadows / glow utilities (as CSS custom properties consumed by Tailwind arbitrary values, not new keyframes
   here — keyframes belong to individual components):
     --land-shadow-card: 0 1px 2px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.35);
     --land-shadow-glow-sm: 0 0 24px var(--land-accent-glow-soft);
     --land-shadow-glow-md: 0 0 48px var(--land-accent-glow);
     --land-shadow-glow-lg: 0 0 96px var(--land-accent-glow);

2. TAILWIND EXTENSION — tailwind.config.ts
   Under theme.extend, add a `land` namespace mirroring the existing `mkt` namespace's structure (look at how
   `mkt` is wired to its CSS variables — same pattern, new prefix):
     colors.land = { canvas, "surface-1", "surface-2", "surface-3", border, "border-strong", "border-glow",
       "text-primary", "text-secondary", "text-tertiary", accent, "accent-bright", "accent-dim",
       "accent-glow", "accent-glow-soft", "accent-glow-faint", "market-up", warn }
     borderRadius.land = { pill, lg, md, sm }  → mapped to the --land-radius-* variables
   Do not add land- entries to fontSize/spacing in Tailwind config — those stay as CSS custom properties
   consumed via Tailwind's arbitrary-value syntax (text-[length:var(--land-text-h1)] etc.) or, preferably, via
   the typographic primitives built in step 4, so call sites don't repeat clamp() expressions inline.

3. BUTTON — components/ui/button.tsx
   Extend the existing CVA config, do not fork a new component:
     - New variant "glow": bg-land-accent text-white, box-shadow: var(--land-shadow-glow-sm) at rest,
       transitions to var(--land-shadow-glow-md) + bg-land-accent-bright on hover, using the land-hover timing
       (180ms power2.out — implement via Tailwind transition-shadow/transition-colors duration-[180ms] and a
       CSS easing var, not a GSAP tween, since this is a stateless CSS hover, not scroll- or load-driven).
       Active/pressed state: bg-land-accent-dim, shadow drops to glow-sm, land-instant timing (100ms).
     - New variant "glow-outline": transparent bg, 1.5px border in land-border, text land-text-primary; hover
       transitions border to land-border-glow and adds shadow-[var(--land-shadow-glow-sm)], same timings.
     - New size "xl": h-14 px-8 text-[length:var(--land-text-body-lg)] font-semibold — the hero CTA size.
     - Both new variants must set borderRadius via land-radius-pill regardless of size — pill shape is
       non-negotiable for every Aurora button, this is the signature shape difference from Meridian's
       radius-sm buttons.
     - Verify the existing variants (default, buy, sell, destructive, outline, secondary, ghost, link) and
       existing sizes (default, sm, lg, icon) are completely unaffected — this is a pure addition, run every
       existing usage of <Button> in the authenticated app after this change and confirm zero visual diff.

4. SHARED PRIMITIVES — new files under components/marketing/aurora/
   Build these now so every later phase imports rather than reinvents:

   a. AuroraContainer.tsx — the shared max-width/padding wrapper (max-w-[1440px] mx-auto px-[length:var(
      --land-space-container-x)]). Every section in Phases 1-6 wraps its content in this.

   b. AuroraGlowField.tsx — a purely decorative, aria-hidden, absolutely-positioned layer of 2-3 large
      blurred radial gradients (using land-accent-glow-soft / land-accent-glow-faint) that sections can drop
      behind their content for ambient depth. Accepts a `variant` prop ("hero" | "subtle" | "corner") that
      controls blob count/position/size — do not let every section invent its own gradient blob markup,
      centralize it here. Must render as static (no animation) when useReducedMotion() is true; otherwise
      applies the land-glow-pulse breathing loop (3200ms, sine.inOut, yoyo, opacity 0.6 <-> 1) via GSAP,
      registered once per mount and killed on unmount.

   c. AuroraReveal.tsx — a wrapper component implementing the standard scroll-triggered entrance (land-reveal:
      fade in + rise 24px, 600ms power3.out, ScrollTrigger start "top 85%", once: true) with an optional
      `stagger` prop for children (land-reveal-stagger: 80ms offset between children, applied via GSAP's
      stagger option on a single timeline, not N separate ScrollTriggers — one trigger per section is a hard
      performance requirement, not a suggestion). Falls back to a plain opacity-1 static render with zero
      transform when useReducedMotion() is true. Every section built in Phases 1-6 wraps its scroll-revealed
      content in this rather than writing its own ScrollTrigger boilerplate.

   d. AuroraEyebrow.tsx — the small uppercase label component used above section headlines (text-[length:var(
      --land-text-micro)] tracking-[0.08em] uppercase text-land-accent-bright, with a small pill dot before
      it). Purely presentational, no animation.

   e. AuroraBadge.tsx — small pill chips (e.g. "Live", "AI-Powered") — land-radius-pill, land-surface-2 bg,
      land-border, land-text-small.

   Each primitive gets a one-line JSDoc stating what it does and what it depends on (useReducedMotion, GSAP
   registration pattern) — no multi-paragraph doc comments, this codebase's convention is terse.

5. FONT VERIFICATION
   Confirm Inter is loaded with weights 400/500/600/700/800 in app/layout.tsx's next/font/google config (it
   currently may only load a subset — check, and extend the `weight` array if 800 isn't already present, since
   the Aurora display type scale requires it). Do not add a second Google Fonts import or a new <link> tag —
   extend the existing next/font/google Inter instance's weight array only.

DESIGN — apply this document precisely:
- Every color used anywhere in Phases 1-8 must trace to a land-* token defined here. If a phase's copy implies
  a color not in this table (it shouldn't), stop and add it here first, don't inline a hex value.
- Pill radius on every button/badge, no exceptions — this is Aurora's signature shape, equivalent in role to
  Meridian's Ledger Line.
- Glow is restrained: land-shadow-glow-sm at rest, -md on hover/focus, -lg only for the single most important
  CTA on the page (the hero's primary button and the final CTA section) — if everything glows at max intensity
  nothing reads as emphasized.

DO:
- Extend button.tsx's existing CVA config in place.
- Mirror the tailwind.config.ts `mkt` namespace's wiring pattern exactly for the new `land` namespace, so the
  two systems are structurally consistent even though their values differ.
- Make every primitive here reduced-motion-safe by construction, so no later phase has to remember to check.

DON'T:
- Don't touch any existing --mkt-* or --mer-* variable's value.
- Don't create a second Button component — extend the existing one.
- Don't add animation logic inline in a page section component when it belongs in AuroraReveal/AuroraGlowField
  — the whole point of this phase is that later phases import primitives instead of duplicating ScrollTrigger
  setup nine times.
- Don't build any actual page section content yet — that starts Phase 1.
```

---

# PHASE 1 — Navigation & Hero

**Depends on:** Phase 0 (land-* tokens, Button glow variant, AuroraContainer, AuroraGlowField, AuroraReveal, AuroraEyebrow).
**File boundary:** new `components/marketing/aurora/AuroraNav.tsx`, `components/marketing/aurora/AuroraHero.tsx`, new `components/marketing/aurora/HeroWebGLField.tsx` (the one permitted WebGL canvas). Does not touch `app/page.tsx` wiring yet — that happens incrementally as each phase lands, or all at once in Phase 8; state your choice in the PR and stay consistent with prior phases' choice.

## Master Prompt

```
Build the navigation bar and hero section for the Aurora-revamped homepage, per HOMEPAGE_REVAMP_MASTER_PLAN.md.
Phase 0 must already be merged — import land-* Tailwind classes, the extended Button (variant="glow" | "glow-
outline", size="xl"), and AuroraContainer/AuroraGlowField/AuroraReveal/AuroraEyebrow from
components/marketing/aurora/. Do not redefine any token or primitive Phase 0 already created.

1. NAVIGATION — components/marketing/aurora/AuroraNav.tsx
   - Fixed top, full width, transparent at scroll position 0. On scroll past ~40px, background transitions to
     land-surface-2 at 80% opacity with backdrop-blur-xl and a 1px bottom border in land-border — driven by a
     single ScrollTrigger (start: "top -40", toggleClass or onEnter/onLeaveBack pattern), land-nav-collapse
     timing (240ms power2.inOut). Reduced-motion: background applies instantly via a scroll listener's boolean
     state, no animated blur value.
   - Layout: logo/wordmark left ("MarketVerse" or existing logo asset — check components/layout/ for an
     existing logo component/SVG before creating a new one; reuse it recolored for dark canvas if it exists).
     Center or left-adjacent nav links (desktop only, hidden below md breakpoint): "Product", "How it works",
     "Pricing" (omit if no pricing page exists in the app — check app/ routes first, don't link to a 404).
     Right: "Sign in" (variant="ghost" or "glow-outline", links to /login) + "Get started" (variant="glow",
     size default, links to /register).
   - Mobile (< md): logo left, single hamburger right opening a full-screen land-canvas overlay menu (Radix
     Dialog, already a dependency — reuse the existing Dialog primitive from components/ui/, don't hand-roll
     a new overlay/focus-trap implementation) with the same links stacked, large touch targets (min 44px).
   - Nav is NOT sticky-hidden-on-scroll-down (no hide/show on scroll direction) — always visible once past the
     collapse threshold. Keep it simple; direction-aware hiding is explicitly out of scope for this phase.

2. HERO — components/marketing/aurora/AuroraHero.tsx
   Structure (mobile-first, single column below md, two-zone above):
   - AuroraGlowField variant="hero" as the background layer (from Phase 0), sitting behind everything, plus
     HeroWebGLField (below) as an additional, more literal depth layer specific to the hero only.
   - AuroraEyebrow: "Simulated markets. Real mechanics." (or similar — see copy block below) above the headline.
   - Headline (h1, --land-text-display, weight 800, land-text-primary): two-line, punchy, Apple-keynote
     register. Exact copy: "Trade a market that thinks back." / second line, slightly desaturated
     (land-text-secondary or a subtle gradient text treatment via bg-clip-text from land-text-primary to
     land-accent-bright): "No real money. Real intelligence underneath."
     (If this copy doesn't fit the actual product positioning once you've read README.md / DESIGN_SPEC.md's
     Vision section, adjust wording but preserve structure: punchy claim line + underneath-the-hood credibility
     line — don't ship generic "Welcome to MarketVerse" copy.)
   - Subhead (--land-text-body-lg, land-text-secondary, max-w ~40ch): one sentence expanding the promise —
     e.g. "Every price is driven by fundamentals, sentiment, and momentum — not a random walk. Practice,
     branch timelines, and see exactly why a stock moved."
   - CTA row: primary Button variant="glow" size="xl" → "Start simulating free" → /register. Secondary Button
     variant="glow-outline" size="xl" → "See how it works" → smooth-scrolls (GSAP ScrollToPlugin — check if
     already a dependency; if not, a plain scrollIntoView({behavior:'smooth'}) fallback wrapped in the
     reduced-motion check is acceptable, don't add a new GSAP plugin dependency for one smooth-scroll link) to
     the Phase 4 scroll-story section.
   - Small trust row beneath CTAs (optional but recommended): 2-3 AuroraBadge chips or plain small stats, e.g.
     "$0 to start" / "No credit card" — only include claims that are actually true of the product; verify
     against the actual registration flow (Phase 1 of REVAMP_MASTER_PLAN.md / current /register page) before
     writing this copy.
   - Entrance animation: land-hero-in timeline (900ms power4.out) — eyebrow, headline (word-level or line-level
     stagger, not character-level — character stagger is visual noise at this size), subhead, CTA row, trust
     row entering in that sequence with ~100ms offsets, on mount (not scroll-triggered, this is above the fold
     and must animate on load). Reduced-motion: all elements render at final state immediately, no timeline.

3. HERO WEBGL FIELD — components/marketing/aurora/HeroWebGLField.tsx
   - Single @react-three/fiber <Canvas>, absolutely positioned behind the hero's text content, z-index below
     it, pointer-events-none. Content: a small number (8-16) of soft, slowly drifting particles/nodes suggesting
     a "market data field" — connect nearby nodes with faint animated lines (a lightweight force-graph-ish
     look), all rendered in land-accent/land-accent-bright at low opacity, NOT the aggressive dense OrderFlowTape
     treatment from the old landing page — this must read as ambient depth behind readable text, not as a
     competing visual. Cap the particle/line count conservatively (this is explicitly a performance-sensitive
     decision — profile it, don't guess) and confirm 60fps on a mid-tier laptop before calling this done.
   - Must be dynamically imported with { ssr: false } exactly like the existing OrderFlowTape pattern in
     app/page.tsx, and must render nothing (or a static CSS gradient fallback) when useReducedMotion() is true
     — WebGL motion is exactly the kind of thing prefers-reduced-motion exists to suppress.
   - Respect a hard perf budget: if this canvas alone pushes First Contentful Paint or Total Blocking Time
     measurably (check via Lighthouse/DevTools before and after), simplify it further rather than shipping it
     over-budget — the hero's text must remain interactive immediately, this background is decoration.

DESIGN:
- Nav and hero are the very first thing every visitor sees — hold this phase to the highest polish bar in the
  whole plan. If something here feels merely "fine," it isn't done.
- Text over the WebGL/glow background must maintain 4.5:1 contrast at all times — verify with the particles/
  glow actually rendered, not against a flat land-canvas swatch in isolation.
- Nothing in the hero triggers layout shift after mount — reserve space for the WebGL canvas and all text
  before assets/fonts finish loading (Inter is already preloaded via next/font, so this should be low-risk,
  but verify CLS is ~0 in Lighthouse).

DO:
- Reuse the Dialog primitive for the mobile nav overlay.
- Cite land-hero-in and land-nav-collapse by name from the Motion Timing Table — don't invent new durations.
- Keep the WebGL field restrained; it is atmosphere, not a feature.

DON'T:
- Don't add a second WebGL canvas anywhere in the hero or nav — one Canvas, full stop.
- Don't hide the nav on scroll-down; only the background-appearance transition is in scope.
- Don't ship placeholder/lorem copy — write real, considered copy for every string in this phase, even if it
  gets refined later; "TODO: copy" is not acceptable in a merged phase.
```

---

# PHASE 2 — Live Preview (Screener & Simulation)

**Depends on:** Phase 0 (tokens/primitives). Loosely depends on Phase 1 only for visual continuity (this section immediately follows the hero) — can technically be built before Phase 1 lands, but should be reviewed against the hero once both exist.
**File boundary:** new `components/marketing/aurora/LivePreviewSection.tsx`, `components/marketing/aurora/ScreenerPreviewCard.tsx`, `components/marketing/aurora/SimulationPreviewCard.tsx`. Reads from `lib/api/hooks/usePublicMarket.ts` — read that hook's return shape first, do not assume fields it doesn't provide.

## Master Prompt

```
Build the "proof" section of the Aurora homepage — the section that shows, not tells, what the product actually
does. This is the section the earlier design discussion specifically called for instead of static screenshots:
two live, restyled, simplified React recreations of real product surfaces (the market screener and a simulation
price chart), built from real data via the existing public snapshot hook, not static images and not fabricated
mock numbers.

1. DATA — read first, don't assume
   Read lib/api/hooks/usePublicMarket.ts (usePublicMarketSnapshot, already imported in app/page.tsx today) and
   confirm exactly what it returns per company (price, change/changePercent, name/ticker, sector, market cap —
   whatever is actually there). This phase's two preview cards may ONLY use fields this hook actually returns.
   If a desired visual (e.g. a full OHLC candle history for the sim chart) needs data the hook doesn't provide,
   do not fabricate it — either derive a defensible visualization from what IS available (e.g. a sparkline from
   however much history the snapshot includes, even if short), or fall back to a clearly-labeled illustrative
   pattern generated client-side with a fixed seed (not Math.random() re-rolled per render, so it doesn't jitter
   on every re-fetch) and a small "illustrative" caption — never silently invent numbers that look like real
   product output. Flag in the PR description which path you took.

2. SECTION SHELL — LivePreviewSection.tsx
   - AuroraEyebrow: "See it in motion". Headline (--land-text-h1): "This isn't a mockup." / subhead: "Every
     number below is live from the actual simulation engine." (Only ship this exact claim if step 1 confirms
     the data is genuinely live from usePublicMarketSnapshot — if you had to fall back to the illustrative
     path for one or both cards, rewrite the copy to not claim "live" for the illustrative one specifically.)
   - Two-column layout on desktop (lg:grid-cols-2, gap-8), stacked on mobile. Each column is one preview card,
     wrapped individually in AuroraReveal so they animate in independently as the user scrolls to them (not as
     one fused block).
   - Section sits on land-surface-1 (a subtly distinct band from the pure land-canvas hero above it) to create
     a clear visual "zone change" as the user scrolls past the hero — use AuroraGlowField variant="subtle"
     behind it, not "hero" (that variant is reserved for the hero per Phase 0/1).

3. SCREENER PREVIEW — ScreenerPreviewCard.tsx
   - A card (land-surface-2, land-radius-lg, land-border, land-shadow-card) containing a simplified table: logo/
     ticker, company name, price (tabular-nums, JetBrains Mono — the existing --font-jetbrains-mono is already
     loaded in app/layout.tsx, reuse it for every numeric value in both preview cards, this is the one place
     Aurora borrows a Meridian-style convention deliberately, because misaligned financial figures look broken
     regardless of design language), change % (land-market-up green if positive, Meridian's market-down red
     equivalent if negative — reuse Meridian's --mer-market-down hex value directly here since Aurora doesn't
     define its own down-color in the Phase 0 token table; add it to Phase 0's table retroactively as
     --land-market-down if you do this, don't leave an undocumented color in the codebase).
   - Show 5-6 real companies from the snapshot, sorted by |change%| descending so the preview always shows some
     visible movement rather than a flat, boring slice. Auto-refresh in place if the underlying TanStack Query
     hook refetches (don't disable refetching for the marketing page — this is the "always alive" proof point),
     with a subtle GSAP flash-highlight (reuse the existing --flash-color mechanism referenced in globals.css
     if applicable, or a simple 400ms background-color pulse to land-accent-glow-faint and back) on rows whose
     price changed since the last render, gated behind useReducedMotion() as always.
   - Card header: small AuroraBadge "Live" with a pulsing dot (CSS-only, not GSAP, since it's a permanent
     ambient loop — use a Tailwind animate-pulse-style keyframe defined under the land- namespace, respecting
     reduced-motion by freezing the dot's opacity at 1).
   - Footer link inside the card: "Open the full screener" → /market (or wherever the real screener route is —
     confirm via app/market/page.tsx before linking).

4. SIMULATION PREVIEW — SimulationPreviewCard.tsx
   - Same card chrome as the screener card, for visual pairing (same padding, radius, border, shadow — build
     both from a shared AuroraPreviewCardShell if the duplication is more than trivial, following the codebase's
     DRY convention).
   - Content: one company's price history rendered as a smooth SVG line/area chart in land-accent-bright with a
     soft gradient fill fading to transparent (land-accent-glow-soft at the line, fading to nothing at the
     bottom) — this is a simplified, purely visual chart, NOT a port of whatever full charting component the
     real simulation page uses (check app/simulation/page.tsx briefly to confirm you're not duplicating a
     heavy charting library import here; this preview should be lightweight, hand-rolled SVG path generation is
     sufficient and consistent with this codebase's existing preference for hand-rolled SVG charts over a
     charting library, per prior project decisions).
   - If the snapshot data includes any historical series, use it; if it only includes current price + change
     (most likely, given it's a "snapshot"), use the illustrative-seeded-path fallback from step 1, clearly
     captioned, and pick a company name + starting price that ARE real (don't invent a fake ticker).
   - A small "intrinsic value" reference line (dashed, land-text-tertiary) crossing the chart if that concept is
     visually presentable from available data, referencing the real product's value-vs-price mechanic described
     in DESIGN_SPEC.md's Vision section — this is a good place to make the product's actual differentiator
     ("price drifts toward intrinsic value") visible, not just a generic stock chart.
   - Footer link: "Try the simulator" → /simulation (confirm actual route/auth-gating first — if simulation is
     fully gated behind auth with no public demo, this CTA should route to /register with a redirect param
     instead of a route the visitor will immediately bounce off of; check middleware.ts's protected route list
     from the auth phase work before deciding).

DESIGN:
- Both cards must look like they belong to the same product as the hero — same land- tokens, same radius,
  same glow language — while clearly reading as "product UI" rather than "marketing decoration." A small
  amount of visual density (real table rows, a real chart) is appropriate and expected here, more than
  anywhere else on the page; this section's whole job is credibility through specificity.
- Tabular numerals and JetBrains Mono for every number, no exceptions, in this section specifically.

DO:
- Read usePublicMarketSnapshot's actual return type before writing any field access.
- Keep both cards visually paired (matching chrome) even though their internal content differs.
- Caption any illustrative/non-live data honestly.

DON'T:
- Don't import a new charting library for the simulation preview — hand-rolled SVG only.
- Don't fabricate numbers and present them as live.
- Don't link the "Try the simulator" CTA to a route that will immediately reject an unauthenticated visitor
  without a clear path forward (redirect param or a register-first flow).
```

---

# PHASE 3 — Feature / Value Grid

**Depends on:** Phase 0 (tokens/primitives).
**File boundary:** new `components/marketing/aurora/FeatureGridSection.tsx`, `components/marketing/aurora/FeatureCard.tsx`.

## Master Prompt

```
Build the feature/value grid section — the section that replaces the current landing page's numbered "01/02/03"
list (app/page.tsx lines ~44-73: "Intrinsic value engine", "Seven price drivers", "Branch the timeline") with a
proper Aurora bento-style card grid. The three existing concepts are strong and factually grounded in the real
engine — keep the underlying claims, rewrite the presentation.

1. SECTION SHELL — FeatureGridSection.tsx
   - AuroraEyebrow: "Under the hood". Headline: "A market that reasons, not rolls dice."
   - Grid: CSS grid, asymmetric bento layout on desktop (e.g. one 2-column-span "hero" feature card + several
     1-column cards — do not just do a uniform 3-up grid, that's the exact "mediocre" flatness this revamp is
     replacing), collapsing to a single column stack on mobile. Use CSS grid-template-areas or explicit
     col-span/row-span utility classes, not a JS masonry library — this layout is static/known at build time,
     a library is unjustified complexity here.
   - 5-6 cards total, each wrapped in AuroraReveal with stagger so they cascade in as the grid scrolls into view.

2. CARD CONTENT (ground every card in something real — check DESIGN_SPEC.md's Vision section and the engine/
   directory mentioned in REVAMP_MASTER_PLAN.md's Current State Snapshot before finalizing claims):
   a. "Intrinsic value engine" (large/hero card) — every company has a real fundamentals chain (financial
      statements, factor scores, PEG-based fair value) that drifts with growth expectations and sentiment.
      This card gets a small inline visual: a minimal 2-line diagram or icon-based illustration (SVG, hand-
      drawn/geometric style consistent with land- tokens) showing "fundamentals -> fair value -> price gap" —
      not a screenshot, an abstract diagram.
   b. "Seven price drivers" — value gap, earnings surprises, news sentiment, economic outlook, guidance,
      technical momentum, institutional buying pressure, mean-reverting toward intrinsic value. Represent the
      seven drivers as a small radial/orbit icon cluster or a compact tag list, not a wall of text — this is a
      dense claim, the card should make it scannable in 2 seconds, with the full detail in a one-sentence body.
   c. "Branch the timeline" — fork the simulation at any point, seeded randomness, event overrides. Small
      visual: a simple branching-line diagram (SVG, 2-3 branches diverging from a point) in land-accent tones.
   d-f. Fill remaining slots with real, verifiable capabilities pulled from the actual product surface — check
      app/dashboard, app/portfolio, app/trading, app/ai routes for what's actually built (per REVAMP_MASTER_PLAN
      .md's Current State Snapshot: 15-module dashboard, institutional portfolio workspace, AI workspace is
      "fully greenfield" per that doc — do NOT claim AI features are live if Phase 5 of the OTHER master plan
      hasn't shipped; check current git state, not just the planning doc, since it may have progressed). Good
      candidates if verified real: multi-named watchlists, dividend history tracking, order-flow/trading desk.
      Do not pad the grid with a vague/unverifiable card just to hit a card count — 5 strong cards beats 6 with
      one weak one.
   Each card: AuroraBadge or small icon top-left, --land-text-h2 title, 1-2 sentence body in land-text-secondary,
   land-surface-2 background, land-border, hover state raises to land-border-glow + land-shadow-glow-sm (land-
   hover timing, CSS transition, not GSAP — this is a stateless hover).

3. MICRO-INTERACTION
   Each card's inline SVG illustration gets a subtle idle animation on hover only (e.g. the branch diagram's
   lines drawing in via stroke-dashoffset, land-hover-adjacent timing ~300ms) — small, tasteful, not a full
   animation loop running constantly (that would fight the deliberate restraint set by the ambient-glow-only
   rule elsewhere). Reduced-motion: illustrations render in their complete end state always, no draw-in.

DESIGN:
- This section is where "quiet confidence" meets "Apple-keynote boldness" — headlines are big and declarative,
  bodies are short, no more than 2 sentences per card. If a card's body needs a 3rd sentence to make sense, the
  claim is too complex for this format — simplify the claim or cut the card.
- Every numeric or factual claim in this section must be true of the actual shipped product at time of writing
  — verify against real routes/backend state, don't carry forward aspirational copy from an older marketing
  draft uncritically.

DO:
- Preserve the three original concepts (intrinsic value, seven drivers, branch timeline) as the anchor content.
- Use CSS grid with explicit spans for the bento layout, no JS masonry dependency.
- Keep hover interactions CSS-driven, reserve GSAP for scroll-triggered entrance only.

DON'T:
- Don't claim features that aren't actually live in the current codebase — verify, don't assume the other
  master plan's phases have shipped.
- Don't fill slots with filler cards just to reach a target count.
- Don't run illustration animations as permanent idle loops — hover/focus-triggered only, per the "nothing
  flashes or shouts" restraint principle carried over from this codebase's existing design philosophy.
```

---

# PHASE 4 — Scroll-Driven Story ("How It Works")

**Depends on:** Phase 0 (tokens/primitives, Motion Timing Table's `land-pin-step` and `land-scroll-scrub`).
**File boundary:** new `components/marketing/aurora/ScrollStorySection.tsx` and its sub-steps under `components/marketing/aurora/story-steps/`.

## Master Prompt

```
Build the pinned scroll-driven "how it works" story — the single most GSAP-heavy section on the page and the
main "depth effects" showcase the overall revamp brief called for. This is a step-through narrative: the
viewport pins while the user scrolls, and content swaps/transforms in place across 3-4 steps before releasing
scroll back to the normal document flow.

1. STRUCTURE
   - A single ScrollTrigger with pin: true, pinning a fixed-height stage (viewport height on desktop; consider
     disabling the pin behavior entirely below md/lg breakpoint in favor of a normal stacked-section fallback —
     pinned scroll-jacking on mobile is a known UX hazard [awkward pinch-scroll fighting] and is explicitly
     OUT OF SCOPE for mobile; mobile gets the same 3-4 steps as plain stacked AuroraReveal sections instead).
   - The pinned stage is scrubbed (scrub: 0.6, matching land-scroll-scrub) across a scroll distance of roughly
     (steps * 100vh) — exact multiplier tuned during implementation so each step gets comfortable dwell time,
     not so long it feels stuck, not so short it whips past. This number is a build-time judgment call, not a
     fixed spec value; get it to feel right, don't guess-and-ship a random multiplier.
   - Left side (or top, responsive): step indicator — a vertical (horizontal on mobile-stacked-fallback) list of
     step numbers/titles, current step highlighted with the land-accent-bright color and a small Ledger-Line-
     style animated underline/sideline that redraws as steps change (land-pin-step timing, 500ms power2.inOut).
   - Right side (or below): the actual step visual — swaps per step (crossfade + slight scale/position shift,
     not a hard cut, not a slide — see per-step visuals below).

2. STEPS (4 steps, grounded in the real simulation mechanics per DESIGN_SPEC.md's Vision and the engine/
   directory referenced in REVAMP_MASTER_PLAN.md):
   Step 1 — "Start with real fundamentals": visual shows a small abstracted "financial statement -> fair value"
     diagram (can reuse/extend the Phase 3 hero-card diagram at larger scale, don't build a third redundant
     version of the same idea from scratch).
   Step 2 — "Price finds its own way": visual shows a simple animated line chart where price wobbles around a
     dashed fair-value line (same visual vocabulary as Phase 2's simulation preview chart — reuse the SVG
     generation approach, don't reinvent chart rendering a third time in this codebase).
   Step 3 — "React to real events": visual shows a small feed of 2-3 abstracted "news/event" cards sliding in,
     representing the earnings surprises/news sentiment/guidance drivers — connects to the "seven price drivers"
     card from Phase 3, reference it thematically.
   Step 4 — "Branch and compare": visual shows the timeline-branching diagram (again, reuse Phase 3's branch
     SVG at a larger, more detailed scale rather than a fresh illustration) with two branches now showing
     visibly different outcomes.
   Each step's title/body copy: --land-text-h2 title, 1-2 sentence body, land-text-secondary.

3. IMPLEMENTATION DETAIL
   - Use a single GSAP timeline driven by the pinning ScrollTrigger; step transitions are timeline labels, not
     four separate ScrollTrigger instances — this keeps scroll math correct and avoids the layout-thrash risk of
     multiple independent pins in sequence.
   - Step visuals crossfade via opacity + a small (8-12px) translateY, not display:none swaps (which would
     break the crossfade) — keep both the outgoing and incoming step visuals mounted with absolute positioning
     stacked on top of each other during the transition window, per standard GSAP crossfade pattern.
   - Reduced-motion fallback: no pinning at all. Render all 4 steps as a normal stacked list (title + body +
     static end-state visual for each), each wrapped in AuroraReveal for a simple fade-in-on-scroll instead —
     the "pin and scrub" mechanic is explicitly presentation-only motion, the content must be fully consumable
     without it.

DESIGN:
- This section is the plan's primary "depth" showcase — it should feel considered and cinematic without ever
  feeling slow or making the user feel scroll-trapped. If early testing (scrolling through it yourself,
  repeatedly, at different scroll speeds including fast flicks) feels janky or like scroll got "stuck," the
  scrub value and/or per-step distance needs tuning before this phase is done — this is a hands-on-keyboard
  tuning requirement, not something to leave at a first-guess value.
- Keep the visual vocabulary consistent with Phase 2 and Phase 3 — this section is explicitly designed to reuse
  and recontextualize those earlier visuals at a larger scale, reinforcing the story rather than introducing a
  fourth unrelated visual style.

DO:
- Build one GSAP timeline with labeled steps, not four separate pins.
- Fully disable pinning below the lg breakpoint in favor of a plain stacked fallback.
- Reuse SVG generation logic from Phases 2 and 3 rather than triplicating chart/diagram code — extract a small
  shared helper under components/marketing/aurora/lib/ if reuse is more than trivial copy-paste.

DON'T:
- Don't ship scroll-jacking pin behavior on mobile/tablet — stacked fallback only below lg.
- Don't use display:none for step-visual swaps (breaks crossfade) — use stacked absolute positioning + opacity.
- Don't leave the scrub/distance values at an untested first guess — actually scroll through it and tune.
```

---

# PHASE 5 — Stats, Final CTA & Footer

**Depends on:** Phase 0 (tokens/primitives). Loosely follows Phase 4 in page order.
**File boundary:** new `components/marketing/aurora/StatsSection.tsx`, `components/marketing/aurora/FinalCtaSection.tsx`, `components/marketing/aurora/AuroraFooter.tsx`.

## Master Prompt

```
Build the closing third of the homepage: a lightweight stats/social-proof row, the final high-emphasis CTA
panel, and the footer.

1. STATS SECTION — StatsSection.tsx
   - 3-4 stat tiles in a row (stacked on mobile), each: a large --land-text-h1-scale number (JetBrains Mono,
     tabular-nums) + a short label beneath in land-text-secondary.
   - CRITICAL CONSTRAINT: every stat must be either (a) genuinely derivable from real data via
     usePublicMarketSnapshot or another already-existing public source (e.g. "N companies simulated", "N years
     of simulated history" if the snapshot/timeline data exposes that), or (b) a static, honest claim about the
     product mechanics that needs no live number (e.g. "7 price drivers", "Unlimited timeline branches" — both
     already true per Phase 3's content, safe to restate here as stats-style callouts). DO NOT invent social-
     proof numbers (fake user counts, fake trade counts, fake dollar-volume-simulated figures) — this product
     has no real user base being marketed here in a way that would make invented numbers appropriate, and
     fabricated stats are a credibility risk, not a growth tactic. If there is no genuine live number available
     for a slot, fill it with a mechanic-based stat instead, per (b).
   - Numbers sourced live via (a) get the land-count-up animation (1400ms power2.out, counting from 0 to the
     real value) on scroll-into-view, once, via a small shared useCountUp hook (new, under
     components/marketing/aurora/lib/) — gated behind useReducedMotion() (renders final value immediately when
     true). Static mechanic-based stats from (b) do not need a count-up (there's no meaningful "counting" to a
     number like "7") — just a plain reveal via AuroraReveal.

2. FINAL CTA — FinalCtaSection.tsx
   - The single highest-emphasis visual moment on the page besides the hero — this is where land-shadow-glow-lg
     is used (per Phase 0's rule that only the hero primary CTA and this section get the largest glow).
   - Large card or full-bleed band, land-surface-2 background with a strong AuroraGlowField "hero"-variant
     background (reuse the hero's variant, this section is a deliberate visual echo of the hero, bookending the
     page).
   - Headline (--land-text-h1): "Ready to see the market move?" (or similar — must read as a natural conclusion
     to the page's narrative arc, write it after Phases 1-4's copy exists so the tone matches, don't write it
     in isolation first). Subhead: one line reinforcing "no real money, no real risk" (carry this exact framing
     forward from the current app/page.tsx final section — it's a legally/ethically important disclosure-style
     line for a trading-simulation product, don't drop it in the rewrite).
   - CTA: Button variant="glow" size="xl" → "Start simulating free" → /register (same primary action as the
     hero — consistency, not novelty, in the final ask). Secondary: plain text/ghost link "Already have an
     account? Sign in" → /login.

3. FOOTER — AuroraFooter.tsx
   - Simple, restrained — this is not a large multi-column marketing footer (the product has no blog/careers/
     social-media presence to fill columns with; check for any existing footer link list before inventing
     links, and do not invent links to pages that don't exist). Logo/wordmark, one line of copyright
     ("© 2026 MarketVerse" or actual product name — confirm from README.md/package.json name field), and 2-3
     real links only if real destinations exist (e.g. GitHub repo link if public, a Terms/Privacy page if one
     exists in app/ routes — check before linking, 404s in a footer are an easy, avoidable embarrassment).
   - land-surface-1 background, top border in land-border, land-text-tertiary text, no glow, no animation —
     the footer is deliberately the quietest element on the page, a visual exhale after the Final CTA's
     intensity.

DESIGN:
- The Final CTA is allowed to be the loudest moment on the page (max glow) precisely because everything else
  has been comparatively restrained — if earlier sections already used land-shadow-glow-lg liberally, this
  section won't read as a climax. Audit the rest of the page's glow usage before finalizing this section.
- Footer is intentionally anticlimactic in tone — resist the urge to add another CTA or glow element here.

DO:
- Verify every stat number against a real data source or restate it as a static mechanic fact — no invented
  social-proof numbers.
- Reuse the hero's AuroraGlowField "hero" variant for the Final CTA to create a bookend effect.
- Keep the footer minimal and link only to routes that actually exist.

DON'T:
- Don't fabricate user/trade/volume counts.
- Don't drop the "no real money, no real risk" disclosure line — carry it forward from the current copy.
- Don't build a large multi-column footer with placeholder links.
```

---

# PHASE 6 — Motion & Micro-Interaction Polish Pass

**Depends on:** Phases 0-5 all merged. This phase touches every file created so far; it adds no new sections.
**File boundary:** all `components/marketing/aurora/**` files created in Phases 1-5. No new sections, no scope expansion — refinement only.

## Master Prompt

```
This phase is a dedicated polish pass across the whole Aurora homepage (Phases 0-5 must already be merged). Its
job is to catch the details that get skipped when building section-by-section: cross-section consistency,
cursor-following micro-interactions, and the small "alive" touches that separate "assembled" from "designed."

1. CROSS-SECTION MOTION AUDIT
   - Walk every section built in Phases 1-5 and verify each one's entrance/hover/scroll animation actually
     cites a name from the Motion Timing Table (top of this document) rather than a bespoke duration that crept
     in during implementation. Fix any drift back to the table, or — if a genuinely new timing need was
     discovered during implementation — add it to the Motion Timing Table with a name and justification rather
     than leaving an uncatalogued one-off value in a component file.
   - Confirm every scroll-triggered animation uses `once: true` where appropriate (most entrance reveals should
     not re-trigger on scroll-back-up — re-triggering entrance animations on every scroll direction change is a
     common and annoying bug) and audit for it explicitly section by section.

2. MAGNETIC / CURSOR MICRO-INTERACTIONS (desktop only, pointer: fine media query gated)
   - Add a subtle magnetic-hover effect to the hero's primary CTA button and the Final CTA's button: on
     mousemove within a small radius around the button, the button translates a few px toward the cursor (GSAP
     quickTo for performance, capped displacement ~6-8px, reverts on mouseleave with land-hover timing). This
     is the single most "premium SaaS landing page" micro-interaction explicitly implied by the Apple-style
     brief — implement it precisely, capped and subtle, not a large/gimmicky drag effect.
   - Feature cards (Phase 3) and preview cards (Phase 2): add a subtle radial glow-follows-cursor effect on
     hover — a CSS custom property (--mouse-x/--mouse-y) updated via a throttled mousemove listener, consumed
     by a radial-gradient background-image positioned at that point, using land-accent-glow-faint. This must be
     cheap (CSS custom property update only, no re-render, no GSAP tween per mousemove tick) — profile it if
     unsure.
   - Every cursor-following effect must no-op entirely on touch devices (pointer: coarse) and must respect
     useReducedMotion() (skip the translate/glow-follow, keep only the color/shadow hover change).

3. SCROLL-VELOCITY DEPTH TOUCH (optional stretch, only if the earlier sections' baseline motion already feels
   complete — do not add this at the expense of polishing what already exists)
   - AuroraGlowField's ambient blobs may gain a very subtle extra parallax offset tied to scroll velocity
     (faster scroll = very slightly more blob displacement, GSAP ScrollTrigger's velocity data) for an extra
     sense of depth. Keep displacement small (a handful of px) — this is a "you feel it more than you see it"
     effect, not a visible scroll-linked animation in its own right.

4. LOADING / TRANSITION POLISH
   - Verify there's no flash-of-unstyled-content or visible pop-in for any land-* styled element on first paint
     (check with network throttling in DevTools, not just on a warm local dev server).
   - Add a brief, tasteful page-level fade-in on initial mount (200-300ms, opacity only, applied at the
     app/page.tsx root) so the very first paint doesn't feel abrupt — small polish, easy to skip, don't skip it.

DESIGN:
- Nothing in this phase should be visible as "an animation" in the way the hero entrance or scroll-story are —
  everything here is the kind of motion users feel without consciously noticing, which is exactly what makes it
  read as premium rather than gimmicky. If a reviewer's first reaction to any change in this phase is "oh, cool
  animation," it's probably too loud — dial it back.

DO:
- Cross-check every timing value against the Motion Timing Table and update the table (not the component) if a
  new legitimate need is found.
- Gate every cursor-following effect behind pointer: fine and useReducedMotion().
- Use GSAP quickTo for the magnetic button effect specifically — it's built for exactly this (high-frequency,
  low-overhead tween updates), don't hand-roll a requestAnimationFrame loop when quickTo exists.

DON'T:
- Don't add any new page section in this phase — polish only.
- Don't ship a cursor-following effect that runs (even inertly) on touch devices — check pointer: coarse and
  skip listener attachment entirely, don't just hide the visual result.
- Don't let "polish" scope-creep into a redesign of any section — if something feels fundamentally wrong here,
  flag it for a follow-up rather than re-opening an earlier phase's scope mid-polish-pass.
```

---

# PHASE 7 — Performance, Responsive & Accessibility QA

**Depends on:** Phases 0-6 all merged. No new visual content — verification, measurement, and targeted fixes only.
**File boundary:** any file under `components/marketing/aurora/**` and `app/page.tsx`, strictly for fixing issues this phase's audit finds — not for new features.

## Master Prompt

```
Run a full QA pass on the completed Aurora homepage (Phases 0-6 must already be merged) and fix everything this
audit finds. This phase does not add features; it hardens what exists.

1. PERFORMANCE AUDIT
   - Run Lighthouse (or an equivalent, e.g. WebPageTest/DevTools Performance panel) against the built (not dev-
     mode) page, both mobile and desktop presets. Record baseline scores in the PR description.
   - Verify the code-splitting boundary from the Global Non-Negotiables held: confirm via the Network panel
     that GSAP/ScrollTrigger and the Three.js hero bundle (HeroWebGLField) are NOT in the initial HTML-blocking
     chunk, and that hero headline text is visible/interactive before those chunks finish.
   - Check Cumulative Layout Shift specifically around: font loading (Inter weight 800 newly added in Phase 0 —
     confirm font-display strategy prevents a FOUT-driven reflow), the WebGL canvas mounting, and any
     GSAP-driven entrance animation's initial (pre-JS) state matching its animated-from state closely enough
     that JS hydration doesn't cause a visible jump.
   - Profile the Phase 4 scroll-story specifically for scroll-jank (this is the highest-risk section for
     frame drops) — target a consistently smooth scrub with no visible stutter on a mid-tier device/throttled
     CPU (Chrome DevTools' 4x/6x CPU slowdown setting is an acceptable proxy if physical mid-tier hardware
     isn't available).
   - Fix anything found. If a fix requires a scope trade-off (e.g. reducing the WebGL particle count further,
     or simplifying a glow-blur radius that's expensive to paint), make the call in favor of performance and
     note the specific visual concession in the PR description rather than silently shipping a regression.

2. RESPONSIVE AUDIT
   - Test at minimum: 360px (small phone), 390px (standard phone), 768px (tablet portrait), 1024px (tablet
     landscape / small laptop), 1440px (standard desktop), 1920px (large desktop). Every section from Phases
     1-5 must be checked at every breakpoint — no "it probably scales fine" assumptions.
   - Specifically verify: Phase 1's nav mobile overlay opens/closes cleanly and traps focus correctly; Phase 2's
     two-column preview cards stack cleanly with no orphaned/cramped table columns on narrow screens (consider
     hiding a lower-priority column, e.g. sector, below a breakpoint rather than letting the table overflow or
     compress illegibly); Phase 4's scroll-story mobile fallback (plain stacked, no pin) actually engaged below
     lg and doesn't have leftover pin-related CSS/JS side effects; Phase 5's stat tiles wrap sensibly at 2-up or
     1-up on narrow screens rather than squeezing 4-up.
   - Verify no horizontal scroll/overflow exists at any tested width (a single element exceeding viewport width
     anywhere on the page is a hard fail — check with DevTools' "show overflow" or by watching for a horizontal
     scrollbar at each width).

3. ACCESSIBILITY AUDIT
   - Full keyboard walkthrough: Tab through the entire page top to bottom, confirm every interactive element
     (nav links, mobile menu trigger and its internal links, both hero CTAs, both preview cards' footer links,
     feature cards if they're links, scroll-story step indicators if interactive, final CTA buttons, footer
     links) is reachable in a sensible visual order, has a visible focus ring (land-accent, per the Global Non-
     Negotiables), and is operable via Enter/Space as appropriate.
   - Screen reader spot-check (VoiceOver on macOS, NVDA on Windows, or a browser extension audit like axe
     DevTools at minimum if a full screen-reader pass isn't feasible in this environment): confirm the page has
     one h1 (the hero headline), a logical heading hierarchy through h2s for each section, all AuroraGlowField
     decorative layers are aria-hidden (Phase 0 specified this — verify it actually landed in every usage), and
     the "Live" badge / any live-updating content (Phase 2's screener preview) doesn't spam a screen reader on
     every data refresh (throttle any live-region announcement, or avoid live-region semantics entirely for a
     marketing preview that doesn't need to be announced on every tick — a marketing page's screener preview is
     not the real screener, it does not need aria-live="polite" treatment the way an actual trading UI would).
   - Contrast check every text/background pairing used in Phases 1-5 against the actual rendered background
     (including glow gradients, not just the flat land- token) at 4.5:1 minimum for body text, 3:1 minimum for
     large text (per WCAG's large-text allowance) — use a real contrast-checking tool against screenshots, not
     a visual eyeball guess.
   - Force `prefers-reduced-motion: reduce` at the OS/browser level and re-walk the entire page — confirm every
     single animation added across Phases 1-6 (hero entrance, scroll reveals, scroll-story pin, magnetic
     buttons, cursor-glow, count-up stats, nav collapse, WebGL field) degrades to its documented static
     fallback with zero motion, not "reduced" motion — the Global Non-Negotiables require full suppression, not
     just gentler easing.

4. CROSS-BROWSER SPOT CHECK
   - At minimum Chrome and Safari (WebKit is the most common source of GSAP/backdrop-filter/clip-path
     discrepancies) — Firefox if readily available. Focus on: backdrop-blur nav background (Phase 1), the
     WebGL canvas (Phase 1), CSS custom-property-driven cursor glow (Phase 6), and the pinned scroll-story
     (Phase 4) — these four are the highest-risk-of-divergence features in the whole plan.

Produce a short QA report (in the PR description, not a new file) listing: Lighthouse scores before/after,
any concessions made for performance, any bugs found and fixed per category above, and any known remaining
issue explicitly deferred with a reason (don't silently ship a known issue without flagging it).

DO:
- Test the actual production build, not dev mode, for performance numbers.
- Fix issues found rather than only cataloguing them — this phase's job is a working, hardened page at the end.
- Force reduced-motion and actually re-walk the whole page under it, don't just check the code for the
  useReducedMotion() calls and assume they're correct.

DON'T:
- Don't add new visual features while "fixing" something found here — if a fix implies new scope, flag it
  instead of silently expanding this QA phase into a redesign.
- Don't rely on a single desktop-Chrome-only check and call the responsive/cross-browser audit done.
```

---

# PHASE 8 — Integration & Cleanup of Legacy `marketing/*`

**Depends on:** Phases 0-7 all merged and QA'd. This is the final phase — after it lands, the Aurora homepage is the only homepage.
**File boundary:** `app/page.tsx` (final rewire), deletion of superseded files under `components/marketing/*` (not `components/marketing/aurora/*`, which is kept).

## Master Prompt

```
Retire the pre-Aurora landing page implementation and make app/page.tsx assemble the Phase 0-7 Aurora sections
as the site's actual homepage. This is the only phase that deletes code.

1. FINAL app/page.tsx ASSEMBLY
   Compose, in order: AuroraNav (Phase 1, likely rendered fixed/outside the normal flow rather than as a
   section), AuroraHero (Phase 1), LivePreviewSection (Phase 2), FeatureGridSection (Phase 3), ScrollStorySection
   (Phase 4), StatsSection + FinalCtaSection (Phase 5), AuroraFooter (Phase 5). Preserve the existing dynamic-
   import-for-below-fold-heavy-sections pattern (the current app/page.tsx already code-splits OrderFlowTape and
   DashboardMockSection via next/dynamic with ssr:false — apply the same treatment to HeroWebGLField and
   ScrollStorySection specifically, since those are this new page's heaviest client-only sections).

2. DELETE SUPERSEDED FILES
   Once the new assembly is verified working end-to-end (dev server, real browser, both viewport sizes, per
   Phase 7's checklist re-run once more against the final integrated page — integration can introduce section-
   boundary bugs even when each section worked fine in isolation), delete:
     components/marketing/AiHero.tsx
     components/marketing/HeroMarketPulse.tsx
     components/marketing/ContextualCrosshair.tsx
     components/marketing/CrossAssetMatrix.tsx
     components/marketing/DashboardMockSection.tsx
     components/marketing/ExecutiveTearSheet.tsx
     components/marketing/LayoutEngine.tsx
     components/marketing/MktSkeleton.tsx
     components/marketing/OrderFlowTape.tsx
     components/marketing/OrderTicketMock.tsx
     components/marketing/PriceTickerTape.tsx
   Before deleting each file, grep the whole repo (not just app/) for any import of it — if anything outside
   app/page.tsx references one of these (unlikely, but verify rather than assume), stop and resolve that
   reference first rather than breaking an unrelated page.
   KEEP components/marketing/ScrollProgressBar.tsx — it's generic (works with any page content) and Aurora has
   no reason to reimplement it; either keep it in place and reuse it at the top of the new page, or move it into
   components/marketing/aurora/ for namespace consistency if this phase's author judges that cleaner — either
   is acceptable, just be consistent and don't leave it duplicated in both locations.

3. CSS CLEANUP
   In app/globals.css, once no component references any --mkt-* variable except --mkt-action-hue (which Aurora
   deliberately reuses conceptually but has its own --land-accent copy of, per Phase 0 — check whether anything
   still literally imports --mkt-action-hue directly, vs. everything now going through --land-accent), evaluate
   whether the old --mkt-* block can be removed entirely. Do NOT remove it speculatively — grep for every
   remaining usage first (including the .mkt-headline, .mkt-action-button CSS classes referenced in the current
   app/page.tsx's JSX className strings, e.g. `className="mkt-action-button"` — the plain CTA link at the
   current file's bottom uses a raw CSS class, not the Button component; confirm no other route/component
   depends on these classes before deleting their definitions). If anything outside the deleted files still
   references an --mkt-* token or class, leave that specific token/class in place and only remove what's
   verifiably orphaned.

4. FINAL VERIFICATION
   - Full click-through of the assembled homepage exactly as a first-time visitor would experience it, desktop
     and mobile, motion enabled and reduced-motion forced, per Phase 7's checklist — re-run it against the
     final integrated app/page.tsx, not just against isolated section builds.
   - Confirm the production build (`npm run build`) succeeds with no new TypeScript errors and no new bundle-
     size regressions beyond what's expected/justified by the new WebGL/GSAP-heavy sections (compare bundle
     analyzer output before/after if one is configured; if not, at minimum compare the reported page-specific
     JS size for `/` before and after in the build output).
   - Confirm every internal link added across Phases 1-5 (/register, /login, /market, /simulation, footer links)
     resolves to a real route with correct behavior (auth redirect params where relevant) — this is the last
     chance to catch a broken link before this becomes the live homepage.

DO:
- Grep for every reference before deleting any file or CSS rule — this phase's whole risk profile is "silently
  breaking something outside app/page.tsx that still depended on the old marketing components."
- Re-run the full Phase 7 QA checklist against the final integrated page, not just trust that each section
  passing in isolation guarantees the assembled page also passes.
- Keep ScrollProgressBar.tsx (or its logical successor) — no reason to lose a generic, working utility.

DON'T:
- Don't delete any components/marketing/* file without first confirming zero remaining imports repo-wide.
- Don't remove --mkt-* CSS variables/classes that anything still references, even indirectly via a raw
  className string rather than a token import.
- Don't consider this phase done on "the new sections render" alone — the deletion and cleanup half of this
  phase is equally load-bearing; a phase that adds Aurora but never retires the old code has failed this
  phase's actual purpose.
```

---

# Appendix — Phase Sequencing & Paste-Back Instructions

Execute phases in order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.** Phases 2 and 3 are independent of each other (both only depend on Phase 0) and could be parallelized across two sessions/worktrees if desired — everything else has a real ordering dependency, either structural (Phase 1's hero must exist before Phase 4's "see how it works" scroll-link target does) or process-based (Phase 6 polishes what 1-5 built, Phase 7 hardens what 0-6 built, Phase 8 integrates and retires what all prior phases produced).

To execute a phase: paste that phase's fenced ` ```...``` ` master-prompt block into a fresh session (or continue in the current one) along with a pointer to this file for the Global Non-Negotiables, Motion Timing Table, and Token Table. Each phase prompt is written to be self-contained enough to act on with just this document plus the actual current repo state — it does not assume the executing session has any memory of earlier conversation.

After each phase: run the code-reviewer pass per this repo's standing instructions, verify against that phase's Do/Don't list, and actually exercise the result in a browser before marking it done — per Global Non-Negotiable #9.

**This document is the spec. It does not get pasted back all at once.** Work through it exactly the way `REVAMP_MASTER_PLAN.md` is worked through today: one phase, one session (or a few), one reviewed and merged result, then the next phase.

# PHASE 6 — User Settings — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one. **Hard prerequisite**: the Sessions panel (C6) depends entirely on
Phase 1 having built real session/refresh-token records — confirm Phase 1 is complete before starting that
specific section; the rest of this phase does not depend on it.

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome recedes to near-invisibility; only data carries color, motion,
and visual weight — and this phase is the **purest test of that principle in the entire app**, because Settings
has essentially no live market data to justify any visual flourish at all. Restraint matters more here than
anywhere else in the six phases.

The Five Laws:
1. Data is the only decoration — with almost no live data on this page, that means almost no decoration.
2. One accent color everywhere — green/red belong exclusively to market direction, and this phase has no
   market data at all, so market colors should essentially never appear here.
3. Ink on glass — every surface behaves like a physical material.
4. Numbers are typography's first citizens — still true even here (e.g. session timestamps, any numeric
   preference values).
5. The interface never sleeps and never shouts — resist adding "liveness" motion to a settings page that has
   nothing genuinely live to show; this is explicitly called out again in A7 below.

**Ledger Line** — used here purely as the active-tab marker for the settings sub-navigation (Preferences /
Notifications / Appearance / Keyboard Shortcuts / Accessibility / Profile), consistent with every other tabbed
sub-navigation elsewhere in the app (e.g. Phase 2's Portfolio tabs).

### A2. Color rules (non-negotiable)
- No pure `#000000`/`#FFFFFF` anywhere.
- `market-up`/`market-down` are reserved exclusively for price direction and **essentially never appear
  anywhere in this phase** — there is no market data on a settings page. If you find yourself reaching for
  green to indicate "this toggle is on" or "this setting saved successfully," stop — that's exactly the
  misuse the spec bans; use `accent-500` instead.
- Generic success (settings saved, session revoked) uses accent, never green.
- Generic warning (e.g. "you're about to sign out of all devices") uses `warn` amber, never red — red stays
  reserved for the market, full stop, even in a destructive-feeling action like revoking sessions.

### A3. Typography rules (non-negotiable)
- **Interface (Söhne / Inter fallback)** dominates this entire phase — labels, toggles, form fields, help text.
  This is a pure UI-chrome phase.
- **Data (Söhne Mono)** — still used for anything genuinely numeric/tabular: session timestamps ("last active
  2 minutes ago" style relative times are fine as Interface type, but exact timestamps and IP addresses in the
  Sessions list are mono per the app-wide timestamp convention), any numeric preference (e.g. a font-size
  percentage value).
- **Editorial (Tiempos)** — not used anywhere in this phase; there is no long-form narrative content here.
- Numeric rules apply wherever a number appears: tabular figures, decimal alignment, mono timestamps at
  `caption` size in `ink-tertiary`.

### A4. Layout & elevation rules
Five-layer elevation model:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header |
| 2 | Module | `bg-surface-2` | Settings section cards |
| 3 | Raised | `bg-surface-3/4` | Select dropdowns, theme picker |
| 4 | Overlay | `bg-glass` | Confirmation modals (password change, revoke-all-sessions) |

- Nesting caps at two visible background steps.
- Radius scale: `radius-xs` 4px (badges), `radius-sm` 6px (buttons/inputs/switches), `radius-md` 10px (cards),
  `radius-lg` 14px (modals). **Nothing above 14px.**
- This phase should read as calm, spacious, form-like — generous use of the 16/20/24/32 layout spacing scale
  between settings groups rather than cramming sections together.

### A5. Glass — strict allowlist
Permitted in exactly five places app-wide. In this phase, only **confirmation modals** (password change,
revoke-all-sessions, delete-session) use glass, per the standard Modals treatment. Nothing else in this phase
is glass — no glass cards, no glass toggles, no glass section headers. This is a resting-surface phase almost
entirely.

### A6. Component library — reuse, don't reinvent
- **Tabs**: ghost tab row, Ledger Line active-tab underline, sticky below the page identity bar on scroll —
  identical pattern to Phase 2's Portfolio sub-navigation and Company Details' tab row. If those have already
  been built, import/reuse the actual tab component rather than reimplementing tab chrome a third time.
- **Switches/toggles**: use Radix's Switch primitive. Check `package.json` first — if not already present
  among the installed Radix primitives (avatar, dialog, dropdown-menu, label, select, separator, slot, tabs,
  toast, tooltip are confirmed installed; Switch is not confirmed), adding it is reasonable since it's a
  standard part of the same Radix family already adopted — do not hand-roll a custom toggle component.
- **Inputs**: 32px height, well one step darker than parent, inset shadow, hairline border, `radius-sm`. Focus
  = accent border + `glow-accent` ring. Standard treatment for Profile's text fields.
- **Modals**: `radius-lg`, `shadow-overlay`, scrim+blur, width 420 for confirms (password change confirmation,
  revoke-all-sessions confirmation) — Destructive-confirm button pattern (ghost at rest, `warn` amber fill only
  inside the modal) for session revocation, never market red.
- **Dropdowns/Selects**: Level-3 raised surfaces, `shadow-raised`, `stroke-emphasis` border, `radius-sm` — used
  for theme selection if presented as a dropdown rather than a segmented control (recommend segmented control
  for just two themes, see C3), density selection, font-size selection.
- **Toasts**: bottom-right, max 3, accent-edged for "Settings saved" / "Password updated" confirmations, amber-
  edged for any warning-adjacent save issue.
- Reuse `react-hook-form` + `zod` for Profile and password-change forms, TanStack Query for fetching/mutating
  all settings data (no hand-rolled fetch state).

### A7. Motion — GSAP only, per this exact table, with a phase-specific caveat

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Not really applicable here — no price/data ticks exist on this page |
| Micro-interactions | 120–160ms, ease-out | Toggle flip, hover, press, tab switch |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | Modal scale-in, dropdown fade+rise |
| Ledger Line draw-in | 400ms, ease-in-out | Tab underline on load |
| Ambient | 2–4s loops | None appropriate here — see below |

**Phase-specific rule — the strongest version of this rule in the whole plan**: **do not add decorative or
ambient motion to this page "to match the rest of the app."** There is no live data here to justify a
breathing dot, a shimmer loop beyond a genuine loading skeleton, or any other ambient element. If a section
loads in under 300ms (likely true for most settings data), skip the skeleton entirely per the app-wide
performance rule. Nothing bounces, overshoots, or rotates, per the universal rule. `prefers-reduced-motion`
collapses everything to opacity fades.

### A8. States every feature must define
Every settings section: default/loaded, saving (inline, e.g. a toggle shows a brief loading micro-state or the
save button locks width with the indeterminate arc — do not block the whole page for a single toggle save),
success (toast or inline confirmation), error (inline, contained — "Couldn't save this setting, try again," not
a full-page failure), and for forms specifically: validation-error (inline amber caption, per the Inputs spec).

### A9. Accessibility (mandatory, not follow-up)
≥4.5:1 contrast; every toggle/switch has a clear text label, never an icon-only control with no accessible
name; full keyboard model (every setting must be operable via keyboard alone — Tab to a switch, Space/Enter to
toggle); visible focus ring; live regions announce save confirmations, throttled to 1 per 3 seconds per module;
this phase's Accessibility section (C5) is itself a first-class accessibility feature, not just a section that
happens to be about accessibility — hold it to the same bar as the rest.

### A10. General engineering rules
Backend: FastAPI + SQLAlchemy + Alembic. New tables get real migrations. New router
`apps/api/routers/settings.py` (or extend an existing `users.py` router if one exists — check first) +
`apps/api/services/settings_service.py`, following the existing `routers/<domain>.py` +
`services/<domain>_service.py` split. Frontend: Next.js 15 App Router, React 19, TypeScript, JS/TS only,
desktop-first. Every module fault-isolated. Verify by running the dev server, changing real settings, hard-
reloading, and confirming persistence — not just type-checking. Never hardcode secrets.

---

## PART B — Phase 6 Context: What Already Exists (read before writing anything)

- **No preferences/notification/profile backend endpoints exist today** — confirmed via repo audit, this is
  fully greenfield on the backend.
- **User model**: check `db/models/trading.py`'s `User` model (or wherever the core `User` model actually
  lives — the audit found `User` referenced in `db/models/trading.py`, verify this is the canonical location)
  for what profile fields already exist (display name, email — both referenced in the existing RegisterForm
  per Phase 1's context) before assuming what needs adding versus what's already there.
- **Theme/density tokens already exist** in `tailwind.config.ts` (`mer-*` namespace) for both the dark
  "Terminal" and light "Research Desk" themes, and Comfortable/Compact density is referenced throughout
  DESIGN_SPEC.md as an existing app-wide concept (row heights, type sizes) — **this phase is wiring persistence
  and a dedicated settings UI onto design tokens and density behavior that likely already exist in some form
  at the component level; check whether a header-level density/theme toggle already exists in the global
  shell** (DESIGN_SPEC.md's sidebar footer is specified to hold "density toggle, theme toggle, and a
  permanently visible connection-status row" — check if this is already built) before building this phase's
  Appearance section as if starting from zero. If the header/sidebar toggles already exist but don't persist
  server-side, this phase's job is largely to add the backend persistence layer and make the Settings page the
  canonical control surface, with the existing quick-access toggles becoming mirrors of the same state.
- **Phase 1 dependency**: the Sessions panel (C6) requires Phase 1's `sessions` table and
  `GET/DELETE /users/me/sessions*` endpoints (as scoped in Phase 1's master prompt) to exist — if Phase 1
  hasn't shipped this yet, either wait or coordinate building the missing backend pieces as part of this
  phase's work, but do not build a fake/mocked Sessions list that has no real backend behind it.

---

## PART C — Feature Specifications (extreme detail)

### C0. Page shell and sub-navigation

- **Route structure**: `/settings` redirects to `/settings/preferences` (default tab). Sections:
  `/settings/preferences`, `/settings/notifications`, `/settings/appearance`, `/settings/shortcuts`,
  `/settings/accessibility`, `/settings/profile`. Shared layout (`app/settings/layout.tsx`) for the identity
  bar and tab row, same instant-tab-switch approach as Phase 2 (real `<Link>` prefetching, no full reload feel).
- **Identity bar**: simpler than other phases' — `micro` eyebrow "SETTINGS", `heading-1` "Settings" title. No
  hero metric here (there's nothing to headline) — resist the urge to invent one.
- **Backend data model**: a single `user_preferences` table (Alembic migration), one row per user:
  - `id`, `user_id` FK (unique constraint — one row per user), `theme` (enum: `dark`/`light`, default `dark`
    per the spec's "Terminal" default theme), `density` (enum: `comfortable`/`compact`, default `comfortable`),
    `notification_settings` (jsonb — flexible, since notification categories will grow over time and a rigid
    column-per-category schema would need a migration for every new notification type), `keyboard_shortcuts_
    overrides` (jsonb, nullable, optional per-user rebinding — only populated if C4's rebinding scope is
    confirmed, see below), `accessibility_settings` (jsonb — reduced_motion override, font_size, high_contrast
    if scoped in, see C5), `updated_at`.
  - **Why jsonb for notification/accessibility settings and not rigid columns**: this is exactly the kind of
    setting surface that grows incrementally over the product's life — a new notification category or a new
    accessibility toggle should be addable by changing the jsonb shape and a default-merge in application code,
    not by writing a new Alembic migration every time. This is a deliberate schema-flexibility choice, not
    laziness — document it as such if anyone reviews the migration later.
- **Endpoints**: `GET /users/me/preferences` (returns the full row, with sensible defaults merged in for any
  jsonb keys not yet present for older rows), `PATCH /users/me/preferences` (partial update — accepts any
  subset of the top-level fields, merges jsonb sub-objects rather than replacing them wholesale, so toggling
  one notification category doesn't wipe out the others).
- **Frontend data layer**: one TanStack Query hook (`usePreferences()`) shared across all six sections, with
  optimistic updates on toggle/change (flip the UI state immediately, roll back with an inline error + toast if
  the `PATCH` fails) — this is what makes individual toggle saves feel instant rather than each one blocking on
  a round trip.

### C1. PREFERENCES

- **Keep this section narrow in v1** — general app-behavior settings that don't have a more specific home in
  the other five tabs. Recommended fields to start with (confirm scope with the user if more are wanted):
  - **Default landing page**: a select — "Dashboard" / "Portfolio" / "Market Explorer" — determines where
    `/` or post-login redirect sends the user (ties into Phase 1's login redirect logic — after this phase
    ships, the default post-login destination should read this preference instead of a hardcoded route).
  - **Default chart range**: a select matching the range-selector pill options used throughout the app (1D /
    5D / 1M / 6M / YTD / 1Y / 5Y / MAX) — sets the initial range shown on charts that don't have their own
    explicit user selection yet in a session.
  - Each field: `micro` label above, Level-3 dropdown for the select, saves via the shared preferences hook
    with the standard save/success/error states from A8.
- **Empty/first-visit state**: not really applicable — preferences always have defaults, so this section never
  shows an empty state, only its default-filled state.

### C2. NOTIFICATIONS

- **Categories** (each a toggle row): Price Alerts, Order Fills (ties to Phase 3), News (ties to Phase 4), AI
  Briefings (ties to Phase 5) — confirm this exact category list against whichever of the other phases have
  actually shipped notification-worthy events by the time this phase is built; don't build toggles for
  notification types that have no actual event source wired up yet, or clearly label them "Coming soon" and
  disabled if you do include them ahead of their source phase.
- **Row anatomy**: `body-strong` category label, `caption` one-line description beneath (`ink-secondary`),
  Radix Switch aligned right. Each toggle maps to a key inside `notification_settings` jsonb.
- **Delivery channel note**: if the notification system has any actual delivery mechanism beyond in-app (email,
  per Phase 1's `EmailService` stub) — confirm scope; v1 likely just controls in-app notification generation
  (the existing `Notification` model referenced in `db/models/trading.py`), not multi-channel delivery
  preferences, unless email notifications are explicitly wanted here too (which would reuse Phase 1's
  `EmailService` interface rather than building a second one).
- **Grouping**: if the list grows beyond ~5-6 items, group under `micro` eyebrow sub-headers (e.g. "TRADING",
  "MARKET", "AI") rather than one long flat list — but don't over-engineer this structure for a short v1 list.

### C3. APPEARANCE

- **Theme**: a two-option segmented control (not a dropdown — only two choices, a segmented control is more
  direct), labeled "Dark — Terminal" and "Light — Research Desk" (using the spec's own theme names, since
  they're meaningful identity, not just "Dark"/"Light" generically). Selecting applies **instantly** (no save
  button needed for this one — visually confirm the change live) and persists via the preferences hook.
  - **SSR/hydration correctness is critical here** — theme must be read and applied before first paint to
    avoid a flash of the wrong theme on load/reload. Check how the app currently determines theme at first
    render (likely a cookie-based approach is needed for correct SSR behavior in Next.js App Router, since
    client-only localStorage-based theme detection causes a hydration flash) — if no such mechanism exists yet,
    building it correctly is part of this section's real scope, not a minor detail. Test this explicitly with
    a hard reload, not just an in-session toggle, before considering this section done.
  - The existing header/sidebar quick-access theme toggle (if it exists, per Part B) should read from and write
    to this same persisted preference — not maintain independent state that could drift out of sync with the
    Settings page.
- **Density**: same segmented-control pattern, "Comfortable" / "Compact", instant apply, persists via the same
  hook, and syncs with the existing header-level density toggle if one exists (same "single source of truth"
  requirement as theme).
- **No other appearance settings in v1** — resist adding accent-color customization, font customization, or
  layout customization beyond theme/density; the spec's "one accent color everywhere" rule (A2) means accent
  color is explicitly not user-customizable, and this section should not quietly introduce a way to violate
  that rule.

### C4. KEYBOARD SHORTCUTS

- **Scope decision — confirm with the user before building rebinding UI.** Recommended v1: a **read-only
  reference/cheat-sheet view**, not actual rebinding — this requires zero backend changes beyond what's already
  scoped (no need to populate `keyboard_shortcuts_overrides` jsonb at all if rebinding isn't built) and is
  significantly cheaper while still being genuinely useful.
- **Reference view contents**: a list of existing app-wide shortcuts, grouped by area (`micro` eyebrow
  sub-headers): "Global" (⌘K/Ctrl+K command palette), "Tables" (row navigation arrow keys, Enter to open),
  "Charts" (the chart-focus shortcut mentioned in DESIGN_SPEC.md's Accessibility section — confirm its actual
  key binding from wherever it's implemented rather than guessing), and any others actually implemented
  elsewhere in the app (audit the app for real existing keybindings rather than inventing a list of shortcuts
  that don't actually exist yet).
- **Row anatomy**: action label (`body`) + a keycap-styled chip showing the actual key combination (mono type,
  `radius-xs`, `bg-surface-3` fill, hairline border — like a small physical key rendering, e.g. `⌘` `K`
  as two adjacent small chips).
- **If the user wants actual rebinding in v1 instead**: this becomes a materially larger feature (a rebinding
  UI with conflict detection, a way to reset to defaults, and actually threading the override through
  wherever each shortcut is currently hardcoded in the app) — treat it as a confirmed scope expansion requiring
  its own careful pass through every existing shortcut's implementation, not something to bolt on quickly
  alongside the reference view.

### C5. ACCESSIBILITY

- **Reduced motion override**: a toggle, independent of the OS-level `prefers-reduced-motion` — some users
  want to force reduced motion regardless of their system setting (or, less commonly, want to confirm the app
  respects their OS setting without needing a separate override; frame this toggle as "Always use reduced
  motion" rather than a two-way override of both directions, since the OS setting should already be respected
  by default per A7/the app-wide motion rules — this toggle is additive, not a way to force full motion against
  an OS preference for reduced motion, which would be a bad accessibility practice). When enabled, this
  preference should short-circuit the same GSAP motion-reduction logic that already listens to
  `prefers-reduced-motion` app-wide — wire it into that same central check, don't build a second parallel
  motion-gating mechanism.
- **Font size preference**: a small set of discrete options (e.g. "Default" / "Large" / "Larger" — avoid a
  free-form slider, which is harder to design consistently across the app's fixed type scale) that scales the
  base rem/type-scale multiplier app-wide. Confirm how much of the app's typography is already token/rem-based
  (likely yes, given the type scale is clearly systematized in DESIGN_SPEC.md) before promising this works
  cleanly everywhere — if some components use hardcoded px values instead of the scale tokens, this preference
  will have inconsistent effect and that gap should be flagged rather than silently shipped as if it works
  everywhere.
- **High contrast**: **check feasibility before promising this** — a true high-contrast mode may require its
  own token overrides (higher-contrast hairlines, stronger text-on-surface ratios) layered on top of the
  existing Meridian token system, which is a bigger lift than a simple boolean toggle implies. If scoping this
  in, confirm with the user whether "high contrast" means (a) a genuinely separate high-contrast token set, or
  (b) simply verifying/nudging existing contrast ratios slightly higher within the current theme — these are
  very differently sized efforts. Recommend starting with confirming current contrast already meets the spec's
  stated ≥4.5:1 bar (if it already does everywhere, a dedicated "high contrast mode" may not even be necessary
  for WCAG AA compliance, and the setting could be deferred) rather than building new token infrastructure
  speculatively.
- **Row anatomy**: same toggle/select pattern as other sections, each with a `caption` description of what the
  setting actually does (accessibility settings especially benefit from being unambiguous about their effect,
  not just a bare label).

### C6. PROFILE

- **Display name / email**: check the existing `User` model and Phase 1's RegisterForm to confirm these fields
  already exist and what validation Registration already applies (reuse the same zod validation rules here for
  consistency rather than inventing slightly different rules for editing vs. creating). `PATCH /users/me` for
  these fields.
  - **Email change** should tie back into Phase 1's verification infrastructure if it exists (OTP/email
    verification) — changing your email is a meaningful security-relevant action; if Phase 1 built email-based
    OTP, require re-verification of the new email address before it takes effect (store the pending new email
    separately, send a verification code/link to it, only commit the change on confirmation) rather than
    updating it instantly and unverified. If Phase 1's OTP work isn't done yet, flag this as a follow-up rather
    than shipping an unverified email-change path silently.
- **Avatar**: check whether any avatar/image-upload infrastructure exists anywhere in the app already (file
  storage, an existing upload endpoint) before building this — if none exists, a simple approach (e.g. a small
  fixed set of selectable avatar glyphs/initials-based avatar, consistent with the app's icon-dialect
  aesthetic, rather than building full image-upload infrastructure just for this one feature) is a reasonable
  v1 scope; confirm with the user if they specifically want real image upload, since that's meaningfully more
  infrastructure (storage, file validation, resizing) than this phase's other work.
- **Password change**: its own dedicated form, **separate from the general profile-edit form** — fields:
  Current Password (required, `autoComplete="current-password"`), New Password, Confirm New Password (same
  validation rules as Phase 1's reset-password form — reuse that zod schema rather than redefining it). `PATCH
  /users/me/password` — backend must verify the current password before allowing the change (standard security
  practice; do not allow a password change without re-confirming the current one, even though the user is
  already authenticated, since a hijacked active session shouldn't be able to lock the real owner out by
  silently changing their password). On success: per Phase 1's C4 pattern, **revoke all other sessions** (force
  re-login everywhere except the current session), and show a clear confirmation.
- **Sessions list** (hard dependency on Phase 1 — do not build a mocked version):
  - `GET /users/me/sessions` → a List card: each row shows device label (from Phase 1's User-Agent-derived
    label), approximate location if IP-derived location is in scope (confirm — this may be out of scope if no
    geolocation-from-IP service is wired up; if not, omit location rather than fabricating it), last-active
    timestamp (mono, relative format like "2 minutes ago" with the exact mono timestamp available on hover via
    a standard UI tooltip), and a badge marking "This device" on the current session's row (derived by
    matching the current request's session identity, not guessable client-side).
  - **Revoke one session**: ghost "Revoke" action, hover-reveal, per-row — opens a lightweight confirm (a small
    inline confirm or a 420-width modal, Destructive-confirm pattern, amber not red) before calling `DELETE
    /users/me/sessions/{id}`. Cannot revoke "This device"'s own row from this list (that's what the standard
    app-wide "Sign out" action is for, not a session-management action) — either hide the Revoke action on the
    current-device row or disable it with a tooltip explaining why.
  - **Revoke all other sessions**: a Secondary or Destructive-confirm button above the list, "Sign out of all
    other devices" — confirm modal (420 width, glass, per Modals spec) restating the consequence ("You'll be
    signed out on {n} other device(s). This device will stay signed in.") before calling `DELETE
    /users/me/sessions` (Phase 1's logout-all-but-current semantics — confirm the exact endpoint contract
    against what Phase 1 actually built rather than assuming).
  - **Empty/single-session state**: if the current session is the only one, show it in the list normally but
    omit or disable the "Sign out of all other devices" action (nothing else to revoke) rather than showing a
    dead/no-op button.

---

## PART D — Strict Do-Not List (Phase 6)

- **Do NOT** add decorative or ambient motion to this page "to match the rest of the app" — there is no live
  market data here to justify it; skeletons only appear for genuinely slow (>300ms) loads, and no breathing
  dots or shimmer loops exist outside that specific case.
- **Do NOT** use market green/red for any toggle-on state, save-confirmation, or generic success/warning
  signal in this phase — accent for success, amber for warning, full stop. This phase has essentially zero
  legitimate uses of market color.
- **Do NOT** build the Sessions panel (C6) against mocked/fake data if Phase 1's session mechanism hasn't
  shipped yet — this panel has no meaning without real backend session records; wait for or build that
  dependency first rather than faking it.
- **Do NOT** allow a password change without re-verifying the user's current password first, even though
  they're already authenticated.
- **Do NOT** let an email change take effect instantly and unverified if Phase 1's OTP/verification
  infrastructure exists — require re-verification of the new address first.
- **Do NOT** build actual keyboard-shortcut rebinding without explicit confirmation that the cheaper read-only
  reference view isn't sufficient — rebinding is a materially larger feature (conflict detection, threading
  overrides through every existing hardcoded binding) than a cheat-sheet.
- **Do NOT** promise a full high-contrast theme without first checking what it actually requires — confirm
  whether existing contrast already meets the ≥4.5:1 bar before building new token infrastructure speculatively.
- **Do NOT** build a free-form font-size slider — use a small set of discrete, tested options consistent with
  the app's fixed type scale.
- **Do NOT** build real image-upload infrastructure for avatars without confirming that's actually wanted —
  default to a simpler selectable-glyph/initials approach unless told otherwise.
- **Do NOT** let the header/sidebar's existing quick-access theme and density toggles (if they exist) maintain
  independent state from this page's Appearance section — both must read/write the same persisted preference,
  never drift out of sync.
- **Do NOT** ship the theme toggle without testing it across a hard reload — a flash-of-wrong-theme on load is
  a real, common Next.js SSR/hydration bug and must be explicitly verified fixed, not assumed fine because it
  looked fine during an in-session toggle test.
- **Do NOT** use rigid columns for notification/accessibility settings that will predictably grow over time —
  use the jsonb approach specified, so new settings don't require a migration each time.
- **Do NOT** block the entire page or show a full-page loading state while a single toggle saves — use
  optimistic updates with inline rollback-on-failure instead.
- **Do NOT** exceed 14px border radius, use pure black/white, or add glass anywhere in this phase beyond the
  confirmation modals (password change, session revocation).
- **Do NOT** touch Auth (beyond consuming Phase 1's session endpoints), Portfolio, Trading, Simulation, or AI
  Workspace internals — this phase's file boundary is `app/settings/**`, `apps/api/routers/settings.py` (or the
  extended user router), `apps/api/services/settings_service.py`, and the `user_preferences` Alembic migration.
- **Do NOT** skip the Alembic migration for the `user_preferences` table — no manual schema edits.
- **Do NOT** ship this phase without manually testing: changing and hard-reload-verifying theme, changing and
  verifying density, saving a notification toggle and confirming it persists, changing your password and
  confirming other sessions get revoked, and — once Phase 1's session mechanism is confirmed live — revoking an
  individual session and revoking all-other-sessions end-to-end in a running browser.

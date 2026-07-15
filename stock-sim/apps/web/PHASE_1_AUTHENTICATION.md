# PHASE 1 — Authentication — Master Prompt

Status: DRAFT — paste this file's content back to begin execution.

This file is fully self-contained: global non-negotiables + phase-specific extreme detail. You do not need
any other phase file to execute this one.

---

## PART A — Global Non-Negotiables (identical across all 6 phase files)

### A1. Design authority
`stock-sim/apps/web/DESIGN_SPEC.md` is the single source of visual truth for the entire application, superseding
any conflicting styling guidance anywhere else in the repo. The design language is called **Meridian**. Governing
principle: **quiet surfaces, loud data.** Chrome (nav, panels, containers) recedes to near-invisibility; only
market/user data carries color, motion, and visual weight.

The Five Laws (apply to every screen you touch in this phase):
1. Data is the only decoration — no ornament that isn't derived from live information.
2. One accent color everywhere (`accent-500 #3E6FE0`) — green/red belong exclusively to market direction, never
   to generic success/error UI.
3. Ink on glass — every surface behaves like a physical material (matte graphite panel, frosted glass overlay,
   hairline metal border). Nothing floats without a shadow; nothing overlaps without blur.
4. Numbers are typography's first citizens — tabular figures, fixed decimal alignment, monospaced tickers,
   non-negotiable.
5. The interface never sleeps and never shouts — something is always subtly alive (breathing dot, ticking
   timestamp, shimmer) but nothing flashes, pulses aggressively, or glows neon.

**Ledger Line** — the signature 1px luminous accent hairline (`transparent → accent-500 → transparent`, centered,
60% of module width). It underlines the focused module, traces the live edge of a streaming chart, and draws
itself under section headers on load (400ms ease-in-out). It is the platform's heartbeat. Never used decoratively
outside these exact contexts.

### A2. Color rules (non-negotiable)
- No pure `#000000` or `#FFFFFF` anywhere, ever.
- `market-up` (`#2E9E6B`, dark-theme bright `#3FBF85`) and `market-down` (`#D64550`, dark-theme bright `#E85D68`)
  are reserved **exclusively** for price direction. Never repurposed for form success/error, button states, or
  any non-market semantic.
- Generic success uses **accent** (cobalt), never green. Generic warning/validation-error uses **`warn` amber
  `#D9922E`**, never red. Red is reserved for market-down and — in the Toasts component specifically — order
  rejections.
- `ai` iris (`#8B7CF6`) is reserved exclusively for AI-generated content markers (badge, hairline, icon tint).
  Never used as a general fill. Not relevant to most of Phase 1, but do not borrow it for anything here.
- Full token tables (dark "Terminal" default theme, light "Research Desk" theme) are defined in DESIGN_SPEC.md
  §Color System — use the existing `mer-*` Tailwind tokens already wired in `tailwind.config.ts`. Do not
  hand-write hex values in components; reference tokens.

### A3. Typography rules (non-negotiable)
Three typefaces, three jobs, no exceptions:
- **Interface (Söhne / Inter fallback)** — UI chrome, labels, navigation, buttons, form labels, error copy.
- **Data (Söhne Mono / IBM Plex Mono fallback)** — prices, tickers, timestamps, any tabular/numeric figure.
- **Editorial (Tiempos Text / Georgia fallback)** — news headlines, long-form analysis, AI narrative. Not used
  anywhere in Phase 1 except possibly marketing copy in AuthShell's hero panel if already established there.

Numeric rules: tabular lining figures always; right-align on decimal point; signed deltas always show explicit
`+`/`−`, never parentheses; timestamps are mono `caption` size, `ink-tertiary` color (e.g. `14:32:07 IST`).

Type scale tokens you'll use in this phase: `heading-1` (24/28, 600, module titles), `heading-2` (18/24, 600,
card/modal titles), `body` (14/20, 400, default UI text), `body-strong` (14/20, 550, emphasis), `caption`
(12/16, 400, secondary metadata/validation lines), `micro` (11/14, 500, +0.04em uppercase — eyebrows, labels).

### A4. Layout & elevation rules
Five-layer elevation model — every pixel belongs to exactly one layer via three simultaneous cues (background
step + shadow + hairline), each individually subtle:

| Level | Name | Surface token | Examples |
|---|---|---|---|
| 0 | Canvas | `bg-canvas` + ambient mesh | App background |
| 1 | Shell | `bg-surface-1` | Sidebar, header, AuthShell base |
| 2 | Module | `bg-surface-2` | Cards, form panels |
| 3 | Raised | `bg-surface-3/4` | Dropdowns, popovers, tooltips |
| 4 | Overlay | `bg-glass` | Modals, drawers, command palette |

- A module never sits directly on canvas without a hairline edge.
- Nesting caps at two visible background steps; a third level uses a divider/spacing instead.
- Selected/active/focused state raises the **border** (Ledger Line or accent focus ring), never the surface —
  no lifting, no glowing.
- Base unit 4px. Component-internal spacing: 4/8/12/16. Layout spacing: 16/20/24/32.
- Radius scale: `radius-xs` 4px (badges/chips), `radius-sm` 6px (buttons/inputs), `radius-md` 10px (cards),
  `radius-lg` 14px (modals). **Nothing above 14px, ever.**
- Shadows are layered pairs (tight contact + soft ambient), always cool-toned, never pure black. Use the
  existing `shadow-rest` / `shadow-raised` / `shadow-overlay` / `shadow-inset-well` / `glow-accent` tokens.

### A5. Glass — strict allowlist
Frosted glass (`bg-glass`, 20–24px blur, 140% saturation boost, 1px `rgba(255,255,255,0.10)` wet-edge on top) is
permitted in **exactly five places app-wide**: command palette/global search, modals and side drawers, the sticky
header once content scrolls beneath it, chart tooltips, the AI card header strip. Never on resting cards,
sidebars, or buttons. In Phase 1, this means: modals (if any confirmation modals are used) may be glass; the
AuthShell base panel and form card must NOT be glass — they are Level 1/2 solid surfaces.

### A6. Component library — reuse, don't reinvent
- **Buttons**: Primary (`accent-500` fill, top-light gradient, white text, `radius-sm`, one per view as THE
  primary action), Secondary (`bg-surface-3` fill, hairline border), Ghost (transparent, fills `bg-surface-3` on
  hover), Destructive-confirm (ghost at rest, fills `warn` amber only inside confirmation modals — never red).
  Heights: 32px default, 40px modal primary. Loading state swaps label for a 14px indeterminate arc; **button
  width is locked and never resizes while working.**
- **Inputs**: 32px height, well one step darker than parent card, inset shadow, hairline border, `radius-sm`.
  Focus: border becomes accent + `glow-accent` ring. No floating-label animation — labels sit permanently above
  at `micro` size. Inline validation: `caption` line below in amber with a small icon; field border matches.
  Red stays reserved for the market, never for form validation.
- **Modals**: `radius-lg`, `shadow-overlay`, scrim + blur behind. Widths: 420 (confirm), 560 (form), 800
  (data/comparison). Anatomy: padded header (title + ghost close) → divider → body → footer with right-aligned
  actions. Enter transition: fade + scale from 0.98. Never stack two modals — secondary detail opens as a
  right-side drawer instead.
- **Toasts**: bottom-right stack, max 3 (older compress upward), Level-3 surface, `radius-md`, `shadow-raised`,
  360px wide, auto-dismiss 5s with a draining progress hairline. Semantic left edge: accent (info/success —
  success is cobalt, never green), amber (warning), market-red **only** for order rejections (not relevant in
  Phase 1 — nothing here is an order rejection, so Phase 1 toasts use accent/amber only).
- **Dropdowns**: Level-3 raised surfaces, `shadow-raised`, `stroke-emphasis` border, `radius-sm`, hover/selected
  states fill `bg-surface-3`.
- Reuse Radix UI + shadcn/ui primitives already configured in `components.json` (dialog, dropdown-menu, tabs,
  select, tooltip, toast, avatar, separator, label) — do not hand-roll primitives that already exist.
- Reuse `react-hook-form` + `zod` + `@hookform/resolvers` for all new forms.
- Reuse TanStack Query for all server state — no hand-rolled fetch/loading/error state per component.

### A7. Motion — GSAP only, per this exact table

| Class | Duration / easing | Examples |
|---|---|---|
| Data ticks | 240ms, ease-out | Numeral crossfades, cell flash decay |
| Micro-interactions | 120–160ms, ease-out | Hover, press, toggle |
| Surface transitions | 200–280ms, `cubic-bezier(0.32,0.72,0,1)` | Modal scale-in, drawer slide, dropdown fade+4px rise |
| Ledger Line draw-in | 400ms, ease-in-out | Section header underline on load, active-module edge |
| Ambient | 2–4s loops | Skeleton shimmer, live-dot breathing 60→100% opacity |

Rules: **nothing bounces, nothing overshoots, nothing rotates.** `prefers-reduced-motion` collapses all of the
above to simple opacity fades and disables ambient loops entirely. Price-flash-style motion is the only thing
permitted to recur more than once per second without user input — not relevant to most of Phase 1.

### A8. States every feature must define
For every screen/component you build in this phase, explicitly design: **default, loading (skeleton if >300ms
expected, else nothing), success, empty (if applicable), validation-error (inline, amber), server-error
(module-level per the Error States pattern), and disabled.** Skeletons must be shape-accurate to the real layout
and are skipped entirely for anything resolving in under 300ms.

Error states: module-level failures keep their header and show a warning icon + strong title + optional cause
line + Retry button, contained to the module. Full-page errors are rare — centered card, illustration,
plain-language title, mono error reference code, primary reload action. Error copy always names what happened
and what to do next — never a bare "Oops."

### A9. Accessibility (mandatory, not follow-up)
- All text ≥4.5:1 contrast on its surface.
- Direction/state never encoded by color alone.
- Full keyboard model: visible focus ring (`glow-accent`) on every interactive element, logical tab order, Enter
  submits forms, Escape closes modals.
- `prefers-reduced-motion` honored everywhere.
- Live regions for async status changes, throttled to max 1 announcement per 3 seconds per module.

### A10. General engineering rules
- Backend: FastAPI + SQLAlchemy + Alembic at `stock-sim/apps/api` and `stock-sim/db`. New tables get a real
  Alembic migration — never manual schema edits. New/extended routers follow the existing
  `routers/<domain>.py` + `services/<domain>_service.py` split.
- Frontend: Next.js 15 App Router, React 19, TypeScript. JavaScript/TypeScript only, responsive and smooth.
  Desktop-first per spec (unbounded content width) but must degrade to a collapsed 64px icon-rail sidebar at
  minimum on narrower viewports.
- Every module/page must be fault-isolated — one failing widget never takes down the page.
- Do not touch code outside this phase's stated file boundary without flagging it first.
- After implementation: run a code-review pass, fix CRITICAL/HIGH issues, and actually exercise the feature in
  a running dev server + browser before calling it done. Type-checking alone is not feature verification.
- Never hardcode secrets, API keys, or credentials. Use environment variables validated at startup.

---

## PART B — Phase 1 Context: What Already Exists (read before writing anything)

Confirmed by repo audit — **read these actual files first**, do not assume their contents from this summary:

- `stock-sim/apps/web/components/auth/AuthShell.tsx` — split-panel layout (market-pulse hero left, form right),
  shared by `/login` and `/register`, includes a tab-switcher between the two. Client component.
- `stock-sim/apps/web/app/login/page.tsx` — thin wrapper rendering `AuthShell` + `LoginForm`; already handles
  query-param notices (`?registered=1` → "account created" notice, `?expired=1` → "session expired" notice).
- `stock-sim/apps/web/app/register/page.tsx` — thin wrapper rendering `AuthShell` + `RegisterForm`.
- `stock-sim/apps/web/components/auth/LoginForm.tsx` — controlled email/password via a `useLogin()` hook; on
  success calls `setHasToken(true)` from `AuthContext` and routes to `/market`; handles 401 via `ApiError`.
  Currently uses raw `useState`, not react-hook-form.
- `stock-sim/apps/web/components/auth/RegisterForm.tsx` — controlled fields (display name, email, password,
  confirm password), client-side length/match validation, calls `useRegister()`, routes to `/login?registered=1`.
  Currently uses raw `useState`, not react-hook-form.
- `stock-sim/apps/web/components/auth/AuthInput.tsx` (new/untracked) — a plain `forwardRef` pill-style `<input>`
  wrapper with no validation logic of its own.
- Backend `stock-sim/apps/api/auth.py` — bcrypt hash/verify, JWT create/decode via `jose`, `get_current_user`,
  `get_current_user_optional`, `require_admin`.
- Backend `stock-sim/apps/api/routers/auth.py` — `POST /register`, `POST /login`, `GET /me`. JWT is
  Bearer-token based (`HTTPBearer`), **not cookie-based** — the token is presumably stored client-side in
  `AuthContext`/`lib/api/client.ts` (read both fully before touching anything downstream of them).
- **No `middleware.ts` exists anywhere in `apps/web`** — confirmed gap, no edge-level route protection today.
- No forgot-password, OTP, refresh-token, or session-revocation logic exists anywhere, frontend or backend.

This phase **continues** the in-progress work above. Do not rebuild AuthShell/LoginForm/RegisterForm/AuthInput
from scratch — extend and, where noted below, migrate them to react-hook-form + zod.

---

## PART C — Feature Specifications (extreme detail)

### C1. LOGIN (harden and finish the existing flow)

**Current gaps to close, not a rebuild:**
1. Migrate `LoginForm` from raw `useState` to `react-hook-form` + `zod`. Schema:
   ```
   loginSchema = z.object({
     email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
     password: z.string().min(1, "Password is required"),
   })
   ```
2. Field-by-field spec:
   - **Email field**: `AuthInput` type="email", `autoComplete="username"`, `autoFocus` on mount (page load,
     not on every re-render). Label above at `micro` size: "EMAIL". Placeholder: "you@example.com" in
     `ink-tertiary`.
   - **Password field**: `AuthInput` type="password" with a visibility toggle icon (eye/eye-off, 16px,
     `ink-secondary` at rest → `ink-primary` on hover) positioned inside the field's right padding, `micro`
     label "PASSWORD", `autoComplete="current-password"`.
   - **Remember me**: new — a small checkbox (Radix Checkbox) + `body` label "Stay signed in for 30 days",
     left-aligned under the password field. Wires to the refresh-token session lifetime chosen in C4 (a
     "remembered" session gets a 30-day refresh token; an unremembered session gets a browser-session-only
     refresh token — implement by varying the refresh cookie's `Max-Age`).
   - **Forgot password link**: `body` size, `accent-500` text, right-aligned on the same row as the password
     label, reads "Forgot password?" — routes to `/forgot-password`.
   - **Submit button**: Primary variant, full-width within the form column, height 40px (modal-primary height
     is appropriate here since this is the form's single primary action), label "Sign in". Loading state:
     label swaps for 14px indeterminate arc, width locked.
3. **Validation timing**: validate on blur for individual fields, validate all on submit. Do not validate on
   every keystroke (that's aggressive and违反s the "quiet surfaces" ethos) — except the password field, which
   should clear its error the instant the user starts typing again (better perceived responsiveness for the
   most common failure).
4. **Error states**:
   - Field-level (empty/malformed email): `caption` amber line directly below the field, small warning icon
     (12px) to its left, field border becomes amber. Example copy: "Enter a valid email address."
   - Server-level 401 (wrong credentials): do NOT reveal whether the email exists or the password is wrong
     (enumeration protection) — single generic message rendered as a full-width amber-bordered inline banner
     above the submit button (not a toast — this is a primary-path error, keep it in-flow): "That email and
     password combination doesn't match our records." Icon: 16px warning triangle, `warn` color.
   - Server-level 429 (rate-limited, ties to existing `rate_limiter.py`): same banner treatment, copy: "Too
     many attempts. Try again in {n} seconds." — if the API returns a `Retry-After` header, render a live mono
     countdown inside the message that disables the submit button until it hits zero.
   - Network/5xx error: same banner treatment, copy: "Something went wrong on our end. Please try again." plus
     a small "Retry" ghost link inline in the message (not a separate button).
5. **Success**: on 200, briefly show the button's success micro-state is unnecessary — go straight to
   `router.push` to the post-login destination. Destination logic (new): if a `?redirect=` query param is
   present (set by `middleware.ts`, see C6), route there instead of the hardcoded `/market`/`/dashboard`.
   Validate the redirect target is a same-origin relative path before using it (open-redirect protection) —
   reject anything starting with `http`, `//`, or containing a `:`.
6. **Query-param notices** (already partially built — verify and finish): `?registered=1` → accent-colored
   inline banner above the form: "Account created. Sign in to get started." `?expired=1` → amber inline
   banner: "Your session expired. Sign in again to continue." `?reset=1` (new, from C2) → accent banner:
   "Password updated. Sign in with your new password."

### C2. FORGOT PASSWORD (fully new)

**Route: `/forgot-password`** — reuses `AuthShell`'s split-panel layout in single-column form mode (no
login/register tab switcher visible on this route; instead a "Back to sign in" ghost link at the top of the
form column, `body` size with a left chevron 14px icon).

**Step 1 — Request form:**
- Heading-2: "Reset your password".
- `body` secondary-ink line beneath: "Enter the email associated with your account and we'll send you a link
  to reset your password."
- Single field: Email, same `AuthInput` treatment as login, schema `z.string().email()`.
- Submit button: Primary, full width, label "Send reset link". Loading: indeterminate arc, locked width.
- On submit: **always show the same success state regardless of whether the email exists** (no-enumeration
  rule — this is the single most important behavioral requirement of this feature, do not skip it for
  convenience).

**Step 2 — Confirmation state (replaces the form in place, same card, no navigation):**
- A checkmark-in-circle line icon (24px, accent-tinted, matching the Empty States illustration style: line-
  drawn with one accent element).
- Heading-2: "Check your email".
- `body` secondary-ink: "If an account exists for **{email}**, we've sent a link to reset your password. The
  link expires in 15 minutes."
- Ghost button: "Resend email" — disabled for 30 seconds after send with a mono countdown inside the label
  ("Resend in 0:24"), then re-enables. Reuses the same request endpoint.
- Ghost link below: "Back to sign in" → `/login`.

**Backend — `POST /auth/forgot-password`:**
- Request body: `{ email: string }`.
- **Always returns `200 { message: "If an account exists, a reset link has been sent." }` regardless of
  whether the email is found** — this is the enumeration-protection contract; the frontend's Step 2 copy is
  written to match this ambiguity deliberately.
- If the email exists: generate a reset token. Use a signed JWT with `type: "password_reset"`, `sub: user.id`,
  `exp: now + 15 minutes`, plus a `jti` (unique token id) persisted in a new `password_reset_tokens` table
  (columns: `id`, `user_id` FK, `jti`, `created_at`, `expires_at`, `consumed_at` nullable) so the token is
  **single-use and revocable** even though it's a signed JWT — checking `consumed_at IS NULL` server-side on
  redemption is what makes it single-use, the JWT signature alone only proves authenticity, not one-time use.
  This is worth the extra table over a stateless-only JWT specifically because password reset tokens are
  high-value enough to want revocability (e.g. "invalidate all outstanding reset tokens if the user changes
  their password through another path first").
- Rate-limit this endpoint via the existing `rate_limiter.py` — cap at e.g. 3 requests per email per hour and
  a separate per-IP cap, to prevent both spam and enumeration-via-timing.
- Email delivery: **there is no email service in this codebase yet.** Build `apps/api/services/email_service.py`
  with a clean interface:
  ```python
  class EmailService(Protocol):
      async def send_password_reset(self, to: str, reset_url: str, expires_in_minutes: int) -> None: ...
      async def send_otp_code(self, to: str, code: str, purpose: str) -> None: ...  # used by C3

  class ConsoleEmailService:
      # dev/local implementation: logs the email content (including the full reset URL) to stdout
      # instead of sending anything. This is the only implementation you build in this phase.
  ```
  Wire `ConsoleEmailService` via dependency injection (same pattern as other services in `dependencies.py`).
  **Do not integrate a real provider (SendGrid, SES, Postmark, etc.) without asking the user first** — that's
  a credential and cost decision outside this phase's authority.

**Step 3 — Reset form, route `/reset-password?token=...`:**
- If `token` query param is missing entirely: show an inline error card in place of the form (not a toast):
  warning icon, Heading-2 "Invalid reset link", body copy "This password reset link is missing required
  information.", ghost button "Request a new link" → `/forgot-password`.
- On mount, do not eagerly validate the token against the server (avoids a wasted round trip if the user is
  just going to fill the form anyway) — validate it as part of the actual `POST /auth/reset-password` call.
- Fields: **New password** (`AuthInput` type="password", visibility toggle, `micro` label "NEW PASSWORD",
  `autoComplete="new-password"`) and **Confirm new password** (same treatment, label "CONFIRM PASSWORD").
- Password strength rule (match whatever RegisterForm currently enforces — read it first; if it's currently
  just a min-length check, keep this consistent rather than inventing a stricter rule here that diverges from
  registration): minimum 8 characters. Show a live `caption` hint below the new-password field while typing,
  not just on error: "At least 8 characters" in `ink-tertiary`, turning `market-up`-adjacent... **no** — do
  not use market-up for this, use `accent-500` with a small checkmark glyph once satisfied (this is a generic
  UI success signal, not market data, so per A2 it must not use green).
- Confirm-password mismatch: inline amber caption "Passwords don't match" the moment the confirm field's value
  diverges from the new-password field AND the confirm field has been blurred at least once (avoid flashing
  the error while the user is still mid-typing their first pass).
- Submit button: Primary, full width, label "Reset password".
- **Backend `POST /auth/reset-password`**: body `{ token: string, new_password: string }`. Validates the JWT
  signature and expiry, checks the `jti` against `password_reset_tokens.consumed_at IS NULL`, hashes and
  updates the user's password, sets `consumed_at = now()` on the token row, and — critically — **revokes all
  existing refresh-token sessions for that user** (ties into C4; a password reset should force re-login
  everywhere, since the old password may have been compromised, which is exactly why someone is resetting it).
  Returns `200 { message: "Password updated." }`.
  - Expired/invalid/already-consumed token → `400` with a specific error code the frontend maps to: inline
    error card (same treatment as the missing-token case above) with copy "This reset link has expired or
    already been used.", ghost button "Request a new link" → `/forgot-password`.
- On success: `router.push("/login?reset=1")` (wires into the C1 §6 query-param notice).

### C3. OTP (email-based step-up verification)

Scope decision baked in per the original master plan: **email-based OTP only** for this phase — no SMS
provider integration without asking first (separate credential/cost decision). Before wiring OTP into the main
login flow as a mandatory gate, **confirm with the user whether OTP is mandatory-after-registration or
opt-in via Settings (Phase 6 territory)** — do not silently make it mandatory; build the mechanism now, wire
the decision once confirmed.

**Backend:**
- New table `otp_codes`: `id`, `user_id` FK, `code_hash` (bcrypt-hash the 6-digit code, never store plaintext),
  `purpose` (enum: `login`, `register`, `password_reset` — extensible), `expires_at`, `consumed_at` nullable,
  `attempt_count` (int, default 0), `created_at`.
- `POST /auth/otp/request` — body `{ purpose: string }` (authenticated or tied to a pending-login session
  token depending on how the login-time OTP flow is wired). Generates a cryptographically random 6-digit code
  (`secrets.randbelow`, not `random`), hashes it, stores it with a 10-minute expiry, invalidates any prior
  unconsumed code of the same purpose for that user, and calls `email_service.send_otp_code(...)`. Rate-limit
  via existing `rate_limiter.py`: max 1 request per 60 seconds per user, max 5 per hour.
- `POST /auth/otp/verify` — body `{ purpose: string, code: string }`. Looks up the latest unconsumed code for
  that user+purpose, checks expiry, checks `attempt_count < 5` (lock out after 5 wrong attempts within the
  code's lifetime, requiring a fresh `request` call), compares the hash, increments `attempt_count` on
  mismatch, sets `consumed_at` on match. Returns `200 { verified: true }` or `400` with a specific reason code
  (`expired`, `invalid`, `locked`).

**Frontend — reusable `OTPInput` component (new, `components/auth/OTPInput.tsx`)** since none exists and this
is exactly the kind of primitive worth building once, reusably:
- 6 individual boxed digit cells, each a `data` mono type input, `radius-sm`, well one step darker than parent
  (matches the Inputs spec's numeric-input treatment), 40px square, 8px gap between cells.
- Auto-advance: typing a digit in cell N moves focus to cell N+1 automatically; Backspace on an empty cell
  moves focus to cell N-1 and clears it.
- Paste support: pasting a 6-digit string into any cell distributes the digits across all 6 cells and focuses
  the last one.
- Only accepts numeric input; non-numeric keystrokes are ignored (not shown as an error, just silently
  rejected — this isn't a validation failure, it's input filtering).
- On all 6 cells filled, auto-submits (calls the verify handler) without requiring an explicit button press —
  standard OTP UX expectation — but still render a Primary "Verify" button (disabled until all 6 are filled)
  as a fallback for accessibility/assistive-tech users who may not trigger the auto-submit reliably.
- Focus ring: standard `glow-accent` per A9, on whichever cell is currently focused.

**OTP screen composition** (used both for a login-time 2FA step and, potentially, elsewhere later):
- Heading-2: "Enter verification code".
- `body` secondary-ink: "We sent a 6-digit code to **{masked email}**." — mask as `ex***@domain.com` (show
  first 2 chars of local-part, then `***`, then the full domain — do not fully hide the domain, users need to
  recognize which inbox to check).
- The `OTPInput` component, centered.
- Below it: "Didn't get a code? Resend" — ghost link, disabled for 30s post-send with mono countdown identical
  in behavior to the Forgot Password resend (share the countdown logic as one small hook, e.g.
  `useResendCooldown(seconds)`, rather than duplicating the timer in two places).
- Error states: wrong code → the filled cells flash their border to amber briefly (240ms data-tick timing per
  A7) and clear, focus returns to cell 1, an inline `caption` amber line appears below the input group: "That
  code isn't right. {n} attempts remaining." Expired code → same inline line: "This code has expired." with
  the resend link immediately enabled (bypass the cooldown in this specific case, since the user has no valid
  code to fall back on). Locked out (5 failed attempts) → the whole input group disables, inline line: "Too
  many incorrect attempts. Request a new code to try again.", resend link immediately available.

### C4. SESSIONS (refresh-token mechanism — the real infrastructure work of this phase)

**Problem being solved**: current JWT is a single long-lived bearer token, stored client-side, with no refresh
and no server-side revocation — meaning "sign out" is purely cosmetic (the token remains valid until it
naturally expires) and there is no way to build a "sign out of this device" feature later (Phase 6) without
this groundwork.

**New table `sessions`**:
- `id` (UUID, primary key — this becomes the refresh token's `jti`)
- `user_id` FK
- `refresh_token_hash` (hash the token itself, never store it plaintext, same reasoning as password/OTP hashing)
- `device_label` (derived from `User-Agent` at creation — a simple heuristic parse, e.g. "Chrome on Windows",
  not a full device-fingerprinting library; good enough for human recognition in a sessions list)
- `ip_address` (store for the sessions list's transparency, not for strict binding/enforcement in v1 — IP-bound
  sessions break for users on mobile networks/VPNs and that stricter model is out of scope here)
- `created_at`, `last_active_at` (bump on every successful refresh), `expires_at`, `revoked_at` nullable

**Token model**:
- **Access token**: short-lived JWT (15 minutes), Bearer, sent in `Authorization` header exactly as today —
  no change to how existing authenticated requests work, only how the token is obtained/renewed.
- **Refresh token**: opaque random string (not a JWT — no need for the client to read its contents), stored in
  an **httpOnly, Secure, SameSite=Strict cookie** named e.g. `mv_refresh`. **Never store the refresh token in
  localStorage or sessionStorage** — this defeats the entire purpose of moving to httpOnly cookies (XSS
  exfiltration resistance). Lifetime: 7 days by default, **30 days if "Remember me" was checked at login**
  (C1 §2), enforced via the cookie's `Max-Age` and the `sessions.expires_at` column matching.

**Endpoints:**
- `POST /auth/login` (extend existing): on success, in addition to the existing response body, set the
  `mv_refresh` httpOnly cookie and create a `sessions` row. Response body still returns the short-lived access
  token as today (client keeps using it in-memory/via existing `AuthContext`, just with a much shorter life).
- `POST /auth/refresh`: no request body needed (reads the `mv_refresh` cookie). Validates the refresh token
  against the `sessions` table (hash match, not expired, not revoked), issues a new short-lived access token,
  bumps `last_active_at`, and — **rotates the refresh token** (issue a new opaque value, update the stored
  hash, reset the cookie) on every use. Refresh-token rotation means a stolen-and-reused old refresh token
  becomes detectable (if an old, already-rotated token is presented, treat it as a signal of compromise and
  revoke the entire session rather than silently failing) — this is a meaningfully stronger security posture
  than static refresh tokens and is worth the extra complexity given this is explicitly the "harden sessions"
  feature of the phase.
- `POST /auth/logout`: revokes the current session (`revoked_at = now()` on the matching `sessions` row,
  identified via the refresh cookie), clears the `mv_refresh` cookie client-side.
- `POST /auth/logout-all`: revokes all sessions for the current user, clears the current cookie. (The full UI
  for this — a "sign out everywhere" button — is Phase 6 territory; build the endpoint now since it's trivial
  once the session model exists, but do not build its dedicated settings-page UI in this phase.)

**Frontend — silent refresh interceptor:**
- Read `lib/api/client.ts` fully first; do not assume its current shape.
- Add response-interceptor logic: on any request that fails with `401` due to an expired access token,
  automatically attempt `POST /auth/refresh` once, and if that succeeds, retry the original request
  transparently with the new access token. If the refresh call itself fails (expired/revoked refresh token),
  clear local auth state and redirect to `/login?expired=1` (wiring into the existing C1 §6 notice).
- Guard against a refresh-storm: if multiple requests 401 simultaneously (e.g. several widgets fetching in
  parallel on page load), only issue **one** `/auth/refresh` call and queue the others behind its result,
  rather than firing N parallel refresh calls that would race the token-rotation logic against itself.
- This entire mechanism must be invisible to the user in the common case — no loading flicker, no visible
  "reconnecting" state, unless the refresh genuinely fails (in which case the redirect-to-login with the
  `expired=1` notice is the correct, visible outcome).

**Not in this phase's UI scope**: the actual Sessions *list panel* (device names, "revoke" buttons per
session) is explicitly Phase 6 (Settings) territory — this phase builds only the backend mechanism, the login
integration, and the silent-refresh client logic. Building the mechanism without its future UI is intentional
sequencing, not an oversight — flagged here so it isn't mistaken for scope-cutting.

### C5. PROTECTED ROUTES (`middleware.ts` — closes a confirmed, real gap)

**File: `apps/web/middleware.ts` — does not exist today, this is wholly new.**

- Runs at the edge on every request matching the configured matcher (see below), before any page component
  renders — this is what prevents the "flash of protected content before client-side redirect" problem that
  a purely `AuthContext`-based gate would have.
- **Protected path prefixes** (redirect to `/login?redirect=<path>` if no valid session): `/dashboard`,
  `/portfolio`, `/market`, `/companies`, `/trading` (Phase 3), `/simulation` (Phase 4), `/ai` (Phase 5),
  `/settings` (Phase 6). Build the matcher as an explicit array so future phases' routes are added here
  deliberately, not inferred by a broad catch-all that might accidentally protect or expose the wrong thing.
- **Auth-only paths** (redirect *away* to `/dashboard` if a valid session already exists): `/login`,
  `/register`, `/forgot-password`, `/reset-password`. (Do not gate `/reset-password` on "already logged in" in
  a way that blocks a logged-in user from resetting their password from a link they received while logged
  out on another device — check the specific product decision with the user if this edge case matters; default
  recommendation: allow `/reset-password` to render regardless of current session state, since the token in
  the URL is its own authorization, but still redirect `/login` and `/register` away.)
- **Public paths** (no gating): the marketing landing page, and anything explicitly public (news read-only
  pages, if any exist — check before assuming).
- **Session check at the edge**: middleware cannot easily verify a JWT's cryptographic signature against a
  secret without bundling that secret into edge-runtime-compatible code — the simplest correct approach is to
  check for the **presence and non-expiry of a lightweight, non-httpOnly "is logged in" indicator cookie** set
  alongside the httpOnly refresh cookie at login (e.g. `mv_session=1`, readable by middleware, not the actual
  credential) and treat that as the fast-path gate, while the *real* authorization for every API call still
  happens server-side via the Bearer access token on each request as today. This avoids doing full JWT
  verification in the edge runtime while still closing the "unauthenticated user sees protected page shell"
  gap. Confirm this approach against how `AuthContext` currently tracks `hasToken` before implementing, so the
  two mechanisms (edge cookie flag + client-side context) stay consistent rather than diverging.
- On redirect to `/login?redirect=<path>`, the `redirect` param must be validated on the receiving end (C1 §5's
  open-redirect protection) before use.
- Do not gate static assets, `/api` routes (the FastAPI backend is a separate origin/service, not part of this
  Next.js middleware's concern), or Next.js internals — scope the matcher precisely.

---

## PART D — Strict Do-Not List (Phase 1)

- **Do NOT** wire a real email provider (SendGrid, SES, Postmark, Resend, etc.) or SMS provider — stub behind
  the `EmailService` interface with only a console/dev implementation. Provider choice is a credential and
  cost decision for the user, not this phase.
- **Do NOT** store the refresh token in `localStorage`, `sessionStorage`, or any client-readable storage. It
  must be an httpOnly cookie, full stop.
- **Do NOT** make protected-route enforcement client-side-only (i.e. do not skip `middleware.ts` and rely on
  `AuthContext` alone) — this causes a visible flash of protected content, which is both a UX and a security
  smell explicitly called out as a gap to close.
- **Do NOT** reveal whether an email address exists in the system via response differences, timing
  differences, or copy differences on Forgot Password or OTP-request endpoints.
- **Do NOT** store OTP codes or password-reset tokens in plaintext — hash them, same as passwords.
- **Do NOT** build a second, parallel rate-limiting mechanism — extend the existing `rate_limiter.py`.
- **Do NOT** silently decide OTP is mandatory for all users post-registration — this is an explicit decision
  point requiring user confirmation before wiring it into the default login path.
- **Do NOT** use market green/red for any success/error/validation state in this phase — every success signal
  is `accent-500`, every warning/validation signal is `warn` amber.
- **Do NOT** exceed 14px border radius anywhere, or introduce any gradient/glow beyond `glow-accent` and the
  spec's defined top-light card gradient.
- **Do NOT** let form submit buttons change width when entering their loading state.
- **Do NOT** rebuild `AuthShell`, `LoginForm`, `RegisterForm`, or `AuthInput` from scratch — extend the
  existing implementations; migrate their validation to react-hook-form + zod rather than forking new versions.
- **Do NOT** build the Sessions *list UI* (device management panel) in this phase — that is explicitly Phase 6
  scope; this phase delivers only the backend session mechanism and silent-refresh client logic.
- **Do NOT** touch Dashboard, Portfolio, Market Explorer, or Company Details internals — this phase's file
  boundary is authentication (`app/login`, `app/register`, `app/forgot-password`, `app/reset-password`,
  `components/auth/*`, `middleware.ts`, `apps/api/auth.py`, `apps/api/routers/auth.py`,
  `apps/api/services/email_service.py`, and the relevant Alembic migrations/DB models) — nothing else.
- **Do NOT** skip the Alembic migration step for any new table (`password_reset_tokens`, `otp_codes`,
  `sessions`) — no manual schema edits.
- **Do NOT** implement full device fingerprinting or IP-binding enforcement for sessions — a simple
  User-Agent-derived label and stored (not enforced) IP address is sufficient for v1.
- **Do NOT** ship this phase without testing the full loop manually in a browser: register → login →
  forced-expire an access token and confirm silent refresh works → forgot password → receive (console-logged)
  reset link → reset → confirm old sessions are revoked and re-login is required → trigger OTP request/verify
  end to end → confirm `middleware.ts` actually redirects an unauthenticated request to `/login` and blocks a
  logged-in user from seeing `/login` itself.

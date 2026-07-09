# Phase 6 — Web Frontend: Build Plan

> **Scope:** Next.js (React) + TypeScript frontend over the Phase 5 REST API — market grid, company detail, portfolio, trading, leaderboard, news, simulation controls, auth.
> **Status:** ⬜ Not started
> **Depends on:** Phases 1–5 (engine, DB, seeds, API)
> **New directory:** `apps/web/`

---

## 0. Prerequisites — Project Scaffold

### `apps/web/package.json`

| Dependency | Version | Purpose |
|------------|---------|---------|
| `next` | `^15` | React framework with SSR/ISR |
| `react` | `^19` | UI library |
| `react-dom` | `^19` | React DOM renderer |
| `typescript` | `^5` | Type safety |
| `tailwindcss` | `^4` | Utility-first CSS |
| `shadcn/ui` | latest | Accessible component primitives (built on Radix UI + Tailwind) |
| `@tanstack/react-query` / `swr` | latest | Server-state fetching + caching |
| `lucide-react` | latest | Icon library |
| `recharts` | latest | Portfolio analytics charts (allocation donut, performance line) |
| `lightweight-charts` | latest | OHLC candlestick chart for company detail page |
| `openapi-typescript` | dev | Generate TS types from API OpenAPI schema |
| `@playwright/test` | dev | E2E testing |

### `apps/web/tsconfig.json`

Standard Next.js 15 tsconfig with `@/` path alias mapping to `./` (or `./src/` depending on structure chosen).

### `apps/web/next.config.ts`

```ts
const nextConfig = {
  async rewrites() {
    return [
      // Proxy API calls in dev to avoid CORS issues
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
    ];
  },
};
export default nextConfig;
```

### `apps/web/tailwind.config.ts` — extends `shadcn/ui` preset with the stock-sim brand tokens.

### Scripts

| Script | Command |
|--------|---------|
| `dev` | `next dev --port 3000` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `typegen` | `bash ../../scripts/gen-api-types.sh` |
| `test:e2e` | `playwright test` |

### Type Generation

Run `npm run typegen` (calls `scripts/gen-api-types.sh`) to generate `apps/web/lib/api/types.ts` from the running API's OpenAPI schema. The generated types cover all 22+ endpoint request/response models.

**File tree:**
```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json          # shadcn/ui config
├── lib/
│   ├── api/
│   │   ├── types.ts         # Auto-generated from OpenAPI
│   │   ├── client.ts        # Axios/fetch wrapper with auth token injection
│   │   └── hooks/           # React Query hooks per resource
│   │       ├── useMarket.ts
│   │       ├── useCompany.ts
│   │       ├── usePortfolio.ts
│   │       ├── useOrders.ts
│   │       ├── useLeaderboard.ts
│   │       ├── useNews.ts
│   │       └── useSimulation.ts
│   └── utils.ts             # cn() helper for Tailwind class merging
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, card, dialog, table, form, etc.)
│   ├── layout/
│   │   ├── Header.tsx       # Nav bar with auth state, search, timeline selector
│   │   └── Sidebar.tsx      # (optional) Side nav
│   ├── market/
│   │   ├── MarketGrid.tsx        # Sortable/filterable table of all companies
│   │   ├── CompanyRow.tsx        # Single row with price, day change, IV gap
│   │   ├── SectorHeatmap.tsx     # (stretch) Sector performance overview
│   │   └── PriceChart.tsx        # Lightweight-Charts OHLC + IV overlay
│   ├── portfolio/
│   │   ├── HoldingsTable.tsx     # Position list with PnL
│   │   ├── AllocationDonut.tsx   # Recharts pie chart by sector
│   │   ├── PerformanceLine.tsx   # Portfolio value over time vs market index
│   │   └── AnalyticsCards.tsx    # Return, volatillity, win rate, Sharpe
│   ├── trading/
│   │   ├── OrderForm.tsx         # Buy/sell panel with market impact preview
│   │   └── OrderBook.tsx         # (stretch) Simulated order book depth
│   ├── news/
│   │   ├── NewsFeed.tsx          # Chronological feed with filters
│   │   └── NewsCard.tsx          # Single news item
│   ├── leaderboard/
│   │   ├── LeaderboardTable.tsx  # Ranked list with pagination
│   │   └── LeaderboardRow.tsx
│   ├── simulation/
│   │   ├── AdvanceControls.tsx   # Sim speed + advance N days
│   │   ├── TimelineBranch.tsx    # Create/fork timeline UI
│   │   └── CycleIndicator.tsx    # Current economic phase badge
│   └── auth/
│       ├── LoginForm.tsx
│       └── RegisterForm.tsx
├── app/
│   ├── layout.tsx           # Root layout with Header, providers (React Query, Auth)
│   ├── page.tsx             # Landing / Market Overview (redirect to /market)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── market/page.tsx      # MarketGrid full page
│   ├── companies/[ticker]/page.tsx  # Company detail (chart, financials, drivers, buy/sell)
│   ├── portfolio/page.tsx   # Holdings, analytics, allocation
│   ├── trading/page.tsx     # (or integrated into company detail)
│   ├── leaderboard/page.tsx
│   ├── news/page.tsx
│   ├── simulation/page.tsx  # Timeline controls, advance, branch
│   └── admin/page.tsx       # (stretch) Config editor, event injector
└── public/
    └── favicon.ico
```

---

## 1. API Client Layer

### `lib/api/client.ts` — Fetch Wrapper

**What:** Thin wrapper around `fetch` (or Axios) that:
- Injects `Authorization: Bearer <token>` header from localStorage/sessionStorage
- Reads `NEXT_PUBLIC_API_URL` for the base URL
- Handles 401 → redirect to login
- Returns typed JSON using generated types

```ts
import type { paths } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
```

**Exported helpers:**
- `get(path, params?)` → GET with query string
- `post(path, body)` → POST with JSON body
- `put(path, body)` → PUT with JSON body
- `del(path)` → DELETE

### `lib/api/hooks/*.ts` — React Query Hooks

Each hook file exports custom hooks using `@tanstack/react-query`:

**`useMarket.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useMarketGrid(timelineId)` | `["market", timelineId]` | `GET /market` | `MarketGridResponse` |
| `useCycleState(timelineId)` | `["cycle", timelineId]` | `GET /market/cycle` | `CycleStateResponse` |

**`useCompany.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useCompany(ticker, timelineId)` | `["company", ticker, timelineId]` | `GET /companies/{ticker}` | `CompanyDetail` |
| `usePriceHistory(ticker, timelineId, from, to)` | `["history", ticker, ...]` | `GET /companies/{ticker}/history` | `PriceHistoryItem[]` |
| `useDrivers(ticker, timelineId, simDate?)` | `["drivers", ticker, ...]` | `GET /companies/{ticker}/drivers` | `DriverBreakdown[]` |
| `useFinancials(ticker, period?)` | `["financials", ticker]` | `GET /companies/{ticker}/financials` | `FinancialStatementResponse` |
| `useValuation(ticker, timelineId)` | `["valuation", ticker]` | `GET /companies/{ticker}/valuation` | `ValuationResponse` |

**`usePortfolio.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `usePortfolio(timelineId)` | `["portfolio", timelineId]` | `GET /portfolio` | `PortfolioResponse` |
| `usePortfolioAnalytics(timelineId)` | `["portfolio-analytics", timelineId]` | `GET /portfolio/analytics` | `PortfolioAnalyticsResponse` |
| `useTransactions(timelineId, limit, offset)` | `["transactions", ...]` | `GET /transactions` | `TransactionItem[]` |

**`useOrders.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `usePlaceOrder()` | mutation | `POST /orders` | `OrderResponse` |

**`useLeaderboard.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useLeaderboard(timelineId, limit, offset)` | `["leaderboard", ...]` | `GET /leaderboard` | `LeaderboardEntry[]` |

**`useNews.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useNews(timelineId, simDate?, companyId?, limit, offset)` | `["news", ...]` | `GET /news` | `NewsItem[]` |

**`useSimulation.ts`:**
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useSimState(timelineId)` | `["sim-state", timelineId]` | `GET /sim/state` | `SimulationStateResponse` |
| `useAdvance()` | mutation | `POST /sim/advance` | `AdvanceResponse` |
| `useTimelines()` | `["timelines"]` | `GET /sim/timelines` | `TimelineResponse[]` |
| `useCreateTimeline()` | mutation | `POST /sim/timelines` | `TimelineResponse` |

**Auth hooks** (in `useAuth.ts` or inline):
| Hook | Query Key | API Call | Returns |
|------|-----------|----------|---------|
| `useLogin()` | mutation | `POST /auth/login` | `TokenResponse` |
| `useRegister()` | mutation | `POST /auth/register` | `UserResponse` |
| `useMe()` | `["me"]` | `GET /auth/me` | `UserResponse` |

---

## 2. Auth Flow

**Login flow:**
1. User fills `LoginForm` → `POST /auth/login` → receives JWT
2. Store token in `localStorage` key `"token"`
3. React Query `AuthProvider` reads token, provides it to `client.ts`
4. `useMe()` runs on mount to validate token + load user profile
5. On 401: clear token, redirect to `/login`

**Register flow:**
1. User fills `RegisterForm` → `POST /auth/register`
2. Auto-redirect to `/login` with success toast

**Protected routes:** Wrap pages in `<ProtectedRoute>` component that checks `useMe()` and redirects to `/login` if not authenticated.

---

## 3. Pages (Routes)

### `/login` — Login Page

- `LoginForm` component: email + password inputs, submit button
- On success: store token, redirect to `/market`
- Link to `/register`
- Error state: show `"Invalid credentials"` message
- Loading state: disabled button + spinner

### `/register` — Registration Page

- `RegisterForm` component: email + password + display name
- On success: redirect to `/login` with "Account created" toast
- Validation: password ≥ 8 chars inline

### `/market` — Market Overview (default authenticated landing page)

**Purpose:** Sortable, filterable grid of all 150 companies with real-time data.
**Data:** `useMarketGrid(timelineId)`
**UI components:**
- `CycleIndicator` badge (expansion/peak/contraction/trough)
- `MarketGrid` table:
  - Columns: Ticker, Name, Industry, Price, Day Change %, IV Gap, Market Cap, Volatility
  - Sortable by any column (client-side via `useMemo`)
  - Search/filter by ticker or name (client-side filter)
  - Click row → navigate to `/companies/{ticker}`
  - Color coding: green for positive day change, red for negative
- Auto-refresh: poll every 5 seconds (or after each sim advance)

**States:**
- Loading: skeleton rows (8 rows, shimmer animation)
- Empty: "No companies loaded. Seed the database first."
- Error: "Could not load market data. The API may be offline."
- Edge: 0-price companies are marked `"N/A"` in the Price column

### `/companies/[ticker]` — Company Detail

**Purpose:** Full company profile with price chart, financials, valuation, and buy/sell panel.
**Data:** `useCompany(ticker)`, `usePriceHistory(ticker)`, `useDrivers(ticker)`, `useFinancials(ticker)`, `useValuation(ticker)`
**UI sections:**
- **Header:** Ticker, name, industry badge, current price, day change
- **Price Chart:** Lightweight-Charts candlestick with IV overlay line
  - Timeframe selector: 1M, 3M, 6M, 1Y, All
  - Toggle IV overlay on/off
- **Driver Breakdown:** Stacked bar or radar chart of the 7 price drivers
- **Financial Statements:** Tabbed view (Income / Balance / Cashflow) for latest fiscal period
- **Valuation:** Card showing intrinsic score, fair PE, moat, management quality, FCF quality, growth potential
- **Order Panel:** (right sidebar or bottom section)
  - Buy/sell toggle + quantity input + market impact preview
  - Estimated execution price after Kyle's lambda impact
  - Submit button

**States:**
- Loading: skeleton layout matching the sections
- 404: "Company '{ticker}' not found" with link back to `/market`
- Error: retry button
- Edge: no price history → "No trading data yet" message in chart area
- Edge: no financials → "Financial statements not available"

### `/portfolio` — Portfolio Dashboard

**Purpose:** Full view of user's holdings, analytics, and transaction history.
**Data:** `usePortfolio(timelineId)`, `usePortfolioAnalytics(timelineId)`, `useTransactions(timelineId)`
**UI sections:**
- **Summary Cards:** Total Value, Cash Balance, Day Change %, Total Return %
- **Allocation Donut:** Recharts pie chart by sector with percentage labels
- **Holdings Table:** Ticker, quantity, avg cost, current price, market value, unrealized PnL, PnL %
  - Sortable by value or PnL
  - Green/red coloring on PnL
  - Click row → navigate to `/companies/{ticker}`
- **Performance Chart:** Portfolio value over time vs market index line (stretch: normalize to starting cash)
- **Analytics Cards:** Win Rate, Realized PnL, Unrealized PnL, Cash Allocation %
- **Transaction History:** Paginated table of past trades

**States:**
- Loading: skeleton cards + table
- Empty portfolio: "You have no holdings. Start trading on the market page."
- Error: toast + retry

### `/trading` — Trading Page (optional, if order panel lives on company detail page)

Simpler approach: embed the OrderForm in the company detail page. If a standalone trading page is desired, it shows:
- Company search + quick-order form
- Open orders (stretch: order book visualization)

### `/leaderboard` — Leaderboard

**Purpose:** See rankings of all players.
**Data:** `useLeaderboard(timelineId, limit, offset)`
**UI:**
- Paginated table: Rank, Username, Total Value, Return %
- Current user's row highlighted
- `offset` pagination: Previous / Next buttons

**States:**
- Loading: skeleton rows
- Empty: "No players yet. Be the first to trade!"
- Error: retry

### `/news` — News Feed

**Purpose:** Browse simulation news chronologically.
**Data:** `useNews(timelineId, companyId?, simDate?, limit, offset)`
**UI:**
- Filter bar: date picker, company dropdown, sentiment filter
- News cards: headline, date, sentiment badge (positive/green, negative/red, neutral/gray), severity indicator, company/industry tagline
- Pagination: load more / infinite scroll

**States:**
- Loading: skeleton cards
- Empty: "No news yet. Advance the simulation to generate events."
- Error: retry

### `/simulation` — Simulation Controls

**Purpose:** Advance time, create/d fork timelines, view simulation state.
**Data:** `useSimState(timelineId)`, `useTimelines()`, mutations for advance and create
**UI:**
- **Advance Controls:**
  - Current date + tick count display
  - Advance by: 1 day, 5 days, 30 days buttons
  - Loading spinner during advance
- **Cycle Status:** Badge showing current economic phase with description
- **Timeline Management:**
  - List of user's timelines (live + branched)
  - "Create Branch" button → form with name, seed override, scenario overrides
  - Branch timeline selector (dropdown to switch active timeline)

**States:**
- Loading: skeleton
- Error: "Simulation state not found. Run seed_initial_prices first."

### `/admin` — Admin Panel (stretch, admin role only)

**Purpose:** Tune config parameters, inject events manually.
**Data:** `GET /sim/admin/config`, `POST /sim/admin/events`, `PUT /sim/admin/config`
**UI:**
- **Config Editor:** Table of all `config_parameters` with inline editing
- **Event Injector:** Dropdown to select event + scope + severity + date → inject button
- **Only accessible to users with `role="admin"`**

---

## 4. Layout & Navigation

### `app/layout.tsx`

**Providers (wrapping children):**
- `QueryClientProvider` (React Query)
- `AuthProvider` (reads token, provides user context)
- `ThemeProvider` (shadcn/ui dark mode — optional)

**Header:** (sticky top)
- Logo / "Stock Sim" link → `/market`
- Nav links: Market, Portfolio, Leaderboard, News, Simulation
- Auth state: Login/Register buttons or avatar dropdown (Profile, Logout)
- Timeline selector dropdown (if the user has multiple timelines)

### Responsive Design

- Mobile: single-column stack, collapsible nav, full-width tables
- Tablet: two-column layout for company detail (chart left, order panel right)
- Desktop: full grid with sidebar nav option

---

## 5. Components (shadcn/ui)

Use shadcn/ui CLI to add primitives as needed:

```bash
cd apps/web
npx shadcn@latest add button card table dialog form input select badge tabs separator skeleton tooltip dropdown-menu avatar toast
```

**Custom styling conventions:**
- Positive changes: `text-green-600` (or `text-emerald-500`)
- Negative changes: `text-red-600`
- Price format: `$XXX.XX` (2 decimal places, `toLocaleString("en-US", {...})`)
- Percentage format: `+X.XX%` / `-X.XX%` (always show sign)
- Currency amounts: `$X,XXX.XX` with commas
- Large numbers: `$1.2B`, `$45.3M`

---

## 6. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| API offline | React Query `retry: 3` with exponential backoff; show "Connection lost" toast after 3 failures |
| Auth token expired | 401 from API → clear token, redirect to `/login` with `?expired=1` |
| Insufficient funds | `POST /orders` returns 400 → show "Insufficient cash" inline in OrderForm |
| Company not found | 404 from API → show "Company not found" page with back-to-market link |
| Stale data after advance | Invalidate all queries via `queryClient.invalidateQueries()` after advance mutation succeeds |
| Rate limited (429) | Client catches 429 → show "Too many requests. Slow down." toast |
| Double-click on order submit | Disable submit button immediately after click; show loading state |
| Zero-price companies | Show `"N/A"` in price columns; disable buy/sell for that ticker |
| Empty watchlist | Show "Your watchlist is empty. Add companies from the market page." |
| Branching without advancing | Branch shows same state as parent → visual indicator "No changes yet" |
| Large simulation advance (30+ days) | Show progress bar or loading overlay; prevent further actions until complete |
| Network tab | React Query devtools in dev mode |

---

## 7. File Tree Summary

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json
├── lib/
│   ├── api/
│   │   ├── types.ts                     # Auto-generated
│   │   ├── client.ts
│   │   └── hooks/
│   │       ├── useMarket.ts
│   │       ├── useCompany.ts
│   │       ├── usePortfolio.ts
│   │       ├── useOrders.ts
│   │       ├── useLeaderboard.ts
│   │       ├── useNews.ts
│   │       ├── useAuth.ts
│   │       └── useSimulation.ts
│   └── utils.ts
├── components/
│   ├── ui/                              # shadcn/ui primitives
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Providers.tsx
│   ├── market/
│   │   ├── MarketGrid.tsx
│   │   ├── CompanyRow.tsx
│   │   └── PriceChart.tsx
│   ├── portfolio/
│   │   ├── HoldingsTable.tsx
│   │   ├── AllocationDonut.tsx
│   │   ├── PerformanceLine.tsx
│   │   └── AnalyticsCards.tsx
│   ├── trading/
│   │   └── OrderForm.tsx
│   ├── news/
│   │   ├── NewsFeed.tsx
│   │   └── NewsCard.tsx
│   ├── leaderboard/
│   │   ├── LeaderboardTable.tsx
│   │   └── LeaderboardRow.tsx
│   └── simulation/
│       ├── AdvanceControls.tsx
│       ├── TimelineBranch.tsx
│       └── CycleIndicator.tsx
└── app/
    ├── layout.tsx
    ├── page.tsx                          # redirect → /market
    ├── login/page.tsx
    ├── register/page.tsx
    ├── market/page.tsx
    ├── companies/[ticker]/page.tsx
    ├── portfolio/page.tsx
    ├── leaderboard/page.tsx
    ├── news/page.tsx
    ├── simulation/page.tsx
    └── admin/page.tsx                    # stretch
```

**Estimated new files:** ~45 files
**Estimated pages:** 10 routes
**Estimated components:** ~20 custom + ~15 shadcn/ui primitives
**Estimated hooks:** 8 hook files (~25 hooks)

---

## 8. Build Order (Dependency Chain)

Build in this order — each step depends on the last:

```
 1. Scaffold: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
 2. `lib/api/types.ts`             ← run typegen against running API
 3. `lib/api/client.ts`            ← no dependencies
 4. `lib/utils.ts`                 ← no dependencies (cn() helper)
 5. shadcn/ui primitives           ← `npx shadcn@latest add button card table ...`
 6. `components/layout/Providers.tsx`  ← React Query + Auth provider
 7. `components/auth/LoginForm.tsx` + `RegisterForm.tsx` + `ProtectedRoute.tsx`
 8. `lib/api/hooks/useAuth.ts`     ← depends on client
 9. `app/login/page.tsx` + `app/register/page.tsx`    ← proof of auth flow
10. `components/layout/Header.tsx` + `app/layout.tsx`
11. `lib/api/hooks/useMarket.ts` + `components/market/MarketGrid.tsx`
12. `app/market/page.tsx`          ← first real page
13. `lib/api/hooks/useCompany.ts` + `components/market/PriceChart.tsx`
14. `app/companies/[ticker]/page.tsx`
15. `lib/api/hooks/usePortfolio.ts` + `components/portfolio/*`
16. `app/portfolio/page.tsx`
17. `components/trading/OrderForm.tsx` + `lib/api/hooks/useOrders.ts`
18. (integrate OrderForm into company detail page)
19. `lib/api/hooks/useLeaderboard.ts` + `components/leaderboard/*`
20. `app/leaderboard/page.tsx`
21. `lib/api/hooks/useNews.ts` + `components/news/*`
22. `app/news/page.tsx`
23. `lib/api/hooks/useSimulation.ts` + `components/simulation/*`
24. `app/simulation/page.tsx`
25. `app/admin/page.tsx`           ← stretch, last
26. Polish: loading states, error boundaries, responsive layout, dark mode
27. E2E tests (Playwright)
```

**Once all pages render with real API data**, Phase 6 is complete.

---

## 9. Known Risks & Design Decisions

| Risk | Mitigation |
|------|-----------|
| **API not running during development** | Next.js `rewrites` proxy in dev; provide a mock/fallback for isolated frontend dev |
| **CORS in production** | Backend already allows `*` in dev — tighten to frontend domain before deploy |
| **OpenAPI spec drift** | Regenerate `types.ts` on every API change via `npm run typegen` |
| **Large price history (252+ days × 150 companies)** | `GET /history` accepts `from`/`to` date params — frontend loads only visible range |
| **WebSocket vs polling for live updates** | Start with polling (every 5s) for simplicity; upgrade to SSE or WebSocket if latency becomes an issue |
| **Chart performance on mobile** | Lightweight-Charts is designed for mobile performance; limit visible candles to 200 |
| **Auth token expiry** | 24h TTL (configurable); prompt re-login on 401; no refresh token in v1 |

---

## 10. Verification

```bash
cd apps/web

# Install deps
npm install

# Generate TS types (API must be running on port 8001)
npm run typegen

# Start dev server
npm run dev

# Visit pages
open http://localhost:3000/market
open http://localhost:3000/portfolio
open http://localhost:3000/leaderboard
open http://localhost:3000/news
open http://localhost:3000/simulation

# Build for production
npm run build

# Run E2E tests (Playwright)
npm run test:e2e
```

**Acceptance criteria:**
- [ ] All 10 routes render with real API data
- [ ] Auth flow works: register → login → protected pages → logout
- [ ] Market grid loads 150 companies, sortable and searchable
- [ ] Company detail shows chart, drivers, financials, valuation
- [ ] Portfolio page shows holdings with PnL + analytics + sector allocation donut
- [ ] Place buy/sell orders from company detail and see portfolio update
- [ ] Leaderboard paginates correctly
- [ ] News feed displays events with filters
- [ ] Simulation advance moves the market forward
- [ ] All pages handle loading, empty, error, and edge states
- [ ] Responsive layout works on mobile (375px+) and desktop

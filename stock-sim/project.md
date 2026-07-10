# MASTER PROMPT & PRD — Fictional Stock Market Simulation

> **Purpose of this document.** This is the single source of truth for building a fictional stock-market simulation in which users trade in a made-up market whose prices behave like a real one. It doubles as (a) a **master prompt** you can hand to an AI builder or dev team, and (b) a **Product Requirements Document (PRD) + Requirements Specification**. It defines the philosophy, tech stack, the complete mathematical engine (all formulas), the factor taxonomy, an extensive database design, the API surface, the frontend, the Future Lab, and the exact build chronology.
>
> **Core thesis.** Every stock has a slow-moving **intrinsic value (IV)** derived from fundamentals, and a fast-moving **market price** that oscillates around that IV, pushed by short-term "price drivers." The simulation's job is to compute IV from fundamentals, then move price around IV realistically day by day.
>
> **Design mandate.** Build the entire system as a **plug-and-play skeleton**: schema, formulas, and engine wired up first, with placeholder/company data pluggable later. No hardcoded company numbers, no hardcoded weights — everything tunable lives in the database as configuration.

---

## 0. How to read this document

- **Sections 1–3** = product vision, stack, architecture.
- **Section 4** = the factor model (Intrinsic Value + Price Drivers), including the finalized Financial Quality sub-factor model and the 15 industries with their weight matrix.
- **Section 5** = the complete company attribute list.
- **Section 6** = the **Mathematical Engine** — every formula, precisely defined.
- **Section 7** = the **Database Design** (the most important section — read it twice).
- **Sections 8–12** = simulation engine, APIs, frontend, Future Lab, analytics.
- **Section 13** = the build chronology (what to do, in order).
- **Section 14** = requirements specification (functional + non-functional).
- **Section 15** = open parameters to calibrate.

---

## 1. Product Vision

### 1.1 What it is
A web application hosting a **self-contained fictional equity market** of ~150 companies across 15 industries. Prices move on a **daily tick** ("sim-day"): each tick advances the market one trading day, recomputing prices, generating events and news, and updating portfolios. Users get a starting cash balance and trade (buy/sell) to build a portfolio, learn valuation, and compete.

### 1.2 The two-engine model (the heart of everything)
1. **Intrinsic Value Engine** — computes each company's fair value from its fundamentals (three financial statements → factor scores → fair PE → IV). Slow-moving; changes mainly on earnings/guidance/structural events.
2. **Price Driver Engine** — computes short-term buying/selling pressure from 7 drivers and moves the market price around the IV each day. Fast-moving and noisy.

The price is mathematically tethered to IV by a **mean-reversion** mechanism, so it can deviate (over/undervaluation) but is always pulled back — exactly like a real market where price and value converge over time.

### 1.3 Time model
- **Day-based ticks.** One tick = one sim trading day. Ticks can be advanced by a scheduler (e.g., 1 sim-day every N real minutes/seconds) or on-demand (admin/user clicks "advance"), or fast-forwarded in the Future Lab.
- Fundamentals update on a **quarterly** cadence (every ~63 sim trading days), which is when IV re-anchors.

### 1.4 Scope / users
- **Single-player-clean but multiplayer-ready.** The market state is shared and global; each user owns a private portfolio. Leaderboards are optional and can be switched on. In multiplayer mode, user trades exert **price impact** through the liquidity model (Section 6.M). Design every table and API with a `user_id` scope so multiplayer is a config flag, not a rewrite.

---

## 2. Recommended Tech Stack (and why)

> You asked me to recommend. Here it is, with justification. The stack is chosen so the **math-heavy simulation engine** is easy to write and test, the **database** is first-class, and the **frontend** can render live charts smoothly.

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | **Next.js (React) + TypeScript**, Tailwind CSS | Fast dev, SSR/ISR for public pages, huge charting ecosystem, one component model for dashboard + charts. |
| **Charts** | **Lightweight-Charts (TradingView)** for candlesticks + **Recharts/visx** for analytics | Purpose-built for financial OHLC data; smooth for 150 tickers × long history. |
| **Backend API** | **Python + FastAPI** | Async, typed (Pydantic), auto OpenAPI docs. Python is the right language for the engine (below). |
| **Simulation Engine** | **Python (NumPy / pandas / SciPy)** | The engine is linear algebra + stochastic processes across 150 companies per tick. NumPy makes this vectorized, fast, and readable. Writing Ornstein-Uhlenbeck mean reversion, factor-correlation matrices, and percentile scoring in JS would be painful; in NumPy it's a few lines. |
| **Database** | **PostgreSQL** (primary), **TimescaleDB extension** for time-series (prices/volume) | Relational integrity for companies/financials + a hypertable for the massive OHLCV series. See Section 7 for why this matters enormously. |
| **Cache / queue** | **Redis** | Cache latest prices/quotes for fast reads; back the tick job queue. |
| **Background jobs** | **Celery** (or FastAPI + APScheduler for simple setups) | Runs the daily tick, quarterly fundamentals refresh, news generation. |
| **ORM / migrations** | **SQLAlchemy 2.0 + Alembic** | Versioned migrations are essential for a schema-first, plug-in-data-later approach. |
| **Auth** | **JWT** (access + refresh) or Auth.js/NextAuth if you want social login | Per-user portfolios; role = user/admin. |
| **Deployment** | Frontend on **Vercel**; backend + DB + Redis on **Render/Railway/Fly.io**, or all on a single VPS via **Docker Compose** | Start simple with Docker Compose; scale later. |
| **Testing** | **pytest** (engine + API), **Playwright** (frontend E2E) | The engine MUST be unit-tested — it's the product. |

**Alternative if you want one language end-to-end:** Next.js + Node/NestJS + PostgreSQL, doing the math in TypeScript with `mathjs`/`d3-array`. Viable, but you lose NumPy's ergonomics for the engine. **Recommendation stands: Python engine.**

**Monorepo layout:**
```
/apps
  /web            # Next.js frontend
  /api            # FastAPI app (REST) 
/engine           # Python simulation engine (importable by api + jobs)
/db               # Alembic migrations + seed scripts
/packages/shared  # shared TS types generated from OpenAPI
docker-compose.yml
```

---

## 3. System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              PostgreSQL                   │
                    │  reference data (static) + TimescaleDB    │
                    │  hypertables (time-series) + config       │
                    └───────────────▲───────────────▲──────────┘
                                    │               │
      writes each tick             │               │  reads
                    ┌──────────────┴───┐     ┌──────┴───────────┐
                    │ SIMULATION ENGINE │     │   FastAPI (REST) │
                    │  (Python/NumPy)   │     │  auth, trading,  │
                    │  - IV engine      │     │  portfolio, data │
                    │  - price engine   │     └──────▲───────────┘
                    │  - events/news    │            │
                    │  runs on tick job │      Redis  │ cache/quotes
                    └──────────▲────────┘            │
                               │ scheduler/on-demand │
                    ┌──────────┴─────────────────────┴──────────┐
                    │              Next.js Frontend               │
                    │  market view, charts, portfolio, Future Lab │
                    └─────────────────────────────────────────────┘
```

- The **engine** is the only writer of price/IV/news. The **API** is the only path for user actions (trades) and reads.
- User trades in multiplayer feed the engine's order-imbalance/impact model on the next tick (or intra-tick, configurable).

---

## 4. The Factor Model

There are **two independent factor stacks**: one produces **Intrinsic Value**, one produces **Price movement**. Both use the pattern *score each factor 0–100, multiply by a weight, sum.* All weights live in the database and are editable.

### 4.1 Intrinsic Value factors (top level)

From your sheet — weights sum to 1.00:

| Factor | Weight | Score range | Nature |
|---|---|---|---|
| Management Quality | 0.25 | 0–100 | Qualitative (seeded) |
| MOAT | 0.25 | 0–100 | Qualitative composite (sub-factored, see 4.3) |
| Financial Quality | 0.20 | 0–100 | **Quantitative composite** computed from statements (see 4.4) |
| Free Cash Flow Quality | 0.10 | 0–100 | Quantitative (from cash-flow statement) |
| Growth Potential | 0.20 | 0–100 | Forward-looking (seeded + earnings-informed) |

**Intrinsic Score** = Σ(weight × factor score) → a 0–100 composite. This maps to a **Fair PE**, which × EPS gives **Intrinsic Value** (Section 6).

> **Optional industry tilt (recommended, off by default):** allow these top-level weights to be overridden per industry (e.g., Growth weighted higher for IT, MOAT higher for FMCG). Store as an `industry_factor_weights` override; fall back to the global defaults above.

### 4.2 Price Driver factors

From your sheet — weights sum to 1.00:

| Driver | Weight | Range | Meaning |
|---|---|---|---|
| Value Opportunity | 0.20 | signed | How far price is from IV — the mean-reversion pull. |
| Quarterly Earnings Surprise | 0.15 | signed % | Actual vs consensus EPS beat/miss. |
| News Severity | 0.15 | −100…100 | Sentiment × severity of news, decays over days. |
| Economic Outlook | 0.10 | −100…100 | Market cycle phase (boom/recession). |
| Guidance | 0.15 | Raised/Maintained/Cut | Management's forward guidance jump. |
| Technical Momentum | 0.10 | −100…100 | Recent price trend / moving-average signal. |
| Institutional Buying | 0.15 | −100…100 | Net institutional flow → also feeds demand/supply. |

**Price pressure** = Σ(weight × normalized driver) → drives the daily expected return (Section 6.H).

### 4.3 MOAT sub-factors (qualitative — moved here from Financial Quality)

MOAT is heavily weighted (0.25) and now gets its own breakdown. These are **assigned at seeding (0–100)** because they can't be computed from financial statements. Sub-weights sum to 1.00 (defaults; industry-overridable):

| MOAT sub-factor | Default weight | Notes |
|---|---|---|
| Market Share | 0.18 | Competitive position/scale. |
| Brand Strength | 0.15 | Pricing power from brand. |
| Customer Loyalty / Switching Costs | 0.15 | Stickiness, retention. |
| Cost Advantage | 0.12 | Structural low-cost position. |
| Network Effects | 0.10 | Value rises with users (esp. tech/telecom). |
| Intangibles / Patents / IP | 0.10 | Legal moat (esp. pharma). |
| Innovation / R&D intensity | 0.10 | Pipeline / product velocity. |
| Competitive Intensity (inverse) | 0.05 | High rivalry = low score. |
| Geographic Diversification | 0.05 | Revenue resilience/spread. |

MOAT score = Σ(sub-weight × sub-score). *(Innovation, Market Share, Brand, etc. are also surfaced as standalone company attributes — see Section 5 — but they are scored **once** and consumed by MOAT to avoid double-counting.)*

### 4.4 Financial Quality sub-factor model (quantitative, statement-derived)

**Principle:** every Financial Quality sub-factor is (a) computable from the generated three financial statements, and (b) scored **cross-sectionally** — each company's raw metric is ranked against the whole universe (percentile → 0–100), so scores are relative. Then the sub-scores are combined with **industry-specific weights** (a construction firm weights solvency/liquidity higher; a software firm weights profitability higher).

**Sub-factors, grouped into 5 pillars:**

| Pillar | Sub-factor | Raw metric (from statements) | Direction |
|---|---|---|---|
| **Profitability** | Operating Margin | EBIT / Revenue | higher better |
| | ROIC | NOPAT / Invested Capital | higher better |
| | ROE | Net Profit / Shareholders' Equity | higher better |
| **Efficiency** | Asset Turnover | Revenue / Total Assets | higher better |
| | Cash Conversion Cycle | DSO + DIO − DPO | **lower** better |
| **Leverage & Solvency** | Net Debt / EBITDA | (Debt − Cash) / EBITDA | **lower** better |
| | Interest Coverage | EBIT / Interest Expense | higher better |
| | Current Ratio (financial_liquidity) | Current Assets / Current Liabilities | higher better |
| **Stability** | Earnings Stability | inverse of stdev of historical EPS/earnings | higher better |
| | Revenue Consistency | inverse of volatility of historical revenue growth | higher better |
| **Earnings Quality** | Accruals Ratio | (Net Income − Operating Cash Flow) / Total Assets | **lower** better (red-flag) |
| | Payout Sustainability | dividends / (FCF or net income) sanity band | mid-band best |

**Scoring pipeline (per fiscal period):**
1. Compute raw metric for every company from its statements.
2. For "lower better" metrics, negate before ranking.
3. Convert to a 0–100 sub-score via **cross-sectional percentile** (or winsorized z-score mapped through the normal CDF): `subscore = 100 × percentile_rank(metric across universe)`.
4. **Financial Quality score** = Σ over sub-factors of `industry_weight × subscore`.

**Industry weighting via pillar weights.** Each industry has a 5-pillar weight vector (sums to 1.00). Within a pillar, sub-factors split the pillar weight equally by default (overridable). So a sub-factor's effective weight = `pillar_weight × (1 / n_subfactors_in_pillar)`.

**Pillar-weight matrix for the 15 industries** (each row sums to 1.00):

| Industry | Profitability | Efficiency | Leverage/Solvency | Stability | Earnings Quality |
|---|---|---|---|---|---|
| Banking & Financial Services* | 0.25 | 0.10 | 0.35 | 0.20 | 0.10 |
| Information Technology / Software | 0.35 | 0.15 | 0.10 | 0.20 | 0.20 |
| Pharmaceuticals & Healthcare | 0.30 | 0.10 | 0.15 | 0.25 | 0.20 |
| FMCG / Consumer Staples | 0.25 | 0.20 | 0.15 | 0.25 | 0.15 |
| Automobiles & Auto Components | 0.20 | 0.25 | 0.25 | 0.15 | 0.15 |
| Energy (Oil & Gas) | 0.20 | 0.15 | 0.30 | 0.15 | 0.20 |
| Utilities (Power/Gas/Water) | 0.20 | 0.10 | 0.25 | 0.30 | 0.15 |
| Metals & Mining | 0.20 | 0.20 | 0.30 | 0.15 | 0.15 |
| Construction & Infrastructure | 0.15 | 0.25 | 0.35 | 0.10 | 0.15 |
| Real Estate | 0.15 | 0.15 | 0.40 | 0.15 | 0.15 |
| Telecommunications | 0.20 | 0.15 | 0.30 | 0.20 | 0.15 |
| Retail & E-commerce | 0.20 | 0.30 | 0.15 | 0.20 | 0.15 |
| Industrials & Capital Goods | 0.25 | 0.25 | 0.20 | 0.15 | 0.15 |
| Chemicals | 0.25 | 0.20 | 0.20 | 0.20 | 0.15 |
| Media & Entertainment | 0.25 | 0.15 | 0.15 | 0.20 | 0.25 |

> **\*Banking/Financials caveat:** for banks, `Net Debt/EBITDA`, `Asset Turnover`, and `Current Ratio` are not meaningful (deposits are liabilities-as-raw-material). Give financials a **specialized sub-factor set** — e.g., Net Interest Margin, Capital Adequacy (CAR/Tier-1 proxy), Gross NPA ratio (asset quality, lower better), Cost-to-Income, ROA — mapped into the same 5 pillars. Store this as an alternate `subfactor_set` keyed to the industry so the engine picks the right metric list per company.

**Design note:** the whole FQ model is table-driven. `financial_quality_subfactors` defines the metric list + formula reference; `industry_pillar_weights` defines the weights. Change weights in the DB → FQ recomputes on next fundamentals refresh. No code change.

---

## 5. Complete Company Attribute List

Every company carries these. **Static/reference** attributes are set at seeding; **derived** attributes are computed by the engine; **time-series** attributes live in history tables.

**Identity (static):** `name`, `ticker`, `industry_id`, `logo_url`, `description`, `shares_outstanding`, `free_float_pct`, `founding_sim_date`.

**Fundamentals (time-series, per fiscal period):** full **Income Statement**, **Balance Sheet**, and **Cash Flow Statement** line items (Section 7.4). From these: `revenue`, `net_profit`, `total_debt`, `cash`, `EPS`, `EBITDA`, `free_cash_flow`, etc.

**Intrinsic factor scores (derived, per period, 0–100):** `management_quality`, `moat_score`, `financial_quality`, `fcf_quality`, `growth_potential`, and the composite `intrinsic_score`.

**MOAT sub-scores (seeded, 0–100):** `market_share`, `brand_strength`, `customer_loyalty`, `cost_advantage`, `network_effects`, `intangibles`, `innovation`, `competitive_intensity`, `geographic_diversification`. Plus `governance` and `esg` as management/quality inputs.

**Valuation (derived):** `fair_pe`, `intrinsic_value` (per share), `current_price`.

**Market/trading (derived):** `market_liquidity_score` (tradability, 0–100 — distinct from financial_liquidity), `volatility` (daily σ), `beta_market`, `beta_sector`, `market_cap`.

> **Naming rule (do not skip):** `financial_liquidity` = current ratio / solvency (a Financial Quality input). `market_liquidity_score` = tradability (a price/impact input). They are different columns. Never collapse them.

---

## 6. The Mathematical Engine (all formulas)

> This section is the specification the engine must implement. Notation: subscript `i` = company, `t` = sim-day. All tunable coefficients (κ, θ, λ, k_*, M_min, M_max, k_M, c_M, NeutralIndustryPEG per industry, …) live in a `config` / `parameters` table so they can be calibrated without code changes. Every stochastic draw uses a **seeded RNG stored per timeline per tick** for reproducibility.

### 6.A — Fundamentals → sub-factor scores (cross-sectional)
For each Financial Quality metric `m` and company `i`, with raw value `x_{i,m}` (negate if "lower is better"):
```
subscore_{i,m} = 100 × percentile_rank( x_{i,m} ; {x_{j,m} : all j in universe} )
```
Equivalent z-score form (winsorize at ±3σ first): `subscore = 100 × Φ((x − μ_m)/σ_m)`, where Φ = standard normal CDF.

### 6.B — Financial Quality composite
```
FQ_i = Σ_m  w^{ind(i)}_m × subscore_{i,m}
```
where `w^{ind(i)}_m = pillar_weight(industry, pillar(m)) × (1 / n_subfactors_in_pillar(m))`, and Σ_m w = 1.

### 6.C — Intrinsic Score (0–100)
```
IntrinsicScore_i = 0.25·Mgmt_i + 0.25·MOAT_i + 0.20·FQ_i + 0.10·FCFQ_i + 0.20·Growth_i
```
(top-level weights from the DB; MOAT_i = Σ moat sub-weights × moat sub-scores.)

### 6.D — Fair P/E (PEG-based valuation)
**Revised 2026-07-10 — supersedes the pure P/E × Q(S) approach from the 2026-07-07/09 revisions.** Market valuation multiples no longer enter the intrinsic-value calculation at all, directly or indirectly. Fair P/E is built up from an industry-neutral **PEG** (P/E-to-Growth) ratio using only (a) business quality and (b) the company's own estimated sustainable long-term growth rate:

```
S = Financial Quality Score (0-100) = IntrinsicScore (Section 6.C — already combines
    growth, moat, financial quality, management, capital allocation, and cash flow
    quality, so none of those are re-applied here)

M(S) = M_min + (M_max − M_min) / (1 + e^(−k·(S − c)))              // Quality Multiplier
FairPEG_i = NeutralIndustryPEG_ind × M(S_i)                        // Fair PEG
LongTermGrowthRate_i = company-specific estimated sustainable      // % number, e.g. 18.0 for 18%
    annual EPS growth over the next ~5-10 years (financials +
    industry-derived where possible; growth_score_to_rate() as a
    configurable fallback mapping from the growth_potential score)
FairPE_i = FairPEG_i × LongTermGrowthRate_i
IV_i     = EPS_i × FairPE_i
```

**`NeutralIndustryPEG`** — the long-term fair PEG a normal, ~S=60 business deserves in its industry. A configurable per-industry constant (seeded in `config_parameters` as `neutral_industry_peg`, scope=`industry`), **not** a market-observed average PEG. Initial values (Section 4.4 industries):

| Industry | Neutral PEG | Industry | Neutral PEG |
|---|---|---|---|
| Banking & Financial Services | 0.90 | Real Estate | 0.80 |
| IT Services | 1.40 | Telecommunications | 1.00 |
| Pharma & Healthcare | 1.50 | Retail & E-commerce | 1.40 |
| FMCG | 1.60 | Industrials & Capital Goods | 1.10 |
| Automobiles & Components | 1.00 | Chemicals | 1.20 |
| Energy (Oil & Gas) | 0.70 | Media & Entertainment | 1.20 |
| Utilities (Power/Gas/Water) | 0.80 | | |
| Metals & Mining | 0.60 | | |
| Construction & Infrastructure | 0.90 | | |

**`M(S)` — Quality Multiplier.** Default parameters: `M_min=0.6`, `M_max=2.0`, `k=0.11`, `c=60`:
```
M(S) = 0.6 + 1.4 / (1 + e^(−0.11·(S − 60)))
```
- S in [0,20]: multiplier barely moves — still fundamentally weak businesses.
- S in [20,70]: rapid re-rating — the business is becoming clearly investable.
- S in [70,100]: continues earning a premium but at a decelerating rate — the market already prices it as high quality.
- Range ≈ 0.6 to 2.0.

**`LongTermGrowthRate`** — the company's own estimated sustainable annual EPS growth over roughly the next 5–10 years (entered as a plain percentage number, e.g. `18.0` for 18%/yr), reflecting durable business growth rather than one-off or unusually high growth years. Prefer deriving this directly from a company's trailing fundamentals and industry context; `growth_score_to_rate()` (linear map of the 0–100 `growth_potential` score to a rate, default range 2%→60%) is a configurable fallback where a company-specific estimate isn't available.

**Under no circumstances does current market valuation directly influence the intrinsic value calculation.** Market price is computed entirely separately (Sections 6.G–6.M — supply/demand, news, macro, sentiment, momentum) and is allowed to diverge from intrinsic value; that divergence is the point of the simulation (Section 6.J mean-reversion).

**All parameters configurable** — `NeutralIndustryPEG` per industry, and the logistic curve's `M_min`/`M_max`/`k`/`c`, live in `config_parameters` (industry-scoped and global respectively) so they can be calibrated against historical market data later without changing the engine code.

### 6.E — Intrinsic Value per share
```
EPS_i  = NetProfit_i / SharesOutstanding_i          // trailing (or forward) from Income Statement
IV_i   = FairPE_i × EPS_i
```
IV is (re)computed whenever new fundamentals post (quarterly) or a structural event changes a factor score.

### 6.F — Intrinsic Value movement (between updates)
IV is the slow anchor. Between fundamental refreshes it drifts with expected growth:
```
g_daily_i = ExpectedAnnualGrowth(Growth_i) / TradingDaysPerYear
IV_{i,t+1} = IV_{i,t} × (1 + g_daily_i)
```
On earnings dates: `IV` jumps to `FairPE × new EPS`. On structural events (guidance change, moat/management event, sector shock): affected factor scores update → recompute `FairPE` and `IV`. IV never moves on pure noise.

### 6.G — Price Driver values (daily, normalized to [−1, +1])
Each of the 7 drivers is mapped to a signed, unit-scaled value `d_k`:
1. **Value Opportunity** `d_VO = clamp( (IV_i − P_{i,t}) / P_{i,t} , −1, +1 )` → positive when undervalued (upward pull).
2. **Earnings Surprise** `d_ES = clamp( (ActualEPS − ConsensusEPS)/|ConsensusEPS| , −1, +1 )` on earnings day, then exponentially decays over ~5–10 days.
3. **News Severity** `d_NS = sentiment × severity/100 ∈ [−1,1]`, decays each day by factor `ρ_news`.
4. **Economic Outlook** `d_EO ∈ [−1,1]` from the current market-cycle phase (Section 6.I).
5. **Guidance** `d_G` = {Raised → +g, Maintained → 0, Cut → −g}, a jump on guidance day, decays.
6. **Technical Momentum** `d_TM = tanh( k_m × (P_{i,t}/MA_n(i,t) − 1) ) ∈ (−1,1)` (n-day moving average; or short-MA/long-MA crossover).
7. **Institutional Buying** `d_IB ∈ [−1,1]` = net institutional flow signal (also used in demand/supply, 6.K).

### 6.H — Composite price pressure → expected daily return
```
PricePressure_i = 0.20·d_VO + 0.15·d_ES + 0.15·d_NS + 0.10·d_EO
                + 0.15·d_G  + 0.10·d_TM + 0.15·d_IB
μ_i,t = k_drift × PricePressure_i          // expected (deterministic) daily return
```
This composite already contains **mean reversion** (via d_VO) and **momentum** (via d_TM). `k_drift` scales pressure into a realistic daily-return magnitude (e.g., 0.02–0.05).

### 6.I — Market & sector correlation (factor structure)
Prices co-move through shared factors. Daily return decomposes as:
```
r_i,t = μ_i,t + β^m_i · F^m_t + β^s_{i} · F^s_{sector(i),t} + σ_i · ε_i,t
```
- `F^m_t` = **market factor** return for the day, driven by the economic-cycle state + a market-wide shock: `F^m_t = a·CycleSignal_t + σ_m·η_t`.
- `F^s_{sector,t}` = **sector factor** shock shared by all companies in that industry (sector news/commodity moves).
- `β^m_i, β^s_i` = company loadings (betas) on market and sector.
- `ε_i,t ~ N(0,1)` idiosyncratic; `σ_i` = company daily volatility.
This yields realistic **intra-sector correlation** and market-wide co-movement automatically.

**Company volatility:**
```
σ_i = σ_{ind} × f_size(market_cap_i) × f_lev(leverage_i)
```
smaller caps and higher leverage → higher σ (`f_size` decreasing in cap, `f_lev` increasing in Net Debt/EBITDA).

### 6.J — Mean-reversion backbone (the tether to IV) — rigorous form
The *guarantee* that price oscillates around IV is an **Ornstein-Uhlenbeck process on the log valuation gap**. Let `y_{i,t} = ln(P_{i,t}/IV_{i,t})` (0 = fairly valued):
```
y_{i,t+1} = y_{i,t} − θ_i · y_{i,t} + PricePressure_i + β^m_i F^m_t + β^s_i F^s_t + σ_i ε_i,t
P_{i,t+1} = IV_{i,t+1} · exp( y_{i,t+1} )
```
- `θ_i` = mean-reversion speed (how fast over/undervaluation corrects; higher for stable industries like Utilities, lower for speculative ones). Typical `θ ∈ [0.02, 0.1]` per day.
- The `d_VO` term and `−θ·y` both pull toward IV; keep **one** as the primary tether (recommended: use `−θ·y` as the structural pull and treat `d_VO` as *additional discretionary* value-buying pressure, or fold VO into θ). Document the choice in `config`.
- Momentum (`d_TM`) can cause temporary overshoot before reversion — realistic.
- **This single equation is the core of the whole simulation.** IV is the anchor; `y` is the transient gap that mean-reverts while being buffeted by drivers, sector, market, and noise.

Apply a floor `P ≥ P_min` and an optional per-day **circuit breaker** `|r_i,t| ≤ r_cap` (e.g., ±20%).

### 6.K — Demand & Supply (order imbalance)
In the factor model, demand/supply are **derived** from net pressure (and, in multiplayer, augmented by real user orders):
```
signal_i = PricePressure_i + β^s_i F^s_t + β^m_i F^m_t + d_IB
Demand_i,t = BaseVolume_i × (1 + max(0, +signal_i)·k_flow) + UserBuyQty_i,t
Supply_i,t = BaseVolume_i × (1 + max(0, −signal_i)·k_flow) + UserSellQty_i,t
OrderImbalance_i,t = Demand_i,t − Supply_i,t
```
Positive imbalance = net buying = upward price pressure (consistent with `y` moving up).

### 6.L — Volume
```
Volume_i,t = BaseFloatTurnover_i × (1 + a·|r_i,t| + b·|d_NS| + c·EarningsDayFlag) × LogNormalNoise
BaseFloatTurnover_i ∝ free_float × market_liquidity_score_i
```
Volume spikes on big moves, heavy news, and earnings days.

### 6.M — Market liquidity & price impact (multiplayer trades)
```
market_liquidity_score_i ∈ [0,100]  from free_float, market_cap, avg_volume
spread_i = spread_min + spread_k × (1 − market_liquidity_score_i/100)      // bid-ask
```
A user trade of signed quantity `Q` (buy +, sell −) moves price (linear/Kyle-λ impact):
```
ΔP_impact = λ_i × ( Q / ADV_i ),     λ_i ∝ 1 / market_liquidity_score_i
```
Large orders in **illiquid** names move price more. Execution price = mid ± half-spread + impact. In single-player mode, set `λ = 0` (user is a price-taker).

### 6.N — News impact (event → drivers → price)
An event has an `effect_profile` (JSON) specifying which factor scores and/or drivers it hits, by how much, and for how long:
```
d_NS_{i,t} = Σ_active_events  sentiment_e × severity_e/100 × decay(ρ_e, t − t_e)
```
Structural events additionally modify factor scores (e.g., "patent granted" → +Innovation/MOAT → higher IV). News severity decays; structural changes persist until reversed.

### 6.O — Engine output (per tick, per company)
Each tick the engine writes: `close price`, `open/high/low` (intraday synthesized around the close move), `IV`, `volume`, `order_imbalance`, updated driver scores, and any news items. These populate the time-series tables that power charts, portfolios, and analytics.

**Tick pseudocode (vectorized over all 150 companies):**
```
for each sim-day t:
    1. advance economic cycle state → F^m, EO
    2. draw sector shocks F^s per industry
    3. if fiscal-period boundary: post new statements → recompute FQ, factor scores, FairPE, IV
    4. else: drift IV by g_daily; apply any structural event effects to scores/IV
    5. compute the 7 driver values d_k per company (decay old news/surprises)
    6. PricePressure = weighted sum of drivers
    7. update y (OU) with pressure + betas·factors + σ·ε   → new price
    8. compute volume, demand/supply/imbalance
    9. apply queued user trades (impact) [multiplayer]
   10. write OHLCV + IV + drivers + news to time-series tables
   11. mark-to-market all portfolios
```

---

## 7. Database Design (the most important section)

> The database is the backbone. Get this right and everything else is plumbing. Guiding principles:
> 1. **Schema-first, data-later.** Create the full structure with formulas/weights as *data*, then plug in the 150 companies' numbers later. Nothing about a specific company is hardcoded.
> 2. **Separate the three data classes:** *reference/static* (companies, industries, factor definitions, weights), *dynamic time-series* (prices, volume, driver scores, news), and *transactional* (users, orders, portfolios). They have different access patterns, sizes, and lifecycles.
> 3. **Config as data.** Every weight, coefficient, and formula parameter lives in tables — no magic numbers in code.
> 4. **Timeline-aware.** Every time-series row is keyed by a `timeline_id` so the Future Lab can branch alternate futures without duplicating the whole DB (Section 7.7).
> 5. **Reproducible.** Store the RNG seed per timeline per tick; the entire market is replayable.

### 7.1 Entity map

```
industries ──< companies ──< financial_statements (income/balance/cashflow)
     │             │      ├──< company_factor_scores        (5 top-level, per period)
     │             │      ├──< moat_subscores               (seeded)
     │             │      ├──< financial_quality_subscores  (per period, computed)
     │             │      ├──< price_history   (time-series, per timeline)   [hypertable]
     │             │      ├──< price_driver_scores (time-series, per timeline)
     │             │      └──< news_feed
     ├──< industry_pillar_weights          (FQ weights per industry)
     └──< industry_factor_weights (opt.)   (top-level weight overrides)

factor_definitions            (defines every factor/sub-factor + formula ref + direction)
config_parameters             (all engine coefficients: κ, θ, λ, M_min/M_max/k_M/c_M, NeutralIndustryPEG, k_drift, …)
market_events ──< event_instances ──> (company | industry | market)
news_templates ──< news_feed
economic_cycle_state          (time-series, per timeline)
simulation_state / timelines  (the clock + branch registry)

users ──< portfolios ──< holdings
                    └──< transactions (orders/fills)
users ──< watchlists, ──< notifications
leaderboard (view/materialized)
```

### 7.2 Reference / static tables

**`industries`**
| column | type | notes |
|---|---|---|
| id | PK | |
| name | text | e.g., "Construction & Infrastructure" |
| description | text | |
| baseline_pe | numeric | `PE0_ind` |
| pe_min, pe_max | numeric | clamp bounds |
| base_volatility | numeric | `σ_ind` |
| cycle_sensitivity | numeric | how much the sector reacts to economic cycle |
| sector_beta_default | numeric | default `β^s` |
| subfactor_set | text/enum | `standard` or `financials` (banks use special metric list) |

**`companies`** (static identity + denormalized "latest" for fast reads)
| column | type | notes |
|---|---|---|
| id | PK | |
| name, ticker | text (ticker unique) | |
| industry_id | FK → industries | |
| logo_url, description | text | placeholder-able |
| shares_outstanding | bigint | |
| free_float_pct | numeric | |
| beta_market, beta_sector | numeric | loadings |
| **denormalized latest:** current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, volatility, market_liquidity_score | numeric | source of truth is the time-series tables; these are cached for O(1) reads and updated each tick |

> **Why denormalize latest values onto `companies`?** The market grid shows 150 rows every render; you don't want a MAX(sim_date) subquery per company each time. Write-through on each tick, read cheaply.

**`factor_definitions`** — makes the whole model data-driven
| column | notes |
|---|---|
| id, key (e.g., `roic`), display_name | |
| factor_type | `intrinsic_top` \| `moat_sub` \| `fq_sub` \| `price_driver` |
| pillar | for FQ sub-factors (profitability/efficiency/…) |
| direction | `higher_better` \| `lower_better` \| `mid_band` |
| formula_ref | string key the engine maps to a metric function |
| default_weight | numeric |
| value_range | e.g., `0..100`, `-100..100`, `signed` |

**`industry_pillar_weights`** — the FQ weight matrix from Section 4.4
`(industry_id, pillar, weight)` — enforce Σ weight per industry = 1.0 (DB check or app-level validation).

**`industry_factor_weights`** *(optional)* — top-level weight overrides per industry; fallback to global defaults in `config_parameters`.

**`config_parameters`** — every tunable coefficient
`(key, value, scope [global|industry|company], scope_id, description)`. Holds κ_drift, θ (or per-industry), λ, the logistic quality-multiplier params (M_min, M_max, k_M, c_M — Section 6.D), NeutralIndustryPEG per industry, growth-rate mapping bounds, ρ_news, circuit-breaker cap, trading_days_per_year, quarter_length, starting_cash, etc. **The engine reads all coefficients from here.**

### 7.3 Factor-score tables (derived, versioned by fiscal period)

**`company_factor_scores`** — the 5 top-level scores, per period (so IV is reproducible & auditable)
`(company_id, fiscal_period, management_quality, moat_score, financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, computed_at)`

**`moat_subscores`** — seeded qualitative 0–100 values
`(company_id, subfactor_key, score)` — consumed to compute `moat_score`.

**`financial_quality_subscores`** — computed per period
`(company_id, fiscal_period, subfactor_key, raw_metric_value, peer_percentile, subscore, applied_weight)` — keep the raw value AND the percentile AND the weight so you can explain "why is FQ 72?" in the UI and for debugging.

### 7.4 Financial statements (per company, per fiscal period)

Model the **three statements** as three tables sharing `(company_id, fiscal_period)`. Store every line item you'll need for the FQ metrics + FCF quality + display. Use `fiscal_period` as a first-class dimension (e.g., `2027Q1`).

**`income_statement`**: revenue, cogs, gross_profit, operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, tax, net_profit, eps, shares_diluted.

**`balance_sheet`**: cash_and_equivalents, receivables, inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, invested_capital.

**`cash_flow_statement`**: operating_cash_flow, capex, free_cash_flow, investing_cash_flow, financing_cash_flow, dividends_paid, buybacks, net_change_in_cash.

> **Plug-and-play:** these tables are created empty. A seed script (Phase 3) fills them from your generated placeholder company data (CSV/JSON). The engine computes all FQ metrics, FCF quality, EPS, and IV *from these rows*. Change a company's numbers → its IV recomputes on next refresh. Nothing is hardcoded.

Optionally add `consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue)` to drive the Earnings Surprise driver.

### 7.5 Time-series tables (the biggest data — use TimescaleDB hypertables)

**`price_history`** — OHLCV + IV, one row per company per sim-day **per timeline**
`(timeline_id, company_id, sim_date, open, high, low, close, volume, intrinsic_value, order_imbalance)`
- **Primary size driver:** 150 companies × thousands of sim-days × multiple timelines. Make this a **hypertable** partitioned on `sim_date` (and space-partitioned by `company_id` if huge).
- Index `(company_id, timeline_id, sim_date)` for chart queries; append-only, immutable once written.
- Continuous aggregates (weekly/monthly OHLC) for zoomed-out charts.

**`price_driver_scores`** — per company per sim-day per timeline
`(timeline_id, company_id, sim_date, driver_key, value, weight, contribution)` — powers the "why did this move?" breakdown UI.

**`economic_cycle_state`** — per sim-day per timeline
`(timeline_id, sim_date, cycle_phase [expansion/peak/contraction/trough], market_factor_return, gdp_growth, interest_rate, market_sentiment)`.

### 7.6 Events & news

**`market_events`** (catalog of ~150+ event types)
`(id, name, category, scope [company|industry|market], severity_range, sentiment, effect_profile JSONB, duration_days, decay_rate, probability_weight)`.
- `effect_profile` (JSONB) is the key: it declares *which drivers/factor scores this event modifies and by how much*, e.g.
  `{"drivers": {"news_severity": -60, "guidance": -1}, "factor_scores": {"moat_score": -5}, "iv_recompute": true}`.
- This makes events **data-driven**: add a new event type = insert a row, no code change.

**`event_instances`** — a fired event
`(id, event_id, timeline_id, scope_ref [company/industry/market id], sim_date, resolved_severity, applied_effects JSONB, expires_on)`.

**`news_templates`**
`(id, category, template_text with {placeholders}, sentiment, severity_band, linked_event_category, linked_driver)`.

**`news_feed`** — generated, user-facing
`(id, timeline_id, sim_date, company_id/industry_id/null, headline, body, sentiment, severity, source_event_instance_id)`.

### 7.7 Timelines & the Future Lab (critical DB nuance)

The Future Lab lets a user **fork the market at a date and run alternate futures** (e.g., "what if I re-run from 2028Q1 with a recession?"). Do **not** clone the database. Instead:

**`timelines`**
`(id, name, parent_timeline_id, branch_point_sim_date, owner_user_id, rng_seed, is_live, created_at)`.
- `is_live = true` for the single canonical market. All others are branches.
- A branch **inherits** all history from its parent up to `branch_point_sim_date` and only stores *new* rows (with its own `timeline_id`) after that point. Reads use: "rows for this timeline after branch point, else fall back to parent." (Implement via a view or a resolver in the data layer; recurse up the parent chain.)
- `rng_seed` makes each timeline deterministic and replayable.

**`simulation_state`**
`(timeline_id, current_sim_date, tick_count, is_running, config_snapshot_id, updated_at)` — the clock, one row per timeline.

This design gives you branching futures at the cost of only the *incremental* rows per branch — cheap and clean.

### 7.8 Users, portfolios, trading

**`users`** `(id, email, hashed_password, display_name, role [user|admin], starting_cash, created_at)`.
**`portfolios`** `(id, user_id, timeline_id, cash_balance, created_at)` — a user has one portfolio **per timeline** they participate in.
**`holdings`** `(portfolio_id, company_id, quantity, avg_cost_basis)` — current positions.
**`transactions`** `(id, portfolio_id, company_id, sim_date, side [buy|sell], quantity, price, fees, impact_applied, realized_pnl)` — immutable ledger; positions/PNL are derived from it.
**`watchlists`** `(user_id, company_id)`.
**`notifications`** `(id, user_id, type, payload JSONB, sim_date, read_at)` — price alerts, earnings, big news, margin events.
**`leaderboard`** — a **materialized view** ranking portfolios by total value / return, refreshed each tick (multiplayer).

### 7.9 Indexing, integrity & performance checklist
- FKs everywhere with `ON DELETE` rules; `ticker` unique; `(company_id, fiscal_period)` unique on statement tables.
- Hypertable/composite index `(company_id, timeline_id, sim_date)` on `price_history`; BRIN index on `sim_date` for range scans.
- CHECK constraints: weights in `[0,1]`, scores in valid ranges, `quantity ≥ 0`.
- Enforce "weights per industry sum to 1.0" via a validation on write (trigger or app service).
- Cache latest quotes in **Redis** (`quote:{timeline}:{ticker}`) updated each tick; DB is source of truth.
- Use continuous aggregates for long-range charts; never scan raw ticks for a 5-year view.
- Migrations via **Alembic**; seed scripts idempotent so you can re-plug company data anytime.

### 7.10 Seeding order (matches Phase 3)
1. `config_parameters`, `factor_definitions`, `industry_pillar_weights`.
2. `industries` (15) with baseline PEs, volatilities, cycle sensitivity.
3. `companies` (150) identity + shares/float + betas.
4. `income_statement` / `balance_sheet` / `cash_flow_statement` (placeholder fundamentals).
5. `moat_subscores`, management/growth/fcf seed scores.
6. Run the engine once → compute FQ, factor scores, FairPE, IV, initial price → write first `price_history` row on the `live` timeline.
7. `market_events` catalog + `news_templates`.
8. Demo `users` + `portfolios` + sample `transactions` for testing.

---

## 8. Simulation Engine (implementation notes)

- **Language:** Python package `/engine`, importable by both the API (for on-demand ticks) and the job worker (for scheduled ticks).
- **Vectorized:** load all 150 companies into NumPy arrays; compute a tick as matrix ops (driver matrix × weight vector, factor-shock vectors, OU update). A full tick should be milliseconds.
- **Deterministic:** seed `numpy.random.default_rng(timeline.rng_seed + tick_count)`. Same seed → same market. Store nothing stochastic that isn't reproducible from seed + inputs.
- **Idempotent per (timeline, sim_date):** re-running a tick that already exists is a no-op or a documented overwrite (needed for Future Lab replays).
- **Fundamentals refresh** runs on quarter boundaries: regenerate/advance statements → recompute cross-sectional FQ scores (needs the whole universe at once) → new FairPE → new IV.
- **Trade settlement:** in multiplayer, queued orders settle at tick start with impact (6.M); in single-player, fills are immediate at quoted price.
- **Config-driven:** never hardcode a coefficient; read from `config_parameters`.

**Engine module layout:** `fundamentals.py` (statements → metrics), `scoring.py` (cross-sectional FQ, factor composites), `valuation.py` (FairPE, IV), `drivers.py` (7 drivers), `market.py` (OU + factor correlation + price update), `liquidity.py` (volume, spread, impact), `events.py` (event/news application), `tick.py` (orchestrator).

---

## 9. Backend APIs (REST, FastAPI)

**Market data (read):**
- `GET /market` — grid of all companies (latest price, IV, day change, sector).
- `GET /companies/{ticker}` — profile + latest fundamentals + factor scores.
- `GET /companies/{ticker}/history?timeline&from&to&interval` — OHLCV for charts.
- `GET /companies/{ticker}/drivers?sim_date` — the 7-driver breakdown ("why it moved").
- `GET /companies/{ticker}/financials?period` — statements.
- `GET /companies/{ticker}/valuation` — IV, FairPE, factor decomposition.
- `GET /news?timeline&sim_date&company` — news feed.
- `GET /market/cycle?timeline` — economic-cycle state.

**Trading & portfolio (auth):**
- `POST /orders` — `{ticker, side, quantity}` → validates cash/holdings, applies impact, writes transaction.
- `GET /portfolio?timeline` — holdings, cash, mark-to-market value, PnL.
- `GET /portfolio/analytics` — returns, allocation, risk metrics (Section 12).
- `GET /transactions` — ledger.
- `GET/POST/DELETE /watchlist`.
- `GET /leaderboard?timeline`.

**Simulation control (admin / user for own branch):**
- `POST /sim/advance?timeline&days` — tick forward N sim-days.
- `POST /sim/timelines` — create a Future Lab branch `{parent, branch_point, scenario_overrides}`.
- `GET /sim/timelines` — list branches.
- `POST /admin/events` — inject an event; `PUT /admin/config` — tune coefficients.

**Conventions:** JWT auth, pagination on list endpoints, OpenAPI auto-docs, generate TS types for the frontend from the schema.

---

## 10. Frontend (Next.js)

**Core screens:**
1. **Market Overview** — sortable/filterable grid of all 150 tickers (price, day %, sector, IV vs price gap), sector heatmap.
2. **Company / Stock Detail** — candlestick chart with IV overlay line, driver breakdown, financial statements, factor-score radar, buy/sell panel.
3. **Portfolio** — holdings table, cash, total value, PnL, allocation donut, performance line vs market index.
4. **News Feed** — chronological, filterable by company/sector/severity, linked to the events that caused moves.
5. **Future Lab** — pick branch point + scenario overrides, fast-forward days, compare timelines side by side.
6. **Leaderboard** (multiplayer).
7. **Admin** — seed/plug company data, tune config, inject events, control the clock.

**Charts:** Lightweight-Charts for OHLC + IV overlay; Recharts/visx for analytics. Live update via polling or WebSocket after each tick.

**A "live artifact" option:** a self-contained status page (market grid / portfolio) that re-pulls fresh data each open is a natural fit if you want a lightweight always-on view.

---

## 11. Future Lab (alternate-future simulation)

- **Branch** the `live` timeline at any past sim-date into a new `timeline` (Section 7.7) with optional **scenario overrides** (force a recession, spike a sector, change a company's guidance).
- **Fast-forward** N sim-days on the branch, re-running the engine deterministically from the stored seed.
- **Timeline Comparison** — overlay two or more timelines' price/portfolio paths on one chart to see "what if."
- Because branches store only incremental rows, you can spin up many cheaply.

---

## 12. Analytics & Graphs

- **Portfolio analytics:** total return, time-weighted return, realized/unrealized PnL, allocation by sector, exposure vs market, win rate, best/worst positions.
- **Risk:** portfolio volatility, beta, max drawdown, Sharpe (using the sim's risk-free from `economic_cycle_state`), value-at-risk (simple historical).
- **Per-stock:** IV-vs-price gap over time, driver-contribution stacked area, moving averages, volume profile.
- **Market:** breadth (advancers/decliners), sector performance, cycle-phase timeline.
- **Interactive graphs:** zoom/pan candlesticks, toggle IV overlay, hover tooltips with the day's driver breakdown.

---

## 13. Build Chronology (what to do, in order)

The phase model, sequenced into concrete steps. **Do them in this order** — each depends on the last.

**Phase 1 — Simulation Rulebook (design)**
1. Finalize the rulebook: this document's factor model + math engine + trading rules + event/cycle rules. *(Largely done here — treat Section 6 as the spec.)*

**Phase 2 — Fictional Economy (content, structure-first)**
2. Define the **15 industries** (Section 4.4) with baseline PE, volatility, cycle sensitivity, subfactor_set.
3. Create **150 companies** — identity + shares/float + betas (placeholder OK; structure must exist).
4. Assign company attributes (MOAT sub-scores, management/growth/fcf seeds).
5. Generate tickers (unique).
6. Write company descriptions.
7. Create logos/placeholders.
8. Build the **150+ market-events** catalog with `effect_profile`s.
9. Create news templates.

**Phase 3 — Database**
10. Implement the schema (Section 7) via Alembic migrations.
11. Seed reference/config/weights, then plug company + statement data (idempotent seeds).
12. Generate sample portfolios.
13. Generate testing data (a few sim-months of history via the engine).

**Phase 4 — Simulation Engine**
14. Build the engine modules (Section 8); unit-test each formula against hand-computed cases.

**Phase 5 — Backend APIs**
15. Build the REST API (Section 9) over the engine + DB.

**Phase 6 — Basic Frontend**
16. Integrate frontend with APIs — market grid, stock detail, buy/sell, portfolio.

**Phase 7–9 — Feature build-out & polish**
17. Portfolio Analytics UI. 18. Market Event UI. 19. News Feed UI. 20. Interactive Graphs. 21. Future Lab. 22. Timeline Comparison. 23. Notifications. 24. Animations & visual polish.

**Phase 10 — Testing & Deployment**
25. Engine unit tests, API integration tests, frontend E2E (Playwright), calibration pass (Section 15), then deploy.

> **Recommended earliest milestone:** Sections 6+7 (engine + DB) with placeholder data → a working "market that ticks" you can watch move, before any UI. Prove the math first.

---

## 14. Requirements Specification

**Functional**
- FR1 Compute IV per company from statements → factor scores → FairPE × EPS.
- FR2 Advance the market one sim-day per tick, updating price via the OU + factor + driver model.
- FR3 Fundamentals refresh quarterly; IV re-anchors.
- FR4 Generate events + news that move drivers/factor scores per `effect_profile`.
- FR5 Users buy/sell; positions, cash, and PnL update; multiplayer trades apply price impact.
- FR6 Charts show OHLCV + IV overlay + driver breakdown.
- FR7 Future Lab branches timelines and fast-forwards deterministically.
- FR8 Leaderboard ranks portfolios (multiplayer).
- FR9 Admin can plug company data, tune config, inject events, control the clock.

**Non-functional**
- NFR1 **Determinism/reproducibility** — same seed ⇒ same market.
- NFR2 **Plug-and-play** — no hardcoded company numbers or weights; all in DB.
- NFR3 **Performance** — a full 150-company tick in <1s; chart queries via aggregates.
- NFR4 **Scalability** — multiplayer via `timeline_id`/`user_id` scoping; hypertable for series.
- NFR5 **Auditability** — store raw metric, percentile, weight for every score; store per-tick seed.
- NFR6 **Testability** — every formula unit-tested; engine runnable headless.
- NFR7 **Security** — JWT auth, server-side trade validation, admin-gated controls.

---

## 15. Open Parameters to Calibrate (do this after the engine runs)

These have no single "correct" value — tune them so the simulated market *feels* real:
- `k_drift` (pressure → daily return scale), `θ` mean-reversion speed (per industry), `σ_ind` industry vols.
- `M_min`, `M_max`, `k_M` (steepness), `c_M` (inflection point) — the logistic quality-multiplier shape (Section 6.D); `NeutralIndustryPEG` per industry; growth-rate mapping bounds.
- News/surprise decay rates `ρ`, guidance jump size, circuit-breaker cap.
- Market/sector factor volatilities and default betas.
- Liquidity `λ` impact scale, spread parameters, starting cash.

Calibration method: run the engine for a few sim-years on placeholder data, then check that annualized vol, IV-price convergence time, max drawdowns, and sector correlations land in realistic ranges. Adjust coefficients in `config_parameters` — no code changes.

---

## 16. Immediate Next Actions
1. Approve/adjust the 15 industries and the FQ pillar-weight matrix (Section 4.4).
2. Approve the finalized Financial Quality sub-factor list (Section 4.4) and the MOAT sub-factor list (Section 4.3).
3. Approve the math engine (Section 6) — especially the OU-vs-Value-Opportunity mean-reversion choice (6.J).
4. Then start Phase 3: stand up the schema (Section 7) with config/weights, so company data can be plugged in.
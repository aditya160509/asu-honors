# Fictional Stock Market Simulation — Build Progress

> Tracks status against the Master Prompt & PRD, phase by phase. Location of all code: `stock-sim/` inside this repo (`asu-honors`).
> Last updated: 2026-07-11 (deep code review — duplication cleanup + 4 correctness fixes in the tick/quarterly-refresh pipeline; 313 tests pass).

---

## Status

| Phase | Description | Status |
|---|---|---|---|
| 1 | Simulation Rulebook (design) | ✅ Done |
| 2 | Fictional Economy (150 companies, 15 industries, events, news) | ✅ Done |
| 3 | Database (schema + migrations + seed data) | ✅ Done |
| 4 | Simulation Engine (Python/NumPy) | ✅ Done — full DB-to-engine orchestration loop, economic cycle, OHLC, events/news, PRD 6.L volume (LogNormalNoise/EarningsDayFlag), dynamic volatility recompute (σ_i = σ_ind×f_size×f_lev), structural events modify factor scores + IV recompute |
| 5 | Backend APIs (FastAPI) | ✅ Done — 23 endpoints across auth/market/trading/simulation/news/leaderboard/health, JWT + bcrypt, rate limiting, order execution with Kyle-lambda impact, `/portfolio/analytics` |
| 6 | Basic Frontend (Next.js) | ⬜ Not started (plan drafted: `docs/phase6-plan.md`) |
| 7–9 | Feature build-out (analytics, events UI, news feed, Future Lab, notifications, polish) | ⬜ Not started |
| 10 | Testing & Deployment | 🟡 Partial — **313 tests pass** (engine + orchestrator + API), no E2E/frontend tests, not deployed |

---

## Phase 1 — Simulation Rulebook ✅

- Factor model (Intrinsic Value + Price Drivers), MOAT sub-factors, Financial Quality sub-factor model, 15-industry pillar-weight matrix, and the full math engine (Section 6) are finalized in the PRD.
- **Open items:** Section 16's "Immediate Next Actions" — approval checkpoints, not build tasks.

## Phase 2 — Fictional Economy ✅

All completed as seed data in Phase 3:
- 15 industries defined with baseline PE, PE min/max, base volatility, cycle sensitivity, sector beta
- 150 companies (10 per industry) with tickers, shares outstanding, free float, betas
- MOAT sub-scores (1,350 records), management quality, growth potential, FCF quality seed scores
- 25 market event types with `effect_profile` JSON
- 15 news templates with template variables

## Phase 3 — Database ✅

**Schema (28 tables modeled in SQLAlchemy 2.0):**
- `reference.py` — Industry, Company, FactorDefinition, IndustryPillarWeight, IndustryFactorWeight, ConfigParameter
- `factor_scores.py` — CompanyFactorScore, MoatSubscore, FinancialQualitySubscore
- `financials.py` — IncomeStatement, BalanceSheet, CashFlowStatement, ConsensusEstimate
- `timeseries.py` — PriceHistory, PriceDriverScore, EconomicCycleState
- `events.py` — MarketEvent, EventInstance, NewsTemplate, NewsFeed
- `simulation.py` — Timeline, SimulationState
- `trading.py` — User, Portfolio, Holding, Transaction, Watchlist, Notification

**Infrastructure:**
- Alembic scaffolding (`alembic.ini`, `db/migrations/`) and initial migration creating all 28 tables
- Migration executed against Postgres (Docker, port 5432) — 28 tables + indexes/constraints verified
- 88 unit tests pass

**Seed data (all idempotent, run via `run_all.py`):**
| Script | Content | Count |
|--------|---------|-------|
| `seed_config.py` | Config parameters + factor definitions | 18 params + 33 factors |
| `seed_industries.py` | Industries + pillar weights | 15 industries + 75 pillar weights |
| `seed_companies.py` | Companies + moat subscores + seed factor scores | 150 companies + 1,350 subscores + 150 seed scores |
| `seed_financials.py` | Income/balance/cashflow statements + consensus estimates | 600 rows each (150×4 quarters) |
| `seed_events.py` | Market event types + news templates | 25 events + 15 templates |
| `seed_demo.py` | Demo users, timeline, portfolios | 3 users + 1 timeline + 3 portfolios |
| `seed_initial_prices.py` | Compute FQ, FairPE, IV, initial prices from financials | 150 price_history rows + company updates |

**Known gaps:**
- `price_history` not yet a TimescaleDB hypertable
- Sample transactions not seeded (will come from gameplay)
- No testing history generated (needs Phase 4 engine→DB wiring)

**Fixed quality gaps (2026-07-06):**
- ⬜→✅ Demo passwords now bcrypt-hashed (not plaintext)
- ⬜→✅ `industry_factor_weights` table seeded with industry-specific overrides
- ⬜→✅ `leaderboard` materialized view added (migration 0002)
- ⬜→✅ Σ-weights validation added (app-level check in seed_industries.py)

## Phase 4 — Simulation Engine ✅

**Completed 2026-07-07.** All items from the Phase 3 final review and PRD Section 6 are now implemented. The engine is no longer a "library of pure computation functions" — it is a **runnable simulation** with a full DB-to-engine orchestration loop.

### New Modules

| Module | File | Purpose |
|--------|------|---------|
| **Orchestrator** | `engine/orchestrator.py` | `run_tick()` — full 15-step tick loop (PRD 6.O). Loads state from DB, advances economic cycle, generates sector shocks, refreshes fundamentals quarterly, drifts IV, computes 7 drivers, runs OU price update, synthesizes OHLC, computes volume/liquidity, fires events, generates news, writes results, marks portfolios to market. `run_ticks()` — runs N consecutive ticks. |
| **Economic Cycle** | `engine/cycle.py` | `advance_cycle_phase()` — stochastic Markov transition between expansion/peak/contraction/trough. `compute_cycle_state()` — produces market factor return, GDP growth, interest rate, sentiment per phase. `generate_sector_shocks()` — per-industry factor shocks. |
| **OHLC Synthesis** | `engine/ohlc.py` | `synthesize_ohlc()` — produces realistic open/high/low from consecutive daily closes with intraday volatility. `apply_circuit_breaker()` — PRD 6.J ±20% daily limit and price floor. |
| **News Manager** | `engine/news_manager.py` | `select_and_fire_events()` — probabilistic event firing from MarketEvent catalog. `generate_news()` — template-based news generation from EventInstances. |

### What Each Tick Does (15 Steps)

1. Load `SimulationState` for the timeline
2. Check idempotency (skip if `price_history` exists for this date)
3. Advance economic cycle phase → market factor return F^m, macro indicators
4. Generate sector factor shocks F^s per industry
5. Every 63 ticks (quarter boundary): generate new financial statements, recompute FQ cross-sectionally, recompute FairPE & IV
6. Drift intrinsic value by daily growth rate
7. Compute all 7 driver values per company (value_opportunity, earnings_surprise, news_severity, economic_outlook, guidance, technical_momentum, institutional_buying)
8. Fire probabilistic events → apply effects to driver values
9. Assemble `TickState` → call `engine.tick.run_tick()` → vectorized OU update
10. Apply circuit breaker (±20% daily limit, price floor)
11. Synthesize OHLC from prev_close → new_close
12. Compute volume, order imbalance, demand/supply, liquidity score
13. Write `price_history`, `price_driver_scores`, `economic_cycle_state` rows
14. Update `Company` denormalized fields (current_price, market_cap, market_liquidity_score)
15. Mark-to-market portfolios, fire events → generate news, advance `SimulationState`

### Test Coverage — 113 Total (16 new integration tests)

| File | Tests | Scope |
|------|-------|-------|
| `test_orchestrator.py` | **16** | Full loop: basic tick, idempotency, driver scores, economic cycle, multi-day, price variation, events, news, circuit breaker, OHLC, cycle phase, sector shocks, edge cases |
| All existing tests | 97 | All pass (no regressions) |

### Key Architecture Decisions

- **Engine is still pure computation.** All existing engine modules (`tick.py`, `market.py`, `drivers.py`, etc.) remain pure functions with no DB knowledge. The orchestrator is the bridge.
- **Vectorized over 150 companies.** All company data is loaded, computed, and written in batch (not one-by-one).
- **Deterministic via seeded RNG.** Uses `random.Random(timeline.rng_seed + tick_count)` for all stochastic draws. Same seed + same timeline + same tick_count = identical results.
- **Idempotent re-runs.** If `price_history` already has a row for a given sim_date, that tick is skipped.
- **Config-as-data.** All coefficients come from `config_parameters` table — nothing hardcoded.

## Valuation Formula Revision — Logistic Quality Multiplier ✅

**2026-07-09.** Section 6.D (Fair PE) replaced: the old two-term `β_PE`/`β_G` quality-and-growth tilt is gone, replaced by a single **logistic quality multiplier** `Q(S)` applied to the industry's average PE:

```
Q(S) = Q_min + (Q_max − Q_min) / (1 + e^(−k·(S − c)))
FairPE = PE_industry × Q(S)
```

`S` is `IntrinsicScore` (already combines management quality, MOAT, financial quality, FCF quality, and growth potential — so growth is inside `S`, not a separate multiplier term). Encodes diminishing marginal valuation: quality gains near the bottom or top of the 0–100 scale barely move the multiplier; gains crossing the inflection point `c` (default 60) drive rapid re-rating.

**Config parameters:** `quality_mult_min` (0.30), `quality_mult_max` (5.00), `quality_mult_k` (0.12), `quality_mult_inflection` (60) — replace the removed `beta_pe`/`beta_g` keys.

### Follow-up fix (2026-07-09/10) — removed the `pe_min`/`pe_max` clamp entirely

A dry-run with hand-picked sample companies (`docs/valuation_dry_run.py`) surfaced a real calibration bug: the seeded `industries.pe_min`/`pe_max` clamps (e.g. IT: 10–60, Banking: 5–20) were sized for the *old* formula's much narrower multiplier band (≈0.4×–1.6× baseline PE). With the new `Q_max=5.00`, every industry's `pe_max` ceiling started biting around `IntrinsicScore≈60` — a company scoring 60 and one scoring 100 landed on the *identical* clamped FairPE, collapsing all differentiation across the top 40% of the score range and defeating the entire point of the logistic curve.

**Fix:** removed the `pe_min`/`pe_max` clamp from `fair_pe()` entirely. `Q(S)` is already bounded to `[Q_min, Q_max]` by construction, so `FairPE` is already bounded to `[PE_industry × Q_min, PE_industry × Q_max]` without a second clamp. `PE_industry` (`industries.baseline_pe`) is treated as the industry's average PE. The `industries.pe_min`/`pe_max` columns remain in the schema (unused by `fair_pe` now) in case a future revision needs an external ceiling independent of `Q_max`.

**Files changed:** `engine/valuation.py` (`fair_pe()` signature — dropped `growth_score`/`beta_pe`/`beta_g`/`pe_min`/`pe_max`, added `q_min`/`q_max`/`k`/`c`; new `quality_multiplier()`), `db/seeds/seed_config.py`, `db/seeds/seed_initial_prices.py`, `engine/orchestrator.py` (both call sites — the initial fake-quarter generator and the structural-event IV recompute path), `tests/test_valuation.py` (rewritten), `project.md` Section 6.D, `docs/valuation_dry_run.py` (new — standalone sample-company dry-run + real-world Reliance Industries sanity check).

### Reconciliation note (2026-07-10)

This valuation change was developed in parallel with an independent round of Phase 5 audit fixes pushed upstream (commits `068b1a0`, `c1a1809`, `06558eb`, `e78b644` — N+1 fixes, `secret_key` now required via env, `orchestrator.py` refactored into 7 helper functions, rate limiter, `/health` endpoint, `/portfolio/analytics`, 300 tests at 100% coverage). Reconciled by reapplying the `fair_pe` clamp-removal fix on top of the upstream refactor (call sites moved to new line numbers but same 3 locations) rather than force-pushing over it. Also reapplied 2 of my earlier Phase 5 audit fixes that upstream hadn't touched: a `lifespan` shutdown hook disposing the DB engine (`apps/api/main.py`), and removal of the unused `redis_url` config field (`apps/api/config.py`). Did **not** reapply my earlier commit-vs-flush "fix" — on inspection, upstream's flush-in-service/commit-in-router split is a deliberate, consistently-applied architectural choice (per `c1a1809`'s commit message), not a bug.

**Dry-run verification** (`docs/valuation_dry_run.py`, hand-picked sample values, no DB): confirmed monotonicity, the midpoint property (`Q(60) = (Q_min+Q_max)/2 = 2.65`), and the diminishing-marginal-valuation shape (equal-sized score jumps produce far larger `Q` deltas through the 50–60 middle band than at the 0–20 or 90–100 extremes).

**Real-world sanity check — Reliance Industries Ltd (NSE: RELIANCE):** dry-run with approximate real EPS (~₹98) and a blended industry PE (~18x, weighted across Reliance's O2C/retail/telecom segments) against hand-estimated quality inputs (mgmt=78, moat=82, fq=62, fcfq=58, growth=70) produced **FairPE≈74x — roughly 3× too high** versus Reliance's actual historical trading range (~22–28x). Solving backward, an `IntrinsicScore≈50` (not ≈72) is what reproduces the real multiple at the default `k=0.12`/`c=60`. **Honest conclusion:** the `Q(S)` formula itself behaves correctly (monotonic, properly bounded, correct diminishing-marginal-valuation shape) — the gap is that the qualitative 0–100 score inputs (management/moat/financial-quality/FCF/growth judgments) have not been calibrated against real market multiples. Seeded company scores in this simulation are synthetic placeholders, not fitted to observed market data; that calibration is a documented open task, not yet done.

**300/300 tests pass** after reconciliation (`SECRET_KEY` env var now required for tests per upstream's security fix — see `apps/api/config.py`).

## Phase 5 — Backend APIs ✅

**Completed 2026-07-07,** per the file-by-file spec in `docs/phase5-plan.md`. New directory `apps/api/` (22 new files): `main.py`, `config.py` (pydantic-settings), `database.py` (SQLAlchemy session dependency), `auth.py` (JWT via python-jose + bcrypt), `dependencies.py`, `exceptions.py`, `schemas.py` (all Pydantic request/response models), `routers/{auth,market,trading,simulation,news,leaderboard}.py`, `services/{market_service,trade_service,sim_service}.py`, `tests/{conftest,test_auth,test_market,test_trading,test_simulation}.py`.

**Endpoints (22 total):** `/auth/{register,login,me}`, `/market`, `/market/cycle`, `/companies/{ticker}` (+`/history`,`/drivers`,`/financials`,`/valuation`), `/orders`, `/portfolio`, `/transactions`, `/watchlist` (+ delete), `/sim/{advance,state,timelines}`, `/sim/admin/{events,config}`, `/news/`, `/leaderboard/`.

**Order execution** (`trade_service.place_order`): validates ticker/cash/shares, applies Kyle's-lambda price impact from `engine.liquidity`, computes fees from `config_parameters.trade_fee_rate` (default 0.1%), writes `Transaction` + updates `Holding` (weighted-avg cost basis) + `Portfolio.cash_balance`.

**Fixes applied from an 8-angle code review before commit:**
- Kyle-lambda impact is now capped at 99% of current price (previously an unbounded impact past `current_price` silently reset execution price to the undiscounted market price — the opposite of the intended effect for large orders).
- Buy-order cash validation now includes fees (previously a buy priced exactly at available cash could drive `cash_balance` negative once fees were deducted).
- JWT `sub`-claim decode now guards `int()` conversion (previously a malformed-but-signed token would 500 instead of 401).
- `unrealized_pnl_pct` guards near-zero (not just exactly-zero) `avg_cost_basis` to avoid absurd percentages from rounding drift.
- `/market` batches the previous-close lookup into one query for all companies instead of one query per company (N+1 → 1).

**Audit fixes (2026-07-09, per `docs/phase5-audit.md`):**
- ✅ CORS: `allow_credentials=False` (was `True` with `allow_origins=["*"]`, invalid per CORS spec)
- ✅ Double `Depends(get_current_user)` removed from `trading.py` router-level deps (was 2× per request)
- ✅ Timeline data leakage fixed: `list_timelines` filters by `owner_user_id` (includes global timelines)
- ✅ Config leakage fixed: `list_config` accepts optional `scope_id` filter
- ✅ Leaderboard N++1 eliminated: single join-based query instead of per-portfolio/per-holding queries
- ✅ News N+1 eliminated: batch company/industry name lookups; null-severity crash fixed
- ✅ `_prev_closes_by_company` rewritten: subquery with `func.max` instead of loading all rows into memory
- ✅ `get_current_user_optional` catches `JWTError` directly instead of broad `HTTPException`
- ✅ Database `get_db()` now rolls back on exception before closing
- ✅ Unused `interval` param removed from `/history` endpoint
- ✅ Lazy imports moved to top of `sim_service.py`
- ✅ Dead `ValidationError` exception class removed
- ✅ `PortfolioResponse.day_change_pct` computed (was hardcoded `None`)
- ✅ Sell impact cap reduced to 50% (was 99%, allowing near-total price collapse)
- ✅ Deprecation warning fixed (`HTTP_422_UNPROCESSABLE_ENTITY` → `UNPROCESSABLE_CONTENT`)

**152 tests pass, zero warnings.**

**Remaining known gaps:** no row-level locking for concurrent order execution (TOCTOU risk); `/leaderboard` derives ranks in Python instead of querying the materialized view; `/portfolio/analytics` endpoint not implemented (PRD requirement).

## News/Event → Factor Score Propagation Fix ✅

**2026-07-10.** Investigated whether news/event `effect_profile`s targeting factor scores (as opposed to short-lived price drivers) actually propagate through to `IntrinsicScore` → `Q(S)` → `FairPE` → `IntrinsicValue`. Confirmed via a general-purpose agent review + direct testing that they did **not**, in three distinct ways, all in `engine/orchestrator.py`'s `_apply_event_factor_effects`:

1. **`financial_quality` effects were silently dropped.** The function built its working `factor_scores` dict from `MoatSubscore` rows plus only 3 hardcoded `CompanyFactorScore` fields (`management_quality`, `growth_potential`, `fcf_quality`) — `financial_quality` was never included. Since the underlying `apply_effect_to_factor_scores` uses `.get(key, 0.0)`, an event's `"financial_quality": -2` delta was applied against a phantom baseline of 0 instead of the company's real score, and the result was never written back anywhere (the write-back condition didn't check for `financial_quality` either, and `fq` was always recomputed fresh from `FinancialQualitySubscore` rows, discarding the event entirely). At least 2 seeded events (`db/seeds/seed_events.py`) rely on this key and were silently no-ops.
2. **`moat_score` as a direct top-level key was silently dropped**, same mechanism — `factor_scores` was only ever populated from individual `MoatSubscore.subfactor_key` rows (e.g. `innovation`, `brand_strength`), never from the composite `moat_score` field itself, so a direct `"moat_score": 3` effect (2 seeded events use this) produced a phantom dict entry that never matched any real row in the write-back loop.
3. **Only `scope_type == "company"` events had factor effects applied at all** — industry-scope and market-scope `EventInstance` rows were skipped via an early `continue` before any factor-key processing, regardless of bugs #1/#2. Several seeded industry-scope events ("Supply Chain Disruption", "Commodity Price Spike", "Consolidation Wave") rely on `financial_quality`/`moat_score` deltas that were never applied to any company.

**Fix:** rewrote `_apply_event_factor_effects` to (a) build the full 5-field `factor_scores` dict (all of `management_quality`/`moat_score`/`financial_quality`/`fcf_quality`/`growth_potential`) from the real `CompanyFactorScore` row so deltas apply against real baselines; (b) treat a direct `moat_score` effect as a nudge on top of the sub-factor composite, distinct from individual sub-factor keys; (c) extend scope handling via a new `_scope_target_company_ids` helper so industry-scope events apply to every company in that industry and market-scope events apply to every company; (d) persist the updated scores onto the actual `CompanyFactorScore` row (previously only the denormalized `Company.intrinsic_value/intrinsic_score/fair_pe` fields were updated — the source-of-truth `CompanyFactorScore` row, which the next tick's driver computations and any direct query would read, stayed stale).

**Also fixed a pre-existing latent bug this exposed:** `engine/scoring.py`'s `moat_composite` raises `KeyError` if any key in `subscores` lacks a matching entry in `weights` — the original code never triggered this because it happened not to exercise mismatched seed data, but the new tests did (a `MoatSubscore` row with no corresponding `moat_sub` `FactorDefinition`). Fixed at the call site by filtering to only weighted sub-factors, falling back to the company's existing `moat_score` if none are weighted.

**New tests** (`tests/test_orchestrator.py`): `test_financial_quality_effect_persists_to_company_factor_score`, `test_moat_score_direct_key_effect_applies_on_top_of_subfactor_composite`, `test_industry_scope_event_applies_factor_effects_to_member_companies`, `test_market_scope_event_applies_factor_effects_to_all_companies` — each directly calls `_apply_event_factor_effects` and asserts the real `CompanyFactorScore` row moved by the expected amount, not just that the tick completed.

**304/304 tests pass** (300 prior + 4 new).

**Known remaining gap, not fixed:** persistent factor-score effects always apply with `days_elapsed=0` (no decay ever applied to the *factor-score* side, unlike the driver side which does decay via `apply_effect_to_drivers`). This means a factor-score effect's full severity always lands undiscounted at fire time — a deliberate design difference from the driver side (structural changes are meant to be a fire-and-forget shift, not something that fades day by day), so left as-is, but noted here in case decay-on-factor-scores is ever wanted.

## Valuation Formula Revision #2 — PEG-Based Intrinsic Value ✅

**2026-07-10.** Section 6.D replaced again: the pure `FairPE = PE_industry × Q(S)` approach (2026-07-07/09 revisions) is superseded by a **PEG-based** flow where market valuation multiples never directly enter the intrinsic-value calculation — only business quality and a company's own estimated sustainable growth rate do:

```
Financial Quality Score S (0-100, = IntrinsicScore)
  -> M(S) = 0.6 + 1.4 / (1 + e^(-0.11*(S-60)))            (quality_multiplier)
  -> Fair PEG = NeutralIndustryPEG x M(S)                   (fair_peg)
  -> Fair P/E = Fair PEG x LongTermGrowthRate%              (fair_pe_from_peg)
  -> Intrinsic Value = EPS x Fair P/E                       (intrinsic_value_per_share)
```

**`NeutralIndustryPEG`** — the long-term fair PEG a normal (~S=60) business deserves in its industry, a configurable per-industry constant (NOT a market-observed average). Seeded per the 15 given values (Banking 0.90, IT 1.40, Pharma 1.50, FMCG 1.60, Autos 1.00, Energy 0.70, Utilities 0.80, Metals 0.60, Construction 0.90, Real Estate 0.80, Telecom 1.00, Retail 1.40, Industrials 1.10, Chemicals 1.20, Media 1.20) as `config_parameters` rows (`key="neutral_industry_peg"`, `scope="industry"`, `scope_id=<industry.id>`) in `db/seeds/seed_industries.py`.

**`M(S)` defaults:** `M_min=0.6`, `M_max=2.0`, `k=0.11`, `c=60` — matches the given `M(S) = 0.3 + 2.7/(1+e^{-0.11(S-60)})`... **note:** the uploaded image showed `M(S) = 0.3 + 2.7/(...)` (implying M_min=0.3, M_max=3.0) but the accompanying text explicitly stated "The multiplier ranges approximately from 0.6 to 2.0" and gave the formula as `M(S) = 0.6 + 1.4/(1+exp(-0.11*(S-60)))`. Implemented per the **text's explicit formula** (0.6 + 1.4/(...), consistent with its own stated 0.6–2.0 range), not the image, since the two conflicted and the text was more explicit/complete. Flagging this discrepancy here for visibility.

**Growth rate input (new gap filled):** the PRD referenced an `ExpectedAnnualGrowth(Growth_i)` mapping that was never implemented. Added `growth_score_to_rate()` — a configurable linear map of the 0–100 `growth_potential` score to an estimated annual EPS growth rate, **per explicit user instruction**: 0 → 2%/yr, 100 → 60%/yr (`growth_rate_min`/`growth_rate_max` config keys). This is a fallback only; the spec calls for growth to ideally be derived from each company's own financials/industry context where possible.

**Config parameters added:** `growth_rate_min` (2.0), `growth_rate_max` (60.0) in `seed_config.py`; `quality_mult_min`/`max`/`k`/`inflection` updated from the old Q(S) defaults (0.30/5.00/0.12) to the new M(S) defaults (0.6/2.0/0.11); `neutral_industry_peg` (15 industry-scoped rows) in `seed_industries.py`.

**Files changed:** `engine/valuation.py` (removed `fair_pe()` entirely, replaced with `quality_multiplier()` [renamed params/defaults], `fair_peg()`, `fair_pe_from_peg()`, `growth_score_to_rate()`), `engine/__init__.py` (public API), `db/seeds/seed_config.py`, `db/seeds/seed_industries.py`, `db/seeds/seed_initial_prices.py`, `engine/orchestrator.py` (both call sites — `_refresh_fundamentals` and `_apply_factor_effects_to_company` — plus new `_load_neutral_industry_pegs` helper and `neutral_industry_pegs` threaded through `state`), `tests/test_valuation.py` (rewritten), `tests/test_orchestrator.py` + `apps/api/tests/conftest.py` (fixture config updated), `project.md` Section 6.D, `docs/valuation_dry_run.py` (rewritten with 3 real-company dry-run: Sun Pharma, Avenue Supermarts/DMart, TCS).

**Scale change warning:** `LongTermGrowthRate` is entered as a raw percentage number (e.g. `18.0` for 18%), not a fraction — `FairPE = FairPEG × 18.0`, not `× 0.18`. This is a ~100× scale difference from the old formula's `FairPE = PE_industry × Q(S)` and produces materially larger absolute P/E numbers when growth rates are high; this is intentional per the spec, not a bug, but worth knowing when sanity-checking output.

## Deep Code Review — Duplication Cleanup + Correctness Fixes ✅

**2026-07-11.** Full logical/mathematical review of `stock-sim/` for dead code, duplication, and behavior bugs. Executed in two authorized phases ("A" cleanup + "B" correctness), deferring a third (dropping unused `Industry.baseline_pe`/`pe_min`/`pe_max` columns via migration — out of scope, not yet authorized).

**Correctness fixes (Phase B) — all confirmed to change actual simulation behavior, each covered by a new regression test in `tests/test_orchestrator.py`:**

1. **`earnings_surprise`/`guidance` decayed to ~0 permanently after the first quarter.** `_compute_drivers` was passing the absolute `tick_count` into the decay functions instead of days-since-the-current-quarter's-earnings. Fixed to use `tick_count % QUARTER_LENGTH`, so both drivers correctly reset to "fresh" at each new quarter's earnings release instead of decaying toward zero forever. (`engine/orchestrator.py`)
2. **`technical_momentum` was a hardcoded fake `prev_close * 0.98`,** not a real moving average. `_load_tick_state` now batch-loads each company's trailing closes (`recent_closes`) in one query per tick, and `_compute_drivers` computes a real moving average from them. (`engine/orchestrator.py`)
3. **`management_quality`/`growth_potential`/`fcf_quality` were randomly re-rolled every quarter** in `_refresh_fundamentals`, discarding the seeded/event-adjusted values and causing `IntrinsicScore` (and therefore `FairPE`/`IV`) to lurch randomly at every quarter boundary for reasons unrelated to the company's actual financials. Fixed to carry forward the latest existing `CompanyFactorScore` values instead of drawing fresh `rng.uniform(...)` numbers.
4. **`earnings_stability`/`revenue_consistency` silently fell back to a single-point neutral placeholder at every quarterly refresh** instead of using the company's real trailing EPS/revenue history. `_generate_fake_quarterly_financials` now loads the full prior statement history before generating each new quarter's statement, and threads real `eps_history`/`revenue_history` lists into `_compute_standard_raw`.

**Duplication cleanup (Phase A):**

- The PEG valuation chain (`IntrinsicScore -> M(S) -> Fair PEG -> Fair P/E -> IV`) was hand-rolled identically in three places. Extracted a shared `_recompute_valuation()` helper in `engine/orchestrator.py`, now used by both `_refresh_fundamentals` and `_apply_factor_effects_to_company` (the third copy, in `db/seeds/seed_initial_prices.py`, was deliberately left standalone — a one-time seed script importing a private helper from `engine.orchestrator` would be an awkward reverse dependency for ~6 lines that run once).
- Removed dead locals and a redundant early-return branch from `run_tick`, which is now a thin wrapper delegating to `run_ticks(num_ticks=1)`.
- Removed the unused `daily_volume` import from `engine/orchestrator.py` (superseded by `compute_volume_prd`, the live path) — the function itself was left in `engine/liquidity.py` since it's small, correct, and has its own dedicated tests.
- `apps/api/dependencies.py`'s `get_company_by_ticker` had zero callers anywhere (every router endpoint delegates ticker lookups to its service-layer function instead) — removed. `get_user_portfolio` had exactly one real duplication opportunity, `trading.py`'s `get_portfolio` router endpoint, which inlined the identical `Portfolio` lookup — wired in via `Depends()`. (The other apparent "duplicates" of this pattern live in plain service functions that take a `db: Session` argument rather than being FastAPI-injected endpoints, so they architecturally can't consume a `Depends()`-based helper without a larger refactor; left as-is.) Also fixed `get_user_portfolio`'s `timeline_id` default, which used a plain default instead of `Query(default=...)` and would not have bound correctly as a dependency.
- Evaluated `engine/market.py`'s `company_volatility()` (+ its two private helpers) for removal — confirmed dead (the live orchestrator path computes volatility inline via a different, more specific formula using real leverage/balance-sheet data). Decided to **keep** it: it's a small, correct, tested, spec-referenced (Section 6.I) pure function, not a duplicate of the orchestrator's version — same reasoning as `daily_volume`.

**Test suite:** 313 tests pass (308 pre-existing + 5 new regression tests targeting the correctness fixes above).

## Phase 6–10

See `docs/` directory for detailed phase documentation.

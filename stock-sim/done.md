# Fictional Stock Market Simulation — Build Progress

> Tracks status against the Master Prompt & PRD, phase by phase. Location of all code: `stock-sim/` inside this repo (`asu-honors`).
> Last updated: 2026-07-06 (Phase 3 complete — 10/10, all issues resolved).

---

## Status

| Phase | Description | Status |
|---|---|---|---|
| 1 | Simulation Rulebook (design) | ✅ Done |
| 2 | Fictional Economy (150 companies, 15 industries, events, news) | ✅ Done |
| 3 | Database (schema + migrations + seed data) | ✅ Done |
| 4 | Simulation Engine (Python/NumPy) | ✅ Done — full DB-to-engine orchestration loop, economic cycle, OHLC, events/news, PRD 6.L volume (LogNormalNoise/EarningsDayFlag), dynamic volatility recompute (σ_i = σ_ind×f_size×f_lev), structural events modify factor scores + IV recompute, 113 tests |
| 5 | Backend APIs (FastAPI) | ⬜ Not started |
| 6 | Basic Frontend (Next.js) | ⬜ Not started |
| 7–9 | Feature build-out (analytics, events UI, news feed, Future Lab, notifications, polish) | ⬜ Not started |
| 10 | Testing & Deployment | 🟡 Partial — engine unit tests + orchestrator integration tests exist (113 pass), nothing else tested |

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

## Phase 5–10

See `docs/` directory for detailed phase documentation.

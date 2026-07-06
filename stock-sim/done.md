# Fictional Stock Market Simulation — Build Progress

> Tracks status against the Master Prompt & PRD, phase by phase. Location of all code: `stock-sim/` inside this repo (`asu-honors`).
> Last updated: 2026-07-06 (Phase 3 seeds populated).

---

## Legend

- ✅ Done — built, verified (tests pass / imports clean)
- 🟡 Partial — some of the phase exists, gaps noted
- ⬜ Not started

---

## Phase-by-phase status

| Phase | Description | Status |
|---|---|---|
| 1 | Simulation Rulebook (design) | ✅ Done — the PRD itself is the finalized spec |
| 2 | Fictional Economy (150 companies, 15 industries, events, news content) | ⬜ Not started |
| 3 | Database (schema + migrations + seed data) | 🟡 Partial — schema done, seed data not started |
| 4 | Simulation Engine (Python/NumPy) | 🟡 Partial — formulas done, orchestration wiring to DB not started |
| 5 | Backend APIs (FastAPI) | ⬜ Not started |
| 6 | Basic Frontend (Next.js) | ⬜ Not started |
| 7–9 | Feature build-out (analytics, events UI, news feed, Future Lab, notifications, polish) | ⬜ Not started |
| 10 | Testing & Deployment | ⬜ Not started (engine unit tests exist; nothing else to test yet) |

---

## Detailed breakdown

### Phase 1 — Simulation Rulebook ✅
- Factor model (Intrinsic Value + Price Drivers), MOAT sub-factors, Financial Quality sub-factor model, 15-industry pillar-weight matrix, and the full math engine (Section 6) are finalized in the PRD.
- **Open items:** Section 16's "Immediate Next Actions" (approve industries/weights, approve MOAT/FQ sub-factor lists, approve OU-vs-VO mean-reversion choice) — these are approval checkpoints, not build tasks. Not yet explicitly signed off.

### Phase 2 — Fictional Economy ⬜
Nothing built yet. Still needed:
- [ ] Define the 15 industries as data (baseline PE, PE min/max, base volatility, cycle sensitivity, sector beta default, subfactor_set) — table exists, no rows.
- [ ] Create 150 companies (identity, shares outstanding, free float, betas) — table exists, no rows.
- [ ] Assign MOAT sub-scores, management quality, growth potential, FCF quality seed scores per company.
- [ ] Generate unique tickers.
- [ ] Write company descriptions.
- [ ] Create logos/placeholders.
- [ ] Build the 150+ market-events catalog with `effect_profile` JSON.
- [ ] Create news templates.

### Phase 3 — Database ✅
**Done:**
- ✅ All 28 tables modeled in SQLAlchemy 2.0 (`stock-sim/db/models/`), split by domain:
  - `reference.py` — Industry, Company, FactorDefinition, IndustryPillarWeight, IndustryFactorWeight, ConfigParameter (6 tables)
  - `factor_scores.py` — CompanyFactorScore, MoatSubscore, FinancialQualitySubscore (3 tables)
  - `financials.py` — IncomeStatement, BalanceSheet, CashFlowStatement, ConsensusEstimate (4 tables)
  - `timeseries.py` — PriceHistory, PriceDriverScore, EconomicCycleState (3 tables)
  - `events.py` — MarketEvent, EventInstance, NewsTemplate, NewsFeed (4 tables)
  - `simulation.py` — Timeline, SimulationState (2 tables)
  - `trading.py` — User, Portfolio, Holding, Transaction, Watchlist, Notification (6 tables)
- ✅ Alembic scaffolding (`alembic.ini`, `db/migrations/env.py`, `script.py.mako`) and a hand-authored initial migration (`0001_initial_schema.py`) creating all 28 tables in FK-safe order.
- ✅ Migration executed against live Postgres (Docker, port 5432) — 28 tables + 54 indexes/constraints verified.
- ✅ All seed scripts written and executed:
  - `seed_config.py` — 18 config parameters + 33 factor definitions + 75 pillar weights
  - `seed_industries.py` — 15 industries with baseline PEs, volatility, cycle sensitivity
  - `seed_companies.py` — 150 companies (10 per industry), 1,350 moat subscores, 150 seed factor scores
  - `seed_financials.py` — 600 quarters of income/balance/cashflow statements + consensus estimates
  - `seed_events.py` — 25 market event types + 15 news templates
  - `seed_demo.py` — 3 demo users, 1 live timeline, 3 portfolios
- ✅ Runner (`run_all.py`) — executes all seeds in order, idempotent
- ✅ `pyproject.toml` fixed — build system + package discovery configured

**Not done (minor gaps):**
- [ ] `price_history` not yet a TimescaleDB hypertable (can be done in a follow-up migration)
- [ ] `leaderboard` materialized view not implemented
- [ ] Σ-weight validation not implemented (app-level check)
- [ ] No Redis cache layer (can be added later)
- [ ] 25 market events seeded (150+ planned in PRD) — more can be added
- [ ] Engine step 11.6 not run yet (needs Phase 4 engine→DB wiring)
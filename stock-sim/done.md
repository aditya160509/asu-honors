# Fictional Stock Market Simulation — Build Progress

> Tracks status against the Master Prompt & PRD, phase by phase. Location of all code: `stock-sim/` inside this repo (`asu-honors`).
> Last updated: 2026-07-06 (Phase 3 audit complete).

---

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Simulation Rulebook (design) | ✅ Done |
| 2 | Fictional Economy (150 companies, 15 industries, events, news) | ✅ Done |
| 3 | Database (schema + migrations + seed data) | ✅ Done |
| 4 | Simulation Engine (Python/NumPy) | 🟡 Partial — formulas done, orchestration wiring to DB not started |
| 5 | Backend APIs (FastAPI) | ⬜ Not started |
| 6 | Basic Frontend (Next.js) | ⬜ Not started |
| 7–9 | Feature build-out (analytics, events UI, news feed, Future Lab, notifications, polish) | ⬜ Not started |
| 10 | Testing & Deployment | 🟡 Partial — engine unit tests exist (88 pass), nothing else tested |

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

**Known gaps:**
- `price_history` not yet a TimescaleDB hypertable
- Sample transactions not seeded (will come from gameplay)
- No testing history generated (needs Phase 4 engine→DB wiring)

**Fixed quality gaps (2026-07-06):**
- ⬜→✅ Demo passwords now bcrypt-hashed (not plaintext)
- ⬜→✅ `industry_factor_weights` table seeded with industry-specific overrides
- ⬜→✅ `leaderboard` materialized view added (migration 0002)
- ⬜→✅ Σ-weights validation added (app-level check in seed_industries.py)

## Phase 4–10 (not started / partial)

See `docs/` directory for detailed phase documentation.

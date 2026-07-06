# Phase 3 — Audit Report

> **Date:** 2026-07-06
> **Scope:** Full inspection of Phase 3 (DB schema + seed data) across all files.

---

## Verification results

| Check | Result | Details |
|-------|--------|---------|
| Models import | ✅ | All 28 models import cleanly with Python 3.11 |
| Tests pass | ✅ | 88/88 passed |
| Seed scripts compile | ✅ | All 7 seed scripts parse without syntax errors |
| Migration syntax | ✅ | 0001_initial_schema.py is well-formed Alembic |
| DB field alignment | ✅ | All seed dicts match model column names |
| FK constraints | ✅ | All foreign keys reference existing tables |

---

## File-by-file findings

### `db/models/` — All 28 models
- ✅ SQLAlchemy 2.0 declarative style with `Mapped` type annotations
- ✅ `Numeric` used for financial columns (no floating-point drift)
- ✅ `BigInteger` for shares/volume columns
- ✅ CHECK constraints on all enum-like columns and value ranges
- ✅ FK cascades correct (`CASCADE` for children, `RESTRICT`/`SET NULL` for references)
- ✅ `JSONB` used for JSON columns with psycopg fallback
- ⚠️ `industry_factor_weights` table exists but no seed data populates it
- ⚠️ `MoatSubscore` lacks `fiscal_period` (fine — moat is a point-in-time score)

### `db/migrations/versions/0001_initial_schema.py`
- ✅ Creates all 28 tables in correct FK dependency order
- ✅ All CHECK constraints, unique constraints, and indexes present
- ⚠️ `simulation_state` defines `created_at`/`updated_at` inline instead of via `_timestamps()` — style inconsistency, not a bug

### `db/seeds/seed_config.py`
- ✅ 18 config parameters + 33 factor definitions
- ✅ All factor types (`intrinsic_top`, `moat_sub`, `fq_sub`, `price_driver`) present
- ✅ Idempotent (checks existence before insert)

### `db/seeds/seed_industries.py`
- ✅ 15 industries with full factor profiles
- ✅ 75 pillar weights (5 pillars × 15 industries) summing correctly per industry
- ⚠️ `IndustryFactorWeight` records not seeded — the table exists but every industry has empty factor weights

### `db/seeds/seed_companies.py`
- ✅ 150 companies (10 per industry) with unique tickers
- ✅ 1,350 moat subscores (150 × 9 sub-factors)
- ✅ 150 seed `CompanyFactorScore` records with period="SEED"
- ✅ Deterministic RNG using `random.Random(company_id)` for reproducibility

### `db/seeds/seed_financials.py`
- ✅ 600 rows each (150 companies × 4 quarters) for income/balance/cashflow/consensus
- ✅ Industry-specific base revenue and inventory handling
- ✅ Idempotent checks on all inserts
- ⚠️ Uses `shares_outstanding` for EPS calc — correct since seed doesn't set `current_price`
- ⚠️ No P&L integrity check (e.g., COGS < Revenue not enforced for edge cases)

### `db/seeds/seed_events.py`
- ✅ 25 market event types across 7 scopes (company/industry/market)
- ✅ 15 news templates linked to event categories
- ✅ All `effect_profile` JSON keys reference valid `factor_definitions.key` values

### `db/seeds/seed_demo.py`
- ✅ 3 users (Alice/bob/charlie) with starting cash
- ✅ 1 "Live Market" timeline + 3 portfolios
- ⚠️ `hashed_password` stores literal "demo" — not bcrypt-hashed. Will break any auth flow.

### `db/seeds/run_all.py`
- ✅ Correct dependency ordering
- ✅ Propagates `DATABASE_URL` env var to subprocesses
- ✅ Exits on first failure

### `SETUP.md`
- ✅ Step-by-step instructions covering the full workflow
- ⚠️ Mentions "Phase 3 seed scripts" as "next work" which is now done
- ⚠️ Lists 7 seed steps but wire-engine step (#6) is still blocked

### `done.md` (before fix)
- ❌ Phase 2 status said "⬜ Not started" — actually all done via seed data
- ❌ Phase 3 status said "🟡 Partial — seed data not started" — actually all done
- ❌ Phase 2 detail section said "Nothing built yet" with unchecked items — all completed
- ✅ Fixed in this audit

### `db/PHASE3.md` (before fix)
- ⚠️ Mixed `[x]`/`[ ]` under "NOT DONE" heading was confusing
- ✅ Fixed in this audit

---

## Critical issues

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | `done.md` status table and detail sections severely outdated | `done.md` | **HIGH** |
| 2 | `hashed_password` stored as plaintext "demo" | `seed_demo.py`, `trading.py` | **HIGH** (auth will fail) |
| 3 | `industry_factor_weights` table never seeded | `seed_industries.py` | **MEDIUM** |
| 4 | `PHASE3.md` confusing mixed status markers | `db/PHASE3.md` | **LOW** |

## Minor issues

| # | Issue | File(s) |
|---|-------|---------|
| 5 | `SETUP.md` references Phase 3 as "next work" — now complete | `SETUP.md` |
| 6 | No `.env.example` for DATABASE_URL | (missing) |
| 7 | Migration `_timestamps()` not used for `simulation_state` | `0001_initial_schema.py` |
| 8 | `seed_financials.py` no P&L cross-field integrity checks | `seed_financials.py` |

---

## File manifest

```
stock-sim/
├── db/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py       # Re-exports all 28 models
│   │   ├── base.py           # DeclarativeBase + TimestampMixin
│   │   ├── reference.py      # Industry, Company, FactorDefinition, ConfigParameter + weights
│   │   ├── factor_scores.py  # CompanyFactorScore, MoatSubscore, FinancialQualitySubscore
│   │   ├── financials.py     # IncomeStatement, BalanceSheet, CashFlowStatement, ConsensusEstimate
│   │   ├── timeseries.py     # PriceHistory, PriceDriverScore, EconomicCycleState
│   │   ├── events.py         # MarketEvent, EventInstance, NewsTemplate, NewsFeed
│   │   ├── simulation.py     # Timeline, SimulationState
│   │   └── trading.py        # User, Portfolio, Holding, Transaction, Watchlist, Notification
│   ├── migrations/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── seeds/
│   │   ├── seed_config.py
│   │   ├── seed_industries.py
│   │   ├── seed_companies.py
│   │   ├── seed_financials.py
│   │   ├── seed_events.py
│   │   ├── seed_demo.py
│   │   └── run_all.py
│   └── PHASE3.md
├── engine/
│   ├── __init__.py
│   ├── drivers.py
│   ├── events.py
│   ├── fundamentals.py
│   ├── liquidity.py
│   ├── market.py
│   ├── scoring.py
│   ├── tick.py
│   └── valuation.py
├── tests/
│   ├── test_drivers.py
│   ├── test_events.py
│   ├── test_fundamentals.py
│   ├── test_liquidity.py
│   ├── test_market.py
│   ├── test_scoring.py
│   └── test_valuation.py
├── docs/
│   ├── phase3-audit.md       # This file
│   └── overview.md
├── apps/
│   ├── api/.gitkeep
│   └── web/.gitkeep
├── SETUP.md
├── done.md
├── pyproject.toml
├── alembic.ini
├── project.md
└── review.md
```

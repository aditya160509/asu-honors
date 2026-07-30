# Bulk In-Memory Tick Mode — Design Document

> **Status:** Proposal  
> **Date:** 2026-07-30  
> **Scope:** engine/orchestrator.py, apps/api/services/*, db/timeline_resolver.py, db/models/*, apps/web

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [DB Access Pattern Catalog](#2-db-access-pattern-catalog)
3. [In-Memory Bulk Tick Architecture](#3-in-memory-bulk-tick-architecture)
4. [Data Structures for In-Memory Tick Arrays](#4-data-structures-for-in-memory-tick-arrays)
5. [Read-It-Once Caching Strategy](#5-read-it-once-caching-strategy)
6. [Batch Deferred Writes](#6-batch-deferred-writes)
7. [SQLite WAL + Pragma Tuning](#7-sqlite-wal--pragma-tuning)
8. [Index Strategy](#8-index-strategy)
9. [Parallel DB Writes](#9-parallel-db-writes)
10. [Skip Non-Essential Work During Bulk Runs](#10-skip-non-essential-work-during-bulk-runs)
11. [Frontend-Backend Protocol Changes](#11-frontend-backend-protocol-changes)
12. [Edge Cases & Consistency Guarantees](#12-edge-cases--consistency-guarantees)
13. [Implementation Plan](#13-implementation-plan)
14. [Appendix: Full Per-Tick DB Query Catalog](#14-appendix-full-per-tick-db-query-catalog)

---

## 1. Problem Statement

The current `run_ticks()` loop runs N ticks sequentially, each tick doing a full `_load_tick_state` → compute → `_write_tick_results` → `_mark_to_market` → `_execute_events` cycle. At 150 companies with SQLite backend, a single tick takes ~200–600ms. `run_ticks(session, timeline_id, num_ticks=252)` would take 50–150 seconds — far too slow for fast-forwarding a simulation year.

The bottleneck is not the pure-Python engine computation (`engine_run_tick` is microseconds) — it's the DB access: queries, ORM overhead, and per-row inserts at every tick.

### Key insight

90%+ of `_load_tick_state`'s DB reads return **identical data across every tick within a bulk run** — the same companies, industries, balance sheets, income statements, consensus estimates, factor scores, config params, events until they expire. Only the per-tick PriceHistory and PriceDriverScore writes change.

By moving to an **in-memory bulk tick mode**, we can:
1. Load all static/reference state **once** before the loop.
2. Drive N ticks in-memory arrays — `price_overlay`, `iv_overlay`, cycle state drift, news_severity, tick_result.outputs — all as ephemeral Python dicts/lists.
3. Defer ALL writes to a single bulk flush after N ticks.

---

## 2. DB Access Pattern Catalog

Every DB access in a single tick, categorized by frequency and mutability:

| # | Query | Location | Frequency | Mutates? | Cachable? |
|---|-------|----------|-----------|----------|-----------|
| 1 | `Timeline` fetch (id=timeline_id) | _load_tick_state | 1/tick | No | ✅ Once per run |
| 2 | `SimulationState` fetch | _load_tick_state | 1/tick | Yes (advance pointer) | ❌ Changes every tick |
| 3 | `ConfigParameter` (global) | _load_params | 1/tick | No | ✅ Once per run |
| 4 | `ConfigParameter` (industry peg) | _load_neutral_industry_pegs | 1/tick | No | ✅ Once per run |
| 5 | `TimelineOverride` (all for timeline) | _load_tick_state | 1/tick | No | ✅ Once per run |
| 6 | `EconomicCycleState` (latest own) | _load_tick_state | 1/tick | Yes (insert new row) | ❌ Each tick adds a row |
| 7 | `EconomicCycleState` (ancestor fallback) | _load_tick_state / resolve_latest_cycle_state | 1/tick (first tick only) | No | ✅ Once per run |
| 8 | `Company` (all) | _load_tick_state | 1/tick | No (read-only) | ✅ Once per run |
| 9 | `Industry` (all) | _load_tick_state | 1/tick | No | ✅ Once per run |
| 10 | `PriceHistory` (latest prices via parent chain) | get_latest_prices | 1/tick | No | ❌ Changes every tick (new prices) |
| 11 | `PriceHistory` (latest IV via parent chain) | get_latest_intrinsic_values | 1/tick | No | ❌ Changes every tick |
| 12 | `PriceHistory` (recent closes for MA) | _load_tick_state | 1/tick | No | ❌ Sliding window changes |
| 13 | `PriceDriverScore` (prev news_severity) | _load_tick_state | 1/tick | No | ❌ Changes every tick |
| 14 | `BalanceSheet` (all, timeline-scoped) | _load_tick_state | 1/tick | No | ✅ Once per run except quarter boundaries |
| 15 | `IncomeStatement` (all, timeline-scoped) | _load_tick_state | 1/tick | No | ✅ Once per run except quarter boundaries |
| 16 | `ConsensusEstimate` (all, timeline-scoped) | _load_tick_state | 1/tick | No | ✅ Once per run except quarter boundaries |
| 17 | `CompanyFactorScore` (all, timeline-scoped) | _load_tick_state | 1/tick | No | ✅ Once per run except quarter boundaries |
| 18 | `EventInstance` (active, timeline-scoped) | _load_active_events | 1/tick | No (read-only) | ❌ New events may fire each tick |
| 19 | `MarketEvent` (lookup by event IDs) | _load_active_events | 1/tick | No | ✅ Once per run |
| 20 | `PriceHistory` (INSERT) | _write_tick_results | ~150 rows/tick | **Yes** | N/A — write |
| 21 | `PriceDriverScore` (INSERT) | _write_tick_results | ~1050 rows/tick | **Yes** | N/A — write |
| 22 | `PriceHistory` (idempotency check) | run_ticks top | 1/tick | No | ❌ Changes every tick |
| 23 | `EconomicCycleState` (INSERT) | _load_tick_state | 1/tick (new phase) | **Yes** | N/A — write |
| 24 | `SimulationState` (UPDATE) | run_ticks | 1/tick | **Yes** | N/A — write |
| 25 | `Portfolio` / `Holding` (mark-to-market) | _mark_to_market | 1/tick | **Yes** | N/A — write |
| 26 | EventInstance/MarketEvent queries in _apply_event_factor_effects | _execute_events | 1/tick | Yes | ✅ Batch once per run + incremental |
| 27 | Factor definition / pillar weight queries | _load_factor_effect_batch | 1/tick | No | ✅ Once per run |
| 28 | BalanceSheet/IncomeStatement writes (quarter) | _refresh_fundamentals | 1/63 ticks | **Yes** | N/A — 4x per year |

### Read vs Write Split

- **~40 individual SELECT queries** per tick (most batched)
- **~1,200 individual row inserts** per tick (150 PriceHistory + 1050 PriceDriverScore + cycle state + sim_state update + portfolio mark)
- **~5 UPDATE statements** per tick (simulation_state, portfolio.total_value x N portfolios)

---

## 3. In-Memory Bulk Tick Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                    bulk_run_ticks()                      │
├─────────────────────────────────────────────────────────┤
│  Phase 1: LOAD ONCE                                      │
│  ├── Static reference data (companies, industries,       │
│  │   config, financials, factor defs, event templates)   │
│  └── ● All stored in memory arrays (see §4)              │
│                                                          │
│  Phase 2: RUN N TICKS IN MEMORY                          │
│  ├── For tick i = 1..N:                                  │
│  │   ├── Advance sim_date, tick_count                    │
│  │   ├── Drift cycle state (in-memory f_m)               │
│  │   ├── Drift intrinsic values                          │
│  │   ├── Compute drivers (uses in-memory overlays)       │
│  │   ├── Engine tick → price, OHLC, volume               │
│  │   ├── Update in-memory price_overlay, iv_overlay      │
│  │   ├── Append PriceHistoryRow, PriceDriverScoreRow     │
│  │   │   to deferred insertion buffers                   │
│  │   ├── Advance sim_state in-memory                     │
│  │   └── (skip events/concalls/news per §10)             │
│  │                                                       │
│  Phase 3: BULK WRITE (one flush)                         │
│  ├── executemany PriceHistory (N × 150 rows)             │
│  ├── executemany PriceDriverScore (N × 1050 rows)        │
│  ├── INSERT EconomicCycleState (N rows)                  │
│  ├── UPDATE SimulationState (1 row)                      │
│  ├── executemany Portfolio.total_value (1 per portfolio) │
│  └── commit                                              │
│                                                          │
│  Phase 4: POST-BULK BOOKKEEPING (optional)               │
│  ├── check_and_fill_limit_orders (1×)                    │
│  ├── evaluate_price_alerts (1×)                          │
│  ├── evaluate_watchlist_movers (1×)                      │
│  └── _execute_events (N ticks compressed, optional)      │
└─────────────────────────────────────────────────────────┘
```

### New Entry Point

```python
def bulk_run_ticks(
    session: Session,
    timeline_id: int,
    num_ticks: int = 1,
    skip_events: bool = True,       # §10 — fire only 1 batch of events after
    skip_limit_orders: bool = True, # §10 — one pass after all ticks
    skip_alerts: bool = True,       # §10 — one pass after all ticks
) -> list[dict]:
    """Run N ticks in memory, bulk-write once at the end."""
```

### Separation of Concerns

The bulk mode should be a **separate function** in `engine/orchestrator.py`, not a flag inside `run_ticks()`. Rationale:
- `run_ticks()` is the interactive / single-tick path (frontend "1D", "5D", "30D" buttons) — it must keep per-tick events+news visible.
- `bulk_run_ticks()` is the batch/fast-forward path (extend, scenario sweep, Monte Carlo) — throughput > granularity.

Both share the pure-engine functions (`_compute_drivers`, `engine_run_tick`, `_update_prices_and_ohlc`) — only the DB interaction changes.

---

## 4. Data Structures for In-Memory Tick Arrays

### 4.1 TickStateArrays — The Core Container

```python
@dataclass
class TickStateArrays:
    """Packed NumPy arrays / Python lists for N ticks of ~150 companies."""

    # ── Static (loaded once, never mutated mid-run) ──────────────────────
    timeline_id: int
    companies: list[Company]                          # ORM objects (read-only)
    company_by_id: dict[int, Company]                 # {cid: Company}
    industries: dict[int, Industry]                   # {id: Industry}
    industry_ids: list[int]
    params: dict[str, float]                          # ConfigParameter flat dict
    neutral_industry_pegs: dict[int, float]           # {industry_id: peg}
    timeline_chain: list[int]                         # resolved parent chain
    event_defs: dict[int, MarketEvent]                # {event_id: MarketEvent}

    # Financial statement caches (loaded once, mutated at quarter boundaries)
    latest_bal: dict[int, BalanceSheet]               # {cid: latest BS}
    latest_inc: dict[int, IncomeStatement]            # {cid: latest IS}
    latest_ce: dict[int, ConsensusEstimate]           # {cid: latest CE}
    latest_cfs: dict[int, CompanyFactorScore]         # {cid: latest CFS}

    # Factor-effect batch (loaded once)
    industry_pw: dict[int, dict[str, float]]
    subfactor_pillar: dict[str, str]
    moat_weights: dict[str, float]
    moat_rows_by_company: dict[int, list[MoatSubscore]]
    fq_subs_by_company: dict[int, list[FinancialQualitySubscore]]

    # Per-company random generators (seeded from timeline.rng_seed + offset)
    rngs: dict[int, random.Random]                   # {tick_number: Random}

    # ── Mutable per-tick state (updated in-place each tick) ──────────────
    current_sim_date: date
    current_tick_count: int

    # Cycle state — drifts every tick in memory
    cycle_phase: str
    f_m: float
    gdp_growth: float
    interest_rate: float
    market_sentiment: float

    # Price / IV overlays — the core in-memory arrays
    # Keyed by company_id, updated each tick with computed close/IV
    price_overlay: dict[int, float]                   # {cid: latest close}
    iv_overlay: dict[int, float]                      # {cid: latest IV}

    # Sliding window of recent closes for MA computation
    # Dict of deque(maxlen=ma_window), maintained in-memory
    recent_closes: dict[int, collections.deque[float]]

    # Previous tick's news_severity per company (for volume dampening)
    prev_ns: dict[int, float]

    # Sector shocks — recomputed only on cycle-phase change
    sector_shocks: dict[int, float]

    # Override maps (loaded once)
    driver_bias_map: dict[Optional[int], dict[str, float]]
    factor_score_bias_map: dict[Optional[int], dict[str, float]]
    cycle_transition_override: Optional[dict]

    # ── Deferred insertion buffers (§6) ──────────────────────────────────
    price_history_buffer: list[dict]                  # accumulated PH rows
    driver_score_buffer: list[dict]                   # accumulated PDS rows
    cycle_state_buffer: list[EconomicCycleState]      # accumulated cycle rows
    portfolio_total_value_updates: list[tuple[int, Decimal]]  # (pf_id, total_value)
    sim_state_final: Optional[dict]                   # final sim_state UPDATE

    # ── Quarter-boundary financials (accumulated) ────────────────────────
    quarter_financials_buffer: 'list[dict] | None'    # accumulated IS/BS/CFS/CE rows
```

### 4.2 PriceHistoryRow and PriceDriverScoreRow — Lightweight Insert DTOs

```python
@dataclass
class PriceHistoryRow:
    timeline_id: int
    company_id: int
    sim_date: date
    open: float
    high: float
    low: float
    close: float
    volume: int
    intrinsic_value: float
    order_imbalance: float

@dataclass
class PriceDriverScoreRow:
    timeline_id: int
    company_id: int
    sim_date: date
    driver_key: str
    value: float
    weight: float
    contribution: float
```

### 4.3 Per-Tick Computation DTO

```python
@dataclass
class TickMemoryOutput:
    """All outputs from one in-memory tick, before insertion buffering."""
    sim_date: date
    tick_count: int
    ohlc_results: dict[int, dict]           # {cid: {open, high, low, close}}
    volume_results: dict[int, int]           # {cid: volume}
    imbalance_results: dict[int, float]      # {cid: order_imbalance}
    tick_result: TickResult                  # engine's raw output
    tick_inputs: tuple[CompanyTickInput, ...]
    driver_scores: list[dict]               # prepared PDS row dicts
    price_history_rows: list[dict]          # prepared PH row dicts
```

### 4.4 num_ticks Memory Footprint Estimate

| Structure | Per-Tick Size | 252-Tick Total |
|-----------|--------------|----------------|
| PriceHistoryRows | 150 × ~400 bytes = 60 KB | ~15 MB |
| DriverScoreRows | 1050 × ~300 bytes = 315 KB | ~79 MB |
| EconomicCycleState | 1 × ~200 bytes = 200 B | ~50 KB |
| PortfolioMarks | ~10 × ~100 bytes = 1 KB | ~252 KB |
| Quarter financials (4×) | 150 × 4 × ~2 KB = ~1.2 MB | ~1.2 MB |
| **Total** | ~375 KB | **~96 MB** |

Memory is fine for SQLite (which runs in-process). Under PostgreSQL, the same pattern applies and 96 MB is trivial.

---

## 5. Read-It-Once Caching Strategy

### 5.1 Truly Static (load once, share across all N ticks)

These queries return identical results for any tick within the same bulk run:

| Cache Key | Source | Why Static |
|-----------|--------|-----------|
| `companies` | `session.query(Company).order_by(Company.id)` | No row changes mid-run |
| `industries` | `session.query(Industry)` | Seed data, immutable |
| `params` | `ConfigParameter(scope='global')` | Only changes via config UI |
| `neutral_industry_pegs` | `ConfigParameter(scope='industry', key='neutral_industry_peg')` | Same as above |
| `industry_pw` | `IndustryPillarWeight` | Seed data |
| `subfactor_pillar` | `FactorDefinition(factor_type='fq_sub')` | Seed data |
| `moat_weights` | `FactorDefinition(factor_type='moat_sub')` | Seed data |
| `event_defs` | `MarketEvent` by event_id set | Templates, immutable |
| `timeline_chain` | `get_timeline_chain(session, timeline_id)` | Parent chain never changes |
| `driver_bias_map` | TimelineOverride (active overrides) | Overrides expire on date, but bulk run is same period |
| `factor_score_bias_map` | Same | Same |
| `cycle_transition_override` | Same | Same |

### 5.2 Mutable-But-Batch-Loaded (load once, update at quarter boundaries)

| Cache Key | Update Trigger |
|-----------|---------------|
| `latest_bal` | Quarter boundary (every 63 ticks) |
| `latest_inc` | Quarter boundary |
| `latest_ce` | Quarter boundary |
| `latest_cfs` | Quarter boundary |
| `moat_rows_by_company` | Quarter boundary (event effects also mutate, but can be deferred) |
| `fq_subs_by_company` | Quarter boundary |

**Strategy**: Load these once at the start. When a quarter boundary is hit during the bulk run, refresh them by re-querying the latest rows for each company. The re-query costs ~6 batched SELECTs (one per table, IN on company_ids) — ~6× cheaper than doing it every tick.

### 5.3 Per-Tick State That Must Be Updated In-Memory

These change every tick and **cannot** be shared across ticks:

| State | Update Pattern |
|-------|---------------|
| `price_overlay` | Every tick: write new `close` from TickResult |
| `iv_overlay` | Every tick: apply IV drift |
| `f_m`, `cycle_phase`, `market_sentiment` | Every tick: cycle may advance |
| `recent_closes` | Every tick: append new close, pop oldest |
| `prev_ns` | Every tick: replace with current news_severity |
| `sector_shocks` | Every cycle-phase change |
| `rng` | Advance seed each tick |
| `current_sim_date` | +1 day each tick |
| `current_tick_count` | +1 each tick |

### 5.4 EventInstance Loading Strategy

Events are the trickiest read-only piece: new events can fire each tick,
and active events expire. Three strategies in order of preference:

**Option A (recommended for speed)**: Load all active EventInstances once
with a generous expiry window (`expires_on >= first_tick_sim_date`), load
once. During the in-memory loop, manually filter `expires_on >= current_sim_date`
in Python — no re-query. Events that expire mid-run are silently dropped;
new events that would have fired mid-run are skipped. This matches the
"skip non-essential work" ethos.

**Option B (for full accuracy)**: Re-query active EventInstances each tick
in the in-memory loop. This costs 2 queries/tick (EventInstance + MarketEvent
by event_id). Acceptable for small N (<30), defeats the purpose for large N.

**Option C (recommended)**: Fire events once per quarter boundary during
the bulk run (at most 4x for a year-long fast-forward). Between boundaries,
the EventInstance set is stable (no new events fire). This matches the
existing tick cadence — `_execute_events` already cascades from `select_and_fire_events`
which measures probability against `rng`, so re-running it on the same
quarter boundary with the same rng produces the same events.

**Recommendation**: Option C — fire events only on quarter boundaries within
the bulk run, never on intermediate ticks. This matches the existing pattern
where `_refresh_fundamentals` is the largest per-quarter cost and events are
tied to the firing schedule, not every tick.

---

## 6. Batch Deferred Writes

### 6.1 Insertion Buffers

The core optimization: instead of calling `session.execute(insert(...), rows)` every tick,
accumulate rows into Python lists and flush them once at the end.

```python
# During the in-memory loop (Phase 2):
price_history_buffer: list[dict] = []
driver_score_buffer: list[dict] = []
cycle_state_buffer: list[EconomicCycleState] = []
quarter_financials_buffers: dict[str, list] = {
    "income_statements": [],
    "balance_sheets": [],
    "cash_flow_statements": [],
    "consensus_estimates": [],
    "company_factor_scores": [],
    "financial_quality_subscores": [],
}

for tick_i in range(num_ticks):
    # compute everything...
    price_history_buffer.extend(price_history_rows)
    driver_score_buffer.extend(driver_score_rows)

# After the loop (Phase 3):
session.execute(insert(PriceHistory), price_history_buffer)
session.execute(insert(PriceDriverScore), driver_score_buffer)
session.add_all(cycle_state_buffer)
# quarter financials...
session.flush()
session.commit()
```

### 6.2 The executemany Advantage

SQLAlchemy's `session.execute(insert(Model), list_of_dicts)` under the hood
calls DBAPI `executemany()`, which for SQLite compiles to a single
`INSERT INTO t (...) VALUES (?), (?), ...` statement — a single transaction
commit cost instead of N × 150.

### 6.3 Memory Flush Threshold

For very large N (e.g. Monte Carlo with 1000+ ticks), buffering all rows
in memory could be excessive. Add a configurable flush interval:

```python
bulk_run_ticks(
    session, timeline_id, num_ticks=1000,
    flush_interval=100,  # flush to DB every 100 ticks
    ...
)
```

When `flush_interval` rows are accumulated, issue an intermediate
`session.execute(insert(...))` + `session.flush()` (no commit — stay in
a single transaction). This keeps memory bounded while still
dramatically reducing per-tick overhead.

### 6.4 SimulationState Pointer Updates

Instead of writing `sim_state.current_sim_date = next_date` every tick,
compute the final date at the end:

```python
# Phase 2 — in-memory only:
current_date = start_date
for _ in range(num_ticks):
    compute_tick(current_date, ...)
    current_date += timedelta(days=1)

# Phase 3 — single write:
sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
sim_state.current_sim_date = current_date
sim_state.tick_count = sim_state.tick_count + num_ticks
sim_state.is_running = True
```

### 6.5 EconomicCycleState Accumulation

Each tick that transitions to a new cycle phase inserts one row.
During bulk mode, accumulate `EconomicCycleState` instances and
`session.add_all()` at the end. Do NOT query existence each tick —
the idempotency check (`session.query(EconomicCycleState).filter_by(...).first()`)
is the most expensive query in the cycle block (a full table scan on
`(timeline_id, sim_date)`).

**Optimization**: Track the in-memory cycle phase history in a simple
list. On a phase change, push a row to `cycle_state_buffer`. At flush
time, insert only the needed rows.

---

## 7. SQLite WAL + Pragma Tuning

SQLite is the development/test backend. These pragmas give the biggest
speedup for bulk insert workloads.

### 7.1 Essential Pragmas (set at engine creation)

```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragmas(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    # Write-Ahead Logging — allows concurrent reads during writes
    cursor.execute("PRAGMA journal_mode=WAL")
    # Synchronous mode: NORMAL is safe with WAL (FULL kills insert perf)
    cursor.execute("PRAGMA synchronous=NORMAL")
    # Cache size: 1 GB cache for bulk operations
    cursor.execute("PRAGMA cache_size=-1000000")
    # Page size: 64 KB for OLTP with bulk inserts
    cursor.execute("PRAGMA page_size=65536")
    # Temp store: keep temp tables in memory
    cursor.execute("PRAGMA temp_store=MEMORY")
    # MMAP size: 256 MB memory-map for read queries
    cursor.execute("PRAGMA mmap_size=268435456")
    cursor.close()
```

### 7.2 Per-Bulk-Session Pragmas

For the bulk_write session specifically (not the interactive session):

```python
# Before the bulk flush:
conn = session.connection()
conn.exec_driver_sql("PRAGMA synchronous=OFF")    # WAL + synchronous=OFF is the
                                                    # fastest insert path — data
                                                    # is WAL-protected against crash
                                                    # but may lose last N ms on power loss
conn.exec_driver_sql("PRAGMA journal_mode=WAL")   # already set, but re-assert
conn.exec_driver_sql("PRAGMA cache_size=-2000000") # 2 GB for the flush
```

### 7.3 Expected Speedup

| Pragma Setting | Inserts/sec (approx) | Notes |
|---------------|----------------------|-------|
| Default (journal=delete, synchronous=FULL) | 500–2,000 | Painful for 1200 rows/tick |
| WAL + NORMAL | 5,000–20,000 | Good for interactive |
| WAL + OFF + cache_size=-2GB | 20,000–80,000 | Best for bulk flush |
| Deferred + executemany + WAL+OFF | 100,000+ | Our target: 120K rows in <2s |

### 7.4 Caveat: Post-Bulk Reset

After a bulk operation, restore safe pragmas for the interactive session:

```python
conn.exec_driver_sql("PRAGMA synchronous=FULL")   # back to crash-safe
conn.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")  # shrink WAL
```

---

## 8. Index Strategy

### 8.1 Current Indexes vs Bulk Mode Requirements

Current indexes (from model definitions):

| Table | Current Index | Bulk-Relevant? |
|-------|--------------|----------------|
| `price_history` | `uq_price_history_company_timeline_date` (composite unique) | High |
| `price_driver_scores` | `uq_price_driver_scores_company_timeline_date_driver` | High |
| `economic_cycle_states` | `uq_economic_cycle_states_timeline_date` | High |
| `company_factor_scores` | `uq_company_factor_scores_company_period` + `ix_company_factor_scores_timeline_id` | Medium |
| `event_instances` | `ix_event_instances_timeline_expires` | Medium |
| `timelines` | `ix_timelines_parent_timeline_id`, `ix_timelines_timeline_group_id` | Low |

### 8.2 Composite Indexes That Eliminate Table Scans

**Critical for `_load_tick_state`:**

```sql
-- Price_history: batch-latest lookup per company within a timeline
-- The current unique constraint (company_id, timeline_id, sim_date) already
-- serves as an index. But get_latest_prices/_latest_column_batch does:
--   WHERE timeline_id=? AND company_id IN (...)
--   ORDER BY company_id, sim_date DESC
-- A covering index on (timeline_id, company_id, sim_date DESC) would let
-- the query use INDEX-ONLY scans, no table access.
-- SQLite lacks DESC index support, but composite still helps:
CREATE INDEX ix_price_history_timeline_company_date
  ON price_history(timeline_id, company_id, sim_date);

-- Price_driver_scores: per-timeline per-company per-date lookup
-- _load_tick_state queries prev news_severity with:
--   WHERE timeline_id=? AND sim_date=? AND driver_key='news_severity'
CREATE INDEX ix_pds_timeline_date_driver
  ON price_driver_scores(timeline_id, sim_date, driver_key);

-- Economic_cycle_state: per-timeline latest date
-- Query pattern: WHERE timeline_id=? ORDER BY sim_date DESC
-- A simple (timeline_id, sim_date) index replaces the full table scan for
-- the "latest cycle state" query that runs every tick:
CREATE INDEX ix_ecs_timeline_date
  ON economic_cycle_states(timeline_id, sim_date);
```

**Medium priority — improves batch-insert conflict detection:**

```sql
-- Price_history unique constraint already serves, but for conflict detect
-- in bulk mode we batch-check existence before insert:
--   WHERE (company_id, timeline_id, sim_date) IN (...)
-- SQLite doesn't support row-value IN, so use:
--   WHERE timeline_id=? AND sim_date=? AND company_id IN (...)
-- The existing uq_* composite index covers this (company_id leads).
-- While the existing unique constraints serve as functional indexes,
-- adding a covering index for (timeline_id, company_id, sim_date)
-- helps the ORDER BY ... DESC LIMIT 1 pattern used by get_latest_price
-- (the parent-chain walk in timeline_resolver.py).
```

### 8.3 Index Maintenance During Bulk Insert

Each row inserted during the bulk flush triggers SQLite index updates
for every index on `price_history` and `price_driver_scores`. With
150 companies × 252 ticks = 37,800 PH rows and 264,600 PDS rows, the
index maintenance cost is significant.

**Strategy**: Drop indexes before bulk flush, re-create after:

```python
def _bulk_drop_indexes(session):
    conn = session.connection()
    conn.exec_driver_sql(
        "DROP INDEX IF EXISTS ix_price_history_timeline_company_date"
    )
    conn.exec_driver_sql(
        "DROP INDEX IF EXISTS ix_pds_timeline_date_driver"
    )
    conn.exec_driver_sql(
        "DROP INDEX IF EXISTS ix_ecs_timeline_date"
    )

def _bulk_create_indexes(session):
    conn = session.connection()
    conn.exec_driver_sql(
        "CREATE INDEX ix_price_history_timeline_company_date "
        "ON price_history(timeline_id, company_id, sim_date)"
    )
    conn.exec_driver_sql(
        "CREATE INDEX ix_pds_timeline_date_driver "
        "ON price_driver_scores(timeline_id, sim_date, driver_key)"
    )
    conn.exec_driver_sql(
        "CREATE INDEX ix_ecs_timeline_date "
        "ON economic_cycle_states(timeline_id, sim_date)"
    )
```

This drops reindex time from O(N log N) to O(N) insert + O(M log M) rebuild,
which is 3–5× faster for 37K+ rows.

**Safety**: Only do this inside the bulk run function. The interactive path
keeps indexes live at all times.

---

## 9. Parallel DB Writes

### 9.1 Session-level parallelism

SQLite's WAL mode supports concurrent reads but only one writer at a time.
Parallelizing writes into the same database is impossible for SQLite.

For **PostgreSQL**, the picture is different:

### 9.2 Chunked INSERTs with executemany

Already covered in §6 — `session.execute(insert(...), rows)` is a single
`executemany` call. SQL engines batch the rows internally, so 37,800 PH
rows flush in one network round-trip.

For very large batches (>100K rows), chunk:

```python
CHUNK_SIZE = 50_000
for i in range(0, len(price_history_buffer), CHUNK_SIZE):
    chunk = price_history_buffer[i:i+CHUNK_SIZE]
    session.execute(insert(PriceHistory), chunk)
```

### 9.3 COPY-based Bulk Insert (PostgreSQL only)

For future-proofing on PostgreSQL, consider `COPY` instead of INSERT:

```python
# Via SQLAlchemy core + psycopg2 copy
import io
csv_buf = io.StringIO()
writer = csv.writer(csv_buf)
for row in price_history_buffer:
    writer.writerow([row['timeline_id'], row['company_id'], ...])
csv_buf.seek(0)
conn.connection.driver_connection.copy_from(
    csv_buf, 'price_history',
    columns=['timeline_id', 'company_id', ...],
    sep=','
)
```

`COPY` is ~5× faster than batched INSERT for PostgreSQL. Not needed for
SQLite (executemany is already optimal there).

### 9.4 Thread-level Parallelism

For Monte Carlo (N independent timelines), use `concurrent.futures.ThreadPoolExecutor`:
each thread gets its own SQLite connection to a separate database file,
runs a full bulk_run_ticks, writes results, and the final reduction reads
all outputs. This is the **only** form of parallelism that makes sense for
SQLite — multiple WAL writers to different files, never the same file.

---

## 10. Skip Non-Essential Work During Bulk Runs

### 10.1 Classification of Post-Tick Work

| Work Item | Essential for correctness? | Deferrable? | Strategy |
|-----------|---------------------------|-------------|----------|
| `_write_tick_results` | ✅ Yes | No (write path) | Deferred batch (§6) |
| `_mark_to_market` | ✅ Yes (portfolio value) | ✅ Yes | One mark at end |
| `_execute_events` (fire+news) | ❌ No (cosmetic) | ✅ Yes | Fire once per quarter max; skip entirely for pure price simulation |
| `_apply_event_factor_effects` | ⚠️ Partial (affects factor scores) | ✅ Yes | Accumulate and apply once at end |
| `_apply_timeline_factor_score_overrides` | ⚠️ Partial | ✅ Yes | Same — apply once at end |
| `_update_denormalized_fields` | ❌ No (shared cache) | ✅ Yes | Skip; not needed for non-live |
| `_refresh_fundamentals` (quarter boundary) | ✅ Yes (drives next quarter's EPS/growth) | ❌ No | **Must** run on quarter boundaries within the loop |
| `_generate_concalls_for_quarter` | ❌ No (narrative only) | ✅ Yes | Skip entirely in bulk mode |
| `check_and_fill_limit_orders` | ✅ Yes (user trades) | ✅ Yes | One pass after all ticks |
| `evaluate_price_alerts` | ✅ Yes (user notifications) | ✅ Yes | One pass after all ticks |
| `evaluate_watchlist_movers` | ✅ Yes (user notifications) | ✅ Yes | One pass after all ticks |

### 10.2 Skip Configuration

```python
def bulk_run_ticks(
    session,
    timeline_id,
    num_ticks,
    # What to skip during the in-memory loop:
    skip_events=True,           # don't fire new EventInstances mid-run
    skip_concalls=True,         # don't generate ConCall rows at quarter boundaries
    skip_news=True,             # don't write NewsFeed rows
    skip_denormalized=True,     # don't update Company.current_price etc.
    skip_factor_effects=True,   # don't apply event factor-score effects mid-run
    # What to do once after all ticks:
    run_limit_orders=True,      # one pass of check_and_fill_limit_orders
    run_price_alerts=True,     # one pass of evaluate_price_alerts
    run_watchlist_movers=True, # one pass of evaluate_watchlist_movers
)
```

### 10.3 Quarter Boundary Must-Run

`_refresh_fundamentals` is **non-skippable** because it generates new
EPS/revenue/margins that drive the next quarter's price behavior. Without it,
a 252-tick bulk run would keep the same stale financials for all 252 days.

The design handles this by:

```python
# Inside the in-memory loop:
for tick_i in range(num_ticks):
    is_quarter_boundary = tick_i > 0 and tick_i % QUARTER_LENGTH == 0

    if is_quarter_boundary:
        # Re-query latest financials (they just got replaced by refresh)
        _refresh_in_memory_financials(state, session, timeline_id, companies)

        # Fire events (Option C from §5.4)
        if not skip_events:
            _execute_events(session, timeline_id, state, sim_date, companies)
```

### 10.4 Portfolio Mark-to-Market

During the in-memory loop, track portfolio value contributions by accumulating
`(portfolio_id, company_id, quantity, close_price)` contributions per tick.
At flush time, compute the final `total_value` from the last tick's closes:

```python
# Phase 2 optimization — don't query Portfolio/Holding each tick.
# We can compute total_value from:
#    pf.cash_balance  (loaded once, unchanged during loop)
#  + sum(h.quantity * price_overlay[h.company_id])  for h in holdings

# Phase 3 — single write per portfolio:
for pf in portfolios:
    holdings_value = sum(
        qty * price_overlay[cid]
        for cid, qty in portfolio_holdings[pf.id].items()
    )
    pf.total_value = (pf.cash_balance + holdings_value).quantize(...)
```

---

## 11. Frontend-Backend Protocol Changes

### 11.1 Current Protocol

The frontend advances the simulation via:

```typescript
// SimControlPanel.tsx — manual advance
advance.mutate({ timeline_id, days: N })  // N in {1, 5, 30}

// Live mode — chains 1-day advances at 150ms intervals
function fireNext() {
    advanceRef.current.mutate(
        { timeline_id, days: 1 },
        { onSettled: () => setTimeout(fireNext, LIVE_TICK_GAP_MS) }
    );
}
```

Each `POST /sim/advance` → `advance_simulation()` → `run_ticks(db, id, 1)`
→ full DB cycle per tick. Even `days=30` runs 30 ticks sequentially in the
same request — no streaming, no progress updates.

### 11.2 Proposed Protocol: Advance with Bulk Flag

Add a `mode` parameter to the advance endpoint:

```typescript
// New request shape
interface BulkAdvanceRequest {
    timeline_id: number;
    days: number;
    mode?: 'interactive' | 'bulk';   // default: 'interactive'
    skip_events?: boolean;
    skip_news?: boolean;
}

// New response shape for bulk mode
interface BulkAdvanceResponse extends AdvanceResponse {
    // Interactive mode fields...
    ticks_executed: number;
    new_sim_date: string;
    tick_count: number;
    cycle_phase: string | null;
    // Bulk mode additions:
    mode: 'bulk' | 'interactive';
    duration_ms: number;
    ticks_per_second: number;
}
```

### 11.3 Frontend Live Mode: Tick Skips

**Problem**: Live mode does `days=1` at 150ms intervals — 6.7 ticks/second
max, but a single tick takes 200-600ms with 150 companies. So the "150ms gap"
actually becomes 200-600ms of real wait time between ticks.

**Solution**: In live mode, advance by larger batches at lower frequency:

```typescript
// New live mode — advance 5 ticks at a time, update UI once
const LIVE_BATCH_SIZE = 5;       // process 5 ticks per request
const LIVE_UPDATE_MS = 1000;     // update UI at most once per second

function fireNext() {
    if (cancelled) return;
    advanceRef.current.mutate(
        { timeline_id, days: LIVE_BATCH_SIZE, mode: 'bulk', skip_events: true, skip_news: true },
        { onSettled: () => {
            if (!cancelled) timeoutId = setTimeout(fireNext, LIVE_UPDATE_MS);
        }}
    );
}
```

This gives 5 ticks per second at 1000ms update interval — comparable to
current speed but with **5× fewer DB round-trips** and smoother UI updates.

### 11.4 WebSocket Streaming for Very Long Advances

For `days >= 252` (a full year), the HTTP request times out. Replace the
synchronous POST with a WebSocket stream:

```
WS /ws/advance/{timeline_id}
→ {"action": "advance", "days": 252, "mode": "bulk"}
← {"event": "tick_progress", "tick": 50, "total": 252, "sim_date": "2027-03-15"}
← {"event": "tick_progress", "tick": 100, "total": 252, "sim_date": "2027-06-01"}
...
← {"event": "complete", "ticks_executed": 252, "duration_ms": 45000}
```

The backend pushes progress updates every `flush_interval` ticks (e.g. every 25).

### 11.5 UI Changes

The speed slider (currently unused in the codebase but implied by the
design) could control `LIVE_BATCH_SIZE`:

| Slider Value | Batch Size | Real Speed |
|-------------|-----------|------------|
| 1× (slow) | 1 | ~1 tick/600ms |
| 5× (medium) | 5 | ~5 ticks/sec |
| 25× (fast) | 25 | ~25 ticks/sec |
| 100× (turbo) | 100 | ~100 ticks/sec |
| Max | num_ticks | Single flush |

---

## 12. Edge Cases & Consistency Guarantees

### 12.1 Crash During Bulk Flush

If the process crashes mid-flush (Phase 3), the entire bulk run is lost —
no partial data persisted. This is acceptable because:
- The bulk run's transaction only commits at the very end.
- No intermediate state is visible to users.
- The caller can retry the entire bulk operation.

### 12.2 RNG Reproducibility

In current `run_ticks`, `rng = random.Random(timeline.rng_seed + tick_count)`.
In bulk mode, the tick_count for each in-memory tick is absolute
(`start_tick + i`), so the seed is deterministic regardless of whether
the ticks were run in bulk or individually.

```python
# Correct — produces identical results to serial run_ticks
for i in range(num_ticks):
    absolute_tick = start_tick + i
    rng = random.Random(timeline.rng_seed + absolute_tick)
    compute_drivers_for_tick(rng, ...)
```

### 12.3 Quarter Boundary Correctness

Quarter boundaries are detected as `tick_count > 0 and tick_count % 63 == 0`.
In the in-memory loop, `tick_count` starts at `sim_state.tick_count` and
increments each iteration. A boundary falls at the exact same absolute
tick as it would in serial mode.

**Important**: `_refresh_fundamentals` issues DB writes (IncomeStatement,
BalanceSheet, etc.) even in bulk mode — these are inside the deferred
buffer. The per-company EPS/revenue for the new quarter is computed from
in-memory cached financials (`latest_inc`, etc.), which are consistent
because they were loaded at the start of the bulk run from the same DB
state a serial run would see.

### 12.4 EventInstance Expiry During Run

If an EventInstance expires mid-bulk-run, the in-memory code filters it
out by comparing `expires_on >= current_sim_date`. New events that would
have fired on intermediate ticks are skipped (per §5.4 Option C).

**Trade-off**: The bulk run produces slightly different price paths than
serial run_ticks because events that fire inside the gap between quarter
boundaries are omitted. For fast-forward/extend operations (scenario
sweeps, Monte Carlo), this is the correct trade-off — the user wants to
see "what would the market do under this config" without being distracted
by random news events. For full fidelity, the caller sets `skip_events=False`,
which re-queries events each tick (at the cost of 2 SELECTs/tick).

### 12.5 Parent Chain Fallback

For non-live (branch) timelines, `get_latest_prices` and
`get_latest_intrinsic_values` resolve against the parent chain.
During the in-memory loop, the `price_overlay` and `iv_overlay` arrays
are initialized from this fallback and then updated each tick with the
branch's own computed prices — no re-query needed.

### 12.6 ConfigParameter Override Consistency

ConfigParameter overrides (TimelineOverride) are loaded once and applied
to params once, before the loop. They remain consistent across all N
ticks. If an override's `active_from`/`active_until` spans only part of
the bulk interval, the override is either applied to all ticks or none —
mid-run override transitions are not supported in bulk mode.

---

## 13. Implementation Plan

### Phase 1: Core Data Structures + Refactoring

1. Add the `TickStateArrays` dataclass and supporting DTOs to
   `engine/orchestrator.py`.
2. Extract a pure `_load_static_tick_state(session, timeline_id)` function
   that returns the load-once subset (companies, industries, params,
   industry_pw, moat_weights, etc.).
3. Extract a pure `_load_mutable_tick_state(session, timeline_id, companies)`
   function that returns the load-on-query subset (price_overlay,
   iv_overlay, recent_closes, prev_ns, active events).

### Phase 2: In-Memory Tick Loop

4. Implement `_bulk_tick_iteration(state: TickStateArrays, sim_date, tick_count)`
   — a pure function that runs one tick entirely from in-memory state and
   returns `TickMemoryOutput`.
5. Implement the accumulation loop in `bulk_run_ticks()`:
   load state once → iterate N ticks → buffer results.

### Phase 3: Deferred Write + SQLite Pragmas

6. Add SQLAlchemy event listener for `Engine.connect` to set WAL pragmas.
7. Implement `_bulk_flush(session, buffers)` that uses `executemany` for
   each table.
8. Add `flush_interval` support for memory-boundedness.

### Phase 4: Index Management

9. Add `_bulk_drop_indexes` / `_bulk_create_indexes` helpers.
10. Call them around the bulk flush.

### Phase 5: Frontend Protocol

11. Add `mode: 'bulk' | 'interactive'` parameter to `/sim/advance`.
12. Update `advance_simulation()` to call `bulk_run_ticks` when mode='bulk'.
13. Update `useAdvance` / `useSimState` hooks to support BulkAdvanceResponse.
14. Add WebSocket streaming endpoint for very long advances.

### Phase 6: Skip Non-Essential Work

15. Implement `skip_*` flags in `bulk_run_ticks`.
16. Implement post-bulk limit order fill, price alert, watchlist mover pass.

### Phase 7: Testing

17. Verify determinism: `bulk_run_ticks(N)` produces same price paths as
    N `run_ticks()` calls for N=5, 63, 252, across all company permutations.
18. Benchmark: measure ticks/sec improvement for various flush_intervals and
    N values.

---

## 14. Appendix: Full Per-Tick DB Query Catalog

For reference, here is every DB interaction that happens during one tick,
cross-referenced against the bulk-mode strategy.

### Phase: _resolve_tick_target_date / idempotency check

| Query | Strategy |
|-------|----------|
| `PriceHistory.filter_by(timeline_id, sim_date).first()` | ❌ Not needed — bulk mode skips idempotency check entirely (first-tick check exits early). |

### Phase: _load_tick_state

| Query | Strategy |
|-------|----------|
| `Timeline.filter_by(id=X)` | ✅ Once per run (static) |
| `SimulationState.filter_by(timeline_id=X)` | ✅ Once — pointer updated in-memory |
| `ConfigParameter.filter_by(scope='global')` | ✅ Once per run |
| `ConfigParameter.filter_by(key='neutral_industry_peg', scope='industry')` | ✅ Once per run |
| `TimelineOverride.filter_by(timeline_id=X)` | ✅ Once per run |
| `EconomicCycleState.filter_by(timeline_id=X).order_by(sim_date.desc()).first()` | ❌ N/A in bulk — cycle state tracked in-memory |
| `Company.order_by(Company.id)` | ✅ Once per run |
| `Industry.order_by(Industry.id)` | ✅ Once per run |
| `PriceHistory (get_latest_prices via parent chain)` | ❌ N/A — initialized once via batch query; then updated in-memory |
| `PriceHistory (get_latest_intrinsic_values)` | ❌ N/A — same as prices |
| `PriceHistory (recent closes for MA window)` | ❌ N/A — sliding window maintained in-memory |
| `PriceDriverScore (prev news_severity)` | ❌ N/A — maintained in-memory |
| `BalanceSheet (all, timeline-scoped)` | ✅ Once per run; re-query at quarter boundaries |
| `IncomeStatement (all, timeline-scoped)` | ✅ Once per run; re-query at quarter boundaries |
| `ConsensusEstimate (all, timeline-scoped)` | ✅ Once per run; re-query at quarter boundaries |
| `CompanyFactorScore (all, timeline-scoped)` | ✅ Once per run; re-query at quarter boundaries |
| `EventInstance (active, expires_on >= sim_date)` | ✅ Once per run (with wide window); filter in-memory |
| `MarketEvent (by event_ids)` | ✅ Once per run |

### Phase: _compute_drivers

No DB access — all state sourced from `TickStateArrays`.

### Phase: _write_tick_results

| Query | Strategy |
|-------|----------|
| `INSERT INTO price_history (executemany)` | ✅ Deferred buffer → one bulk executemany |
| `INSERT INTO price_driver_scores (executemany)` | ✅ Deferred buffer → one bulk executemany |

### Phase: _mark_to_market

| Query | Strategy |
|-------|----------|
| `Portfolio.filter_by(timeline_id=X)` | ✅ Once per run (cache portfolio list + holdings) |
| `Holding.filter_by(portfolio_id=p)` | ✅ Once per run (cache holdings per portfolio) |
| `pf.total_value = ...` (UPDATE) | ✅ Deferred buffer → bulk UPDATE at end |

### Phase: _execute_events

| Query | Strategy |
|-------|----------|
| EventInstance/MarketEvent queries in select_and_fire_events | ✅ Skipped or once per quarter boundary |
| NewsFeed INSERTs | ✅ Skipped entirely in bulk mode |
| CompanyFactorScore mutation (apply_effect_to_factor_scores) | ✅ Skipped; applied once at end if needed |

### Quarter-boundary phase: _refresh_fundamentals

| Query | Strategy |
|-------|----------|
| IndustryPillarWeight | ✅ Once per run |
| FactorDefinition (fq_sub + moat_sub) | ✅ Once per run |
| MoatSubscore (all, timeline-scoped) | ✅ Once per run; re-query at quarter |
| CompanyFactorScore (all, timeline-scoped) | ✅ Once per run; re-query at quarter |
| FinancialQualitySubscore (all, timeline-scoped) | ✅ Once per run; re-query at quarter |
| PriceHistory (quarter-start close) | ✅ Once per quarter boundary |
| EventInstance (quarter event sentiment) | ✅ Once per quarter boundary |
| IncomeStatement/BalanceSheet/CashFlowStatement INSERTs | ✅ Deferred buffer at quarter boundary |

---

*End of design document.*
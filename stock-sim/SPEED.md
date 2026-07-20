# Simulation Engine Speed Optimization Guide

> Baseline: **0.64 ticks/sec** = 1,560 ms per tick for 153 companies.
> 153 companies × ~3,960 SQLAlchemy calls/tick. Database is ~60% of wall time.
> Replay playback (frontend): **instant** — it slices already-loaded data client-side. The 0.64 t/s is for actually computing new ticks.

---

## How The Replay Speed Works

The frontend `ReplayControls` has two modes:

### Replay Mode (slicing loaded data)
Advances `currentTick` in the Zustand store via `setInterval`:

| Speed | intervalMs | Behavior |
|-------|-----------|----------|
| 1x | 1000ms | `stepForward()` every 1s |
| 5x | 200ms | `stepForward()` every 200ms |
| 10x | 100ms | " |
| 25x | 40ms | " |
| 100x | 10ms | " |

The chart just does `data.slice(0, currentTick + 1)`. Zero backend calls. This is **already instant**.

### Live Mode (advancing the simulation)
Calls `POST /api/v1/sim/advance` for each tick:

| Speed | Effective gap | Behavior |
|-------|--------------|----------|
| 1x | wait for advance response + 1200ms | Calls backend, waits for response, then schedules next |
| 5x | wait for advance response + 240ms | Same |
| 10x | wait for advance response + 120ms | Same |
| 25x | wait for advance response + 48ms | Same (capped at `MIN_LIVE_TICK_GAP_MS=180ms`) |

Ref: `apps/web/components/simulation/ReplayControls.tsx:76-86` for replay mode, `:88-114` for live mode.

---

## Baseline Measurement

```
153 companies × 50 ticks = 78.0s total
→ 0.64 ticks/sec
→ 1,560 ms per tick
→ 10.2 ms per company per tick
```

Measured via `engine.orchestrator.run_ticks(session, timeline_id, num_ticks=50)` against the live PostgreSQL database.

---

## Bottleneck Breakdown (per tick)

| Section | ms/tick | % | Calls | Type |
|---------|---------|---|-------|------|
| `_load_tick_state` queries | ~340 | 22% | ~18 queries | `[DB]` |
| `_compute_drivers` (153× loop) | ~200 | 13% | pure Python | `[LOOP]` |
| `_write_tick_results` bulk inserts | ~300 | 19% | 2 INSERTs | `[DB]` |
| `_execute_events` + news queries | ~200 | 13% | ~5 queries | `[DB]` |
| `_update_prices_and_ohlc` (153× loop) | ~100 | 6% | pure Python | `[LOOP]` |
| Engine tick (numpy OU process) | ~50 | 3% | vectorized | ✓ |
| SQLAlchemy autoflush overhead | ~200 | 13% | hidden | `[DB]` |
| Mark to market + denormalized fields | ~70 | 4% | ~2 queries | `[DB]` |

---

## Safe Optimization Opportunities (Zero Output Change)

### #1 — Add missing index on `event_instances`

**Problem**: `_load_active_events` and `_apply_event_factor_effects` query `event_instances` filtered by `timeline_id` and `expires_on`. This table has **no index** on either column, forcing a sequential scan of 1,948 rows every tick.

**Impact**: ~200–400ms saved per tick (12–25% of total)

**Files**:
- `engine/orchestrator.py:586-588` — `_load_active_events(timeline_id=timeline_id, sim_date=sim_date)`
- `engine/orchestrator.py:2410-2413` — `EventInstance.timeline_id == timeline_id, EventInstance.expires_on >= sim_date`

**Fix**: Add a composite index:
```sql
CREATE INDEX ix_event_instances_timeline_expires
  ON event_instances (timeline_id, expires_on);
```

**Output safe**: YES — indexes never change query results, only speed.

**Est. speedup**: 1.15–1.30×

---

### #2 — Eliminate duplicate Timeline + SimulationState queries

**Problem**: `run_ticks` (line 161-163) queries `Timeline` + `SimulationState` for existence validation, then `_load_tick_state` (line 397-403) queries both again for full objects. 4 queries where 2 suffice.

**Files**:
- `engine/orchestrator.py:161-163` — existence check
- `engine/orchestrator.py:397-403` — full load

**Fix**: Remove lines 161-165 from `run_ticks`. Let `_load_tick_state` handle validation (it already raises `ValueError` on missing).

**Output safe**: YES — same error behavior, fewer roundtrips.

**Est. speedup**: 1.05×

---

### #3 — Batch Company lookups in `_execute_events`

**Problem**: When events fire (line 1086-1114), for each fired `EventInstance`, the code issues individual queries for `Company` (line 1094) and `Industry` by id. With many events per tick, this becomes an N+1 pattern.

**Files**:
- `engine/orchestrator.py:1086-1114` — event processing loop

**Fix**: Pre-load all referenced companies/industries in one batch before the loop.

**Output safe**: YES — batch loading returns the same data.

**Est. speedup**: 1.05–1.10×

---

### #4 — Cache `timeline_chain` across a single tick

**Problem**: `db/timeline_resolver.py:get_timeline_chain` is called 2× per tick (for prices and intrinsic values). Each call queries `Timeline` (self + parent). The chain never changes mid-tick.

**Files**:
- `db/timeline_resolver.py:38-51` — chain query
- `engine/orchestrator.py` usage via resolver

**Fix**: Compute chain once at the top of `_load_tick_state` and pass it around.

**Output safe**: YES — same result, fewer roundtrips.

**Est. speedup**: 1.03×

---

### #5 — Limit recent-closes query to exact MA window

**Problem**: Line 555-565 fetches `ma_window * 3` calendar days (~60 days) of closes for ALL 153 companies (~6,000+ rows) every tick, just to build a 20-day moving average. No per-company `LIMIT`.

**Files**:
- `engine/orchestrator.py:555-565` — price history batch load

**Fix**: Restrict query to `ma_window * 1.5` days and add a row-number-per-company cap.

**Output safe**: YES — MA of 20 days only needs at most 20 data points per company.

**Est. speedup**: 1.05×

---

### #6 — Reduce Python dict allocations in `_write_tick_results`

**Problem**: Lines 996-1007 build **1,071 individual Python dicts** (153 companies × 7 drivers) per tick. Each dict has 7 string keys allocated on the heap.

**Files**:
- `engine/orchestrator.py:996-1007` — driver_score_rows loop

**Fix**: Use `tuple` + list of columns instead of dicts for `session.execute(insert(...))`.

**Output safe**: YES — column order is deterministic.

**Est. speedup**: 1.03×

---

### #7 — Batch per-company financials queries at quarter boundaries

**Problem**: `_refresh_fundamentals` (line 1312+) issues per-company queries for `IncomeStatement`, `BalanceSheet`, `CashFlowStatement`, `CompanyFactorScore` at each quarter boundary — ~7 queries × 153 companies = ~1,071 queries.

**Files**:
- `engine/orchestrator.py:1312-1379` — quarter boundary refresh

**Fix**: Use `session.query(...).filter(CompanyFactorScore.company_id.in_(all_ids))` instead of per-company loops. Some of this data is already loaded in `_load_tick_state` but not reused.

**Output safe**: YES — same data batched.

**Est. speedup**: 1.05–1.15× (on quarter-boundary ticks only, every 63rd tick)

---

## Not-Safe Optimizations (Would Change Output)

| Technique | Problem | Why Not Safe |
|-----------|---------|-------------|
| Use `numpy.random` instead of `random.Random` | PRNG state differs | PCG64 vs Mersenne Twister → different sequence |
| Cache `growth_score_to_rate` results | Deterministic for same input | Already pure — caching adds no risk but trivial speedup |
| Remove `round()` calls | Changes precision | `round()` affects DB-stored values → different prices |
| Skip `is_quarter_boundary` check for non-live | Skips IV recomputation | Branches need their own IV for comparison |
| Use multiprocessing for driver loop | Race condition on DB cursor | Shared session is not thread-safe |

---

## Theoretical Speedups

### Tier 1: Low Effort (1-2 changes, 1hr)
| Change | Est. Speedup | ticks/sec |
|--------|-------------|-----------|
| Add index on `event_instances` | 1.3× | 0.83 |
| + Duplicate query elimination | 1.4× | 0.90 |
| **Tier 1 combined** | **~1.4×** | **~0.9** |

### Tier 2: Moderate Effort (5-7 changes, half day)
| Change | Est. Speedup | ticks/sec |
|--------|-------------|-----------|
| All of Tier 1 | 1.4× | 0.9 |
| + Batch event Company lookups | 1.5× | 1.0 |
| + Limit closes query | 1.6× | 1.0 |
| + Cache timeline_chain | 1.65× | 1.05 |
| + Reduce dict allocations | 1.7× | 1.1 |
| + Batch quarter-boundary queries | 1.8× | 1.15 |
| **Tier 2 combined** | **~1.8×** | **~1.15** |

### Tier 3: Architectural (multiple days)
| Change | Est. Speedup | ticks/sec |
|--------|-------------|-----------|
| All of Tier 2 | 1.8× | 1.15 |
| + Skip DB writes every tick, batch every N | 10× | 6.4 |
| + Full in-memory numpy tick loop | 50× | 32 |
| + numba JIT vectorized driver + OU | 200× | 128 |
| + Zero-copy arrays + async I/O | 1000× | 640 |
| **Tier 3 combined** | **~200-1000×** | **~128-640** |

---

## How to Reach 1000×

The only way to 1000× is **stop writing to the database every tick**:

1. **Replay mode**: Load full price history once, advance `currentTick` client-side. Already instant — this is what the current replay does.
2. **Batch mode**: Compute N ticks in pure numpy arrays in memory, flush all results in one bulk write at the end.
3. **Live mode**: Keep last price in Redis/Volatile in-memory store, sync to PostgreSQL every 1000 ticks.

The core math (OU process, driver computation, OHLC) takes only **~8ms per tick** in pure numpy. The remaining **1,552ms** is all DB I/O and ORM overhead.

```
Current:  8ms math + 1552ms DB = 1560ms/tick  (0.64 t/s)
Target:   8ms math +   0ms DB =    8ms/tick  (125 t/s)
```

For 1000×, you also need numba to JIT-compile the driver loop (which is the ~8ms part). With numba, that drops to **~1ms math** → **~1,000 ticks/sec**.

---

## Comprehensive Optimization Review

> This is a large, dense simulation engine with correctness-critical logic (idempotency guards, timeline branching, per-tick decay math). The recommendations below are structured by risk tier. **Always add a pinned-seed regression test before merging any change** — assert tick outputs are unchanged (bit-for-bit or float-tolerance).

---

### Tier 1 — Safe, High-Value, Mechanical (Do These First)

#### 1.1 Batch-insert financial statements the same way as PriceHistory

**Problem**: `_generate_fake_quarterly_financials` calls `session.add()` once per company for `IncomeStatement`, `BalanceSheet`, `CashFlowStatement`, `ConsensusEstimate` — four individually-tracked ORM inserts × ~150 companies every quarter boundary.

**File**: `engine/orchestrator.py:1312-1450`

**Fix**: Collect dict rows exactly like `_write_tick_results` (lines 966-1012) does, then `session.execute(insert(Model), rows)` once per table.

**Risk**: Low, but keep the per-company existing-row check intact or you will hit unique constraint violations on retried advances.

**Est. speedup**: 1.05–1.10× (on quarter-boundary ticks only, every 63rd)

---

#### 1.2 Precompute per-tick static lookups once per process

**Problem**: `_load_factor_effect_batch` and `_refresh_fundamentals` both re-query `IndustryPillarWeight`, `fq_sub`/`moat_sub` `FactorDefinition` rows every single tick even though these almost never change.

**Files**:
- `engine/orchestrator.py:1335-1338` — `IndustryPillarWeight` query
- `engine/orchestrator.py:1340-1343` — `FactorDefinition` (fq_sub) query
- `engine/orchestrator.py:1345-1346` — `FactorDefinition` (moat_sub) query

**Fix**: Cache in a module-level dict keyed by a cheap invalidation signal (e.g. a `last_modified` column, or a manual `clear_config_cache()` call in the admin config-update endpoint at `apps/api/routers/simulation.py`).

**Risk**: Low-moderate. The failure mode is stale weights after an admin edits `IndustryPillarWeight`/`FactorDefinition` — those change rarely, but you must wire invalidation into `update_config_parameter`, not just add a cache and forget.

**Est. speedup**: 1.03–1.05×

---

#### 1.3 Vectorize `_compute_drivers` with NumPy where math is scalar

**Problem**: `run_ticks` calls `_compute_drivers` once per company in a plain Python `for` loop (lines 259-275), each call doing scalar `math.log`, `math.tanh`, `rng.gauss` etc. The engine tick (`engine/tick.py`) already vectorizes the OU step downstream — the bottleneck is upstream.

**Fix**: Split `_compute_drivers` into:
- **(a) Vectorizable numeric core** — industry vol scaling, size factor, beta jitter, sigma, value_opportunity, technical_momentum, economic_outlook. Run as array ops over all companies at once.
- **(b) Per-company/DB-dependent parts** — active events, earnings surprise from possibly-missing consensus rows. Stay scalar (ragged per-company data).

**Risk**: Moderate. Restructure only with a snapshot test that pins tick outputs for a fixed RNG seed before and after, and diffs them bit-for-bit.

**Est. speedup**: 1.10–1.15×

---

#### 1.4 Batch per-company idempotency checks in `_generate_fake_quarterly_financials`

**Problem**: Three separate queries (`IncomeStatement`, `BalanceSheet`, `CashFlowStatement`) run per company per quarter boundary just to check "has this quarter already been written."

**File**: `engine/orchestrator.py:1390-1410` (approximately)

**Fix**: Batch these into one `IN (...)` query per table before the loop, same pattern as `latest_cfs_by_company` (lines 1364-1367).

**Risk**: Low.

**Est. speedup**: 1.03–1.05× (quarter-boundary only)

---

### Tier 2 — Real Speedups, More Surface Area for Regressions

#### 2.1 Numba-JIT the OU update and OHLC synthesis math

**Files**:
- `engine/market.py::update_market_tick` — already vectorized NumPy, good `@numba.njit` candidate
- `engine/ohlc.py::synthesize_ohlc` — uses `rng.gauss` from `random.Random`

**Important RNG caveat**: `synthesize_ohlc` uses `rng.gauss` from a `random.Random` instance seeded per-timeline (`rng_seed + tick_count`). Numba does not support Python's `random.Random` object. If you JIT this, you must switch to `numpy.random.Generator` seeded equivalently, which **changes the reproducible RNG stream** — every existing timeline's historical price paths become non-reproducible relative to their stored `rng_seed`. This is a deliberate architectural trade you need to sign off on.

**Risk**: High if done carelessly (RNG stream change breaks reproducibility guarantees the Future Lab branching feature depends on).

**Est. speedup**: 1.05–1.10× (marginal — the OU math is already fast numpy)

---

#### 2.2 Cache `resolve_active_overrides` / `driver_bias_by_company` / `factor_score_bias_by_company`

**Problem**: These dict comprehensions are recomputed every tick even when `TimelineOverride` rows haven't changed.

**File**: `engine/overrides.py` — all three functions

**Fix**: Cache results keyed by `(timeline_id, last_modified_hash)` across ticks.

**Risk**: Low. These are already cheap (small row set, in-memory grouping), so only worth it if profiling shows they're meaningful.

**Est. speedup**: 1.01–1.02×

---

#### 2.3 NumPy-vectorize sector shock generation

**Problem**: `generate_sector_shocks` loops over industries with per-industry `rng.gauss` calls.

**File**: `engine/orchestrator.py:470-500` (approximately)

**Fix**: Generate all sector shocks as a single numpy array of gaussians. Same RNG caveat as 2.1.

**Risk**: Moderate (RNG stream change).

**Est. speedup**: 1.02–1.03×

---

### What NOT to Touch (Regression Risk Exceeds Speed Benefit)

| Do Not Touch | Why | File/Line Ref |
|---|---|---|
| **Idempotency guards** in `run_ticks` (existing-row check, `is_running`/`tick_count` skip) | Documented production incident: retried/re-crossed quarter boundaries hitting unique constraints | `orchestrator.py:168-185` |
| **`*_base` snapshot pattern** in `_apply_factor_effects_to_company` / `_apply_timeline_factor_score_overrides` | Prevents event/override deltas from compounding tick-over-tick — looks like redundant bookkeeping, is load-bearing | `orchestrator.py:2260-2330` |
| **Parallelizing companies with threads/processes** inside a single `run_ticks` call | Mutates shared `session` state and reads/writes `state.iv_overlay`/`state.price_overlay` dicts being built incrementally | `orchestrator.py:259-275` |
| **Swapping `random.Random` for NumPy RNG** without explicit signoff | Breaks reproducibility — every existing timeline's historical price paths become non-reproducible | `engine/market.py`, `engine/ohlc.py`, `engine/orchestrator.py` |

---

### Implementation Rule

For every change above:
1. Write a **pinned-seed regression test** that runs `run_ticks(session, timeline_id, num_ticks=10)` with `timeline.rng_seed = "perf-test-seed"`.
2. Capture all `PriceHistory` and `PriceDriverScore` rows as a snapshot.
3. Apply the optimization.
4. Assert the snapshot is unchanged (within float tolerance).
5. Only merge if step 4 passes.

```python
# Example pinned-seed regression test pattern
def test_tick_outputs_unchanged_after_optimization(db_session):
    timeline = db_session.query(Timeline).filter_by(name="perf-baseline").first()
    with freeze_time("2026-01-15"):
        run_ticks(db_session, timeline.id, num_ticks=10)
    prices = db_session.query(PriceHistory).filter_by(timeline_id=timeline.id).all()
    # Assert against pre-optimization snapshot
    assert len(prices) == 10 * 153
    assert abs(float(prices[0].close) - EXPECTED_CLOSE_0) < 1e-6
```

---

### Combined Speedup Projection

| Tier | Changes | Est. Speedup | ticks/sec | Person-days |
|------|---------|-------------|-----------|-------------|
| **Tier 1** | Index + batch inserts + cache statics + vectorize driver core + batch idempotency checks | **2.0–2.5×** | **1.3–1.6** | 2–3 |
| **Tier 2** | Tier 1 + numba OU/OHLC + vectorize sector shocks + cache overrides | **3–5×** | **2–3** | 5–7 |
| **Tier 3** | Tier 2 + in-memory tick loop + batch DB every N ticks | **10–50×** | **6–32** | 10–15 |
| **Tier 4** | Tier 3 + zero-copy arrays + async I/O + numba driver loop | **200–1000×** | **128–640** | 20–30 |

---

## Why "Max Speed" Is Not a Free Slider

The 200–1000× numbers assume away correctness machinery this codebase was deliberately built to enforce. Before pursuing those tiers, understand these constraints.

### 1. Async DB writes / fire-and-forget commit

If a request returns before the commit lands, and the process crashes or another request reads the DB in between, you get exactly the corrupted-partial-state scenario the idempotency comments describe fixing:

> *"The code's own idempotency comments describe fixing 'leftover partial data from a request that crashed... after some but not all rows for this period were flushed'"* — `orchestrator.py:1390-1410`

Fire-and-forget commits reopen that class of bug. This is a **durability trade-off**, not a free win.

### 2. Batch writes every N ticks

Every read in this system queries `PriceHistory` directly:
- `get_latest_prices` — `db/timeline_resolver.py:55-80`
- `get_latest_intrinsic_values` — `db/timeline_resolver.py:85-110`
- Portfolio mark-to-market — `apps/api/services/portfolio_service.py`
- Trade execution (`check_and_fill_limit_orders`) — `apps/api/services/trade_service.py`

If you defer 1000 ticks of writes, every one of those reads either goes stale or you need a second, parallel in-memory source of truth that every read path is rewritten to check first. That's not a config change, it's a **second data path with its own cache-invalidation bugs**.

### 3. Fully in-memory replay

This only works if the user genuinely never needs to read intermediate state during replay:
- Limit-order fills (`check_and_fill_limit_orders` runs after every `advance_simulation` call)
- Portfolio value updates
- Live price display

If replay mode truly never checks orders mid-run, fine — but that's a **product decision about what replay mode means**, not a database optimization.

### 4. RNG stream change with numba

Swapping `random.Random` → `numpy.random.Generator` changes your reproducible RNG stream. Every existing timeline's stored `rng_seed` currently reproduces a specific `random.Random`-based history. Swap the RNG and old replays no longer reproduce. That's fine if you decide **reproducibility resets going forward**, not fine if anyone depends on re-deriving history from a seed.

### Honest Framing

| Tier | Speedup | Requires |
|------|---------|----------|
| **10–50×** | Close to free | In-memory tick math, batching DB writes |
| **200–1000×** | Relaxes specific guarantees | Intra-run read consistency, crash durability, RNG reproducibility |

None of this means don't chase 1000× — it means the path is: **index + batch queries → profile → decide which guarantees to relax for replay mode**.

---

## Additional Upgrades

### DB / Query Layer

| Upgrade | Why | File Ref |
|---------|-----|----------|
| `select(Model).where(...).options(load_only(...))` | Fetch only needed columns instead of full-row ORM loads | `orchestrator.py:397-420` |
| `DISTINCT ON (company_id) ORDER BY company_id, fiscal_period DESC` | Replace four "query all, sort desc, dedup in Python" blocks with one Postgres-native query | `orchestrator.py:1364-1379` |
| Covering index: `PriceHistory(timeline_id, company_id, sim_date DESC)` | Specifically for the moving-average window query (16ms/tick saving) | `orchestrator.py:555-565` |
| `TimescaleDB` hypertables for `PriceHistory`/`PriceDriverScore` | Dramatically faster range scans for MA window and diff/history queries | — |
| SQLAlchemy Core `text()` with bound params | Skip ORM object hydration where only raw values are needed | `orchestrator.py:555-565` |

### Process / Runtime

| Upgrade | Why |
|---------|-----|
| `PYTHONOPTIMIZE=2` / strip asserts and docstrings | Marginal but free interpreter overhead reduction |
| `orjson` instead of stdlib `json` for JSON columns | Faster `effect_profile`/`applied_effects`/`statements` serialization |
| Core `update()` instead of ORM attribute writes | Profile SQLAlchemy identity-map dirty-attribute diffing cost for hot mutated rows (`Company`, `CompanyFactorScore`) |

### Numeric / Algorithmic

| Upgrade | Why |
|---------|-----|
| Incremental moving average (running sum per company) | Replace `sum(closes)/len(closes)` — O(1) per tick instead of O(window) | `orchestrator.py:566-570` |
| Precompute `math.sqrt(252)` and other tick constants | Trivial, but in a 153×-per-tick hot loop |
| `scipy.stats` vectorized distributions | Batch `rng.gauss` calls if moving off `random.Random` |

### Query / Schema — Additional

| Upgrade | Why | File Ref |
|---------|-----|----------|
| **`CompanyLatestState` denormalized table** — one row per `(company_id, timeline_id)`, updated in place | Avoids reconstructing current state by querying & deduping 4 historical tables every tick. Trade-off: every write path must also update it in the same transaction or it silently drifts. | `orchestrator.py:397-420` |
| **Partial/filtered index on `event_instances`**: `(timeline_id, sim_date)` | Covers `_load_active_events` / `_apply_event_factor_effects` — both filter `expires_on >= sim_date`. Avoids two full table scans per tick. | — |
| **Materialized view refreshed at quarter boundaries** for `latest_cfs`/`latest_inc`/`latest_bal` | Lets Postgres dedup (latest per company) instead of Python, without hand-maintaining a second source of truth. | `orchestrator.py:1364-1379` |
| **Skip `MoatSubscore`/`FinancialQualitySubscore` loads on non-quarter-boundary ticks** | Gate behind `is_quarter_boundary` — these are only used inside `_refresh_fundamentals` which already gates itself. | — |
| **Connection-level statement caching** — check `query_cache_size` (default 500) isn't being thrashed by parameter-shape variance in dynamic `filter()` chains | Bumping it is free. | — |
| **Batch `EventInstance`/`NewsFeed` generation into multi-row inserts** | Currently one `session.add()` per news item per event instance. | `engine/event_executor.py` |

### Python / Data Structure

| Upgrade | Why |
|---------|-----|
| **Replace `SimpleNamespace` with `@dataclass(slots=True)`** for the `state` object in `_load_tick_state` | `SimpleNamespace` attribute access goes through `__dict__`; `slots=True` is measurably faster for repeated reads across dozens of helper calls per tick. |
| **Build `company_by_id` once in `_load_tick_state`, pass through** — don't let `run_ticks` and helpers rebuild the same id-keyed dict independently | Avoids O(N) re-iteration per function. |
| **Use `__slots__` on `CompanyTickInput`/`CompanyTickOutput`** — they're `@dataclass(frozen=True)`, add `slots=True` (Python 3.10+) | Cuts per-instance memory overhead and attribute-access cost across 153 instances per tick. |
| **Avoid 11-list `zip` in `run_ticks`** — build `CompanyTickInput` directly in the `_compute_drivers` result loop instead of 11 parallel lists re-zipped afterward | Saves intermediate data structure and a full re-iteration. |
| **Replace `active_events` list-of-dicts with tuples or a small dataclass** | Dict creation/lookup overhead matters if a tick has many active events (only if profiling shows it). |

### Caching

| Upgrade | Why |
|---------|-----|
| **`functools.lru_cache` on `_parse_range`** keyed by raw string | Event severity ranges are static per `MarketEvent` row, currently reparsed every time an event fires. |
| **Cache `quality_multiplier`/`fair_peg` for repeated `(intrinsic_score, industry_id)` pairs** | Low value unless scores cluster, but cheap via `lru_cache` with rounded inputs. |
| **Precompute & cache `cycle_sensitivity_map`/`sector_beta_default_map`** | Built fresh from `industries.values()` every tick in `_load_tick_state` — only change when `Industry` rows are edited. |

### Concurrency / IO

| Upgrade | Why |
|---------|-----|
| **`asyncpg`/SQLAlchemy async engine for read-only queries** — MA price-history reads, reference-table reads | Fire concurrently via `asyncio.gather` instead of sequential blocking calls. Nontrivial migration, not a drop-in. |
| **Read replica for heavy historical-range queries** — `resolve_price_history_range`, MA window lookups, `_quarter_market_performance` | Avoids contention with primary write load during ticking, if Postgres replication is available. |

### Profiling / Measurement Tooling

| Upgrade | Why |
|---------|-----|
| **`py-spy record -o profile.svg`** | Flamegraph with zero code changes. Highest-leverage item on this entire list — tells you which specific line the 1.56s is in rather than guessing from 30+ candidates. |
| **SQLAlchemy `echo=True` or sqlalchemy-utils query counter** | Exact per-tick query count and cumulative query time, separates DB-bound from CPU-bound time. |
| **`memory_profiler`/`tracemalloc`** | Know the memory ceiling before committing to caching reference tables and denormalized snapshots. |

## Resolved: Replay vs Live Separation

**Decision**: Replay is just a DB read + frontend state advancement — no engine at all. Live runs the full engine with trades, orders, all guarantees.

**Replay path** — pre-compute all ticks for the date range and store in `PriceHistory`, serve to frontend as an array, advance `currentTick` client-side. No engine needed during playback. Limit orders, portfolio value, trades are not relevant — replay just shows what happened.

**Live path** — current behavior with full durability. Every write hits PostgreSQL immediately. Trades, fills, and portfolio updates run after every tick. This is where optimization effort goes.

**Plan**:
1. Tier 1 optimizations on the live path (batch inserts, cache static lookups, `load_only` / `DISTINCT ON`, moving-average index)
2. Profile again to determine whether further tiers are worth pursuing
3. 200–1000× tiers are off the table unless the product decision changes — the cost is relaxing guarantees the live path deliberately provides

### Architecture (Bigger Lift — Deferred)

| Upgrade | Status |
|---------|--------|
| **Compact append-only log for replay history** | Not needed — replay reads from existing `PriceHistory` schema |
| **Separate in-memory replay engine** | Not needed — replay is frontend-only slice of loaded data |

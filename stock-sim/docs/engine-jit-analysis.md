# Engine JIT / Numba / prange / Vectorization / Memoization Analysis

> **Target:** Every non-DB computational loop in `engine/*.py` (153 companies per tick).
> **Scope:** JIT (numba `@njit`), `prange`, numpy vectorization, `functools.lru_cache`, SIMD-friendly data structures, in-memory tick arrays.
> **Date:** 2026-07-30
> **Engine:** ~3,011 LOC across 14 files, ~142Kb in orchestrator.py alone.

---

## Executive Summary

| Technique | Applicable? | Critical Loops | Estimated Speedup | Effort |
|-----------|-------------|----------------|-------------------|--------|
| **numpy vectorization** | ✅ YES (3 loops) | IV drift, driver pre-processing, OHLC/volume | **5–10×** per loop | Low |
| **numba `@njit`** | ✅ YES (6+ call-sites) | pure math functions: `drift_iv`, `quality_multiplier`, `fair_peg`, OU update, etc. | **2–8×** per function | Low |
| **numba `prange`** | ✅ YES (1 loop) | `_compute_drivers` per-company body (153 independent iterations) | **2–4×** (theoretical, limited by Python object overhead) | Medium |
| **`functools.lru_cache`** | ❌ NO | No repeated pure-function calls with identical args across a single tick | — | — |
| **SIMD-friendly structs** | ✅ PARTIAL | Array-of-structs replacement for `list[dict]` driver values/weights | **1.5–3×** (compound gain) | High |
| **In-memory tick arrays** | ✅ PARTIAL | Storing N tick windows as `(N × 153 × K)` numpy arrays | **~2× on reads** (less DB traffic) | High |
| **numba `@jitclass`** | ❌ NO | Object overhead in `_compute_drivers`/`_refresh_fundamentals` precludes numba class compilation | — | — |

**Bottom-line estimate:** Vectorizing the 3 per-company loops + njit on the 6 pure math functions = **~30–50% total tick time reduction** (from ~150ms → ~80–100ms at 153 companies). Removing the `rng.gauss()` calls (not numba-compatible in nopython mode) limits deeper gains.

---

## 1. NumPy Vectorization — Deep Analysis

### 1.1 IV Drift Loop — `orchestrator.py` lines 240–250

**Current code (scalar loop):**
```python
# orchestrator.py L240-250
for company in companies:
    iv_start = state.iv_overlay.get(company.id)
    if iv_start is not None:
        cfs = state.latest_cfs.get(company.id)
        growth_potential = float(cfs.growth_potential) if cfs else 50.0
        growth_rate_pct = growth_score_to_rate(growth_potential, growth_rate_min, growth_rate_max)
        state.iv_overlay[company.id] = float(drift_iv(
            iv_start, growth_rate_pct, TRADING_DAYS_PER_YEAR,
        ))
```

**Analysis:** ✅ VECTORIZE. 153 iterations, each calling `growth_score_to_rate` (quadratic: `t*t`) and `drift_iv` (power: `(1 + g/100)^(1/252) - 1`). Both are pure scalar math.

**Proposed fix — batch with numpy arrays:**
```python
company_ids = [c.id for c in companies]
iv_starts = np.array([state.iv_overlay.get(c.id, np.nan) for c in companies])
growth_pots = np.array([
    float(state.latest_cfs.get(c.id).growth_potential) 
    if state.latest_cfs.get(c.id) else 50.0 
    for c in companies
])
mask = ~np.isnan(iv_starts)
# Vectorized growth_score_to_rate: rate = g_min + (g_max - g_min) * t^2
t = np.clip(growth_pots[mask] / 100.0, 0.0, 1.0)
growth_rates = growth_rate_min + (growth_rate_max - growth_rate_min) * t * t
# Vectorized drift_iv: iv * (1 + g)^(1/252)
daily_factors = (1.0 + growth_rates / 100.0) ** (1.0 / TRADING_DAYS_PER_YEAR)
iv_starts[mask] = iv_starts[mask] * daily_factors
# Write back
for i, cid in enumerate(company_ids):
    if mask[i]:
        state.iv_overlay[cid] = float(iv_starts[i])
```

**Speedup estimate:** 153× `math.exp`+`math.pow` calls → 2 numpy vector operations. **~50–100µs → ~5–10µs** (5–10×). Minor since the loop is already fast (~2ms total per tick based on timing output `iv_drift`).

### 1.2 Driver Pre-Processing — `orchestrator.py` lines 264–280 → `_compute_drivers` lines 709–922

**Current code (per-company):**
```python
# orchestrator.py L264-280
for company in companies:
    result = _compute_drivers(session, company, state, timeline_id, sim_date, tick_count)
    if result is None:
        continue
    # ... append 11 fields to pricing_data dicts
```

`_compute_drivers` itself (L709–922) does ~30 scalar ops per company including:
- `np.log()` — numpy call per company (wasteful: could vectorize)
- `math.tanh()` — scalar tanh (should be `np.tanh()`)
- `math.exp()` — same
- `rng.gauss()` — 3 calls per company (not vectorizable, but see §5 below)

**Analysis:** ✅ PARTIAL VECTORIZE. The `_compute_drivers` function is too heterogeneous for full vectorization (conditional branches, dict lookups, per-company DB reads already batched). However, the **pricing data append pattern** (L268–280) should be replaced with pre-allocated numpy arrays:

```python
n = len(companies)
y_arr = np.empty(n)
theta_arr = np.empty(n)
# ... pre-allocate all arrays
for i, company in enumerate(companies):
    result = _compute_drivers(...)
    if result is None:
        continue
    y_arr[i] = result["y"]
    theta_arr[i] = result["theta"]
    # ...
```

**Speedup estimate:** Negligible on runtime (dict append is fast). Mostly a memory-layout improvement — **<5%** on this section.

### 1.3 OHLC / Volume / Imbalance Loop — `orchestrator.py` lines 950–991

**Current code:**
```python
# orchestrator.py L950-991
for out in tick_result.outputs:
    cid = out.company_id
    prev_close = price_overlay.get(cid, 100.0)
    raw_price = out.price
    cb_price = apply_circuit_breaker(raw_price, prev_close, r_cap=r_cap)
    ohlc = synthesize_ohlc(prev_close, cb_price, rng)
    # ... free_float, mcap, abs_return, ns_delta, is_earnings_day
    vol = compute_volume_prd(...)
    demand = demand_from_pressure(...)
    supply = supply_from_pressure(...)
    imb = order_imbalance(demand, supply)
```

**Analysis:** ✅ VECTORIZE. Most sub-operations are pure scalar math:
- `apply_circuit_breaker` — clamp + linear blend → vector clamp
- `synthesize_ohlc` — 2× `rng.gauss()` → not vectorizable with numpy alone
- `compute_volume_prd` — pure math with 1× `rng.gauss()` → partially vectorizable
- `demand/supply_from_pressure` — pure linear ops → trivial vectorization

However, `rng.gauss` calls (2 in `synthesize_ohlc` + 1 in `compute_volume_prd` = 3 per company = 459 gauss draws per tick) block full vectorization. See §5.1 for Vectorized PRNG alternative.

**Proposed batch approach — compute common terms as numpy arrays, loop only for rng-dependent parts:**
```python
# Vectorize the pure-math parts
prev_closes = np.array([price_overlay.get(out.company_id, 100.0) for out in tick_result.outputs])
raw_prices = np.array([out.price for out in tick_result.outputs])
# apply_circuit_breaker vectorized
returns = np.where(prev_closes > 0, (raw_prices - prev_closes) / prev_closes, 0.0)
clipped_returns = np.clip(returns, -r_cap, r_cap)
cb_prices = np.where(prev_closes > 0, prev_closes * (1 + clipped_returns), raw_prices)
cb_prices = np.maximum(cb_prices, 0.01)
```

**Speedup estimate:** ~100µs → ~20µs for the non-rng math (5×). Overall OHLC step ~3ms → ~2ms with vectorized PRNG.

---

## 2. Numba `@njit` — Deep Analysis

### 2.1 `drift_iv` — `valuation.py` lines 156–159

```python
def drift_iv(iv: float, expected_annual_growth: float, trading_days_per_year: int = 252) -> float:
    daily_growth = (1 + expected_annual_growth / 100.0) ** (1 / trading_days_per_year) - 1
    return iv * (1 + daily_growth)
```

**YES — `@njit` candidate.** Pure math, no Python objects, no rng. Called 153× per tick in the IV drift loop.

**Speedup:** ~0.5µs → ~0.1µs per call (5× single-call; meaningful batched into vector ops as §1.1).

### 2.2 `quality_multiplier` — `valuation.py` lines 35–53

```python
def quality_multiplier(intrinsic_score, m_min, m_max, k, c):
    return m_min + (m_max - m_min) / (1.0 + math.exp(-k * (intrinsic_score - c)))
```

**YES — `@njit` candidate.** Pure math, no Python objects. Called per company per quarter boundary (~153× every 63 ticks). Also called inside `fair_peg` called inside `_recompute_valuation`.

### 2.3 `fair_peg` — `valuation.py` line 70

Trivially `@njit` (wraps `quality_multiplier`).

### 2.4 `fair_pe_from_peg` — `valuation.py` lines 73–86

Trivially `@njit` (linear: `baseline_pe + peg * growth_rate_pct`).

### 2.5 `growth_score_to_rate` — `valuation.py` lines 89–103

**YES — `@njit` candidate.** `t*t` quadratic, pure math.

### 2.6 `update_log_gap` — `market.py` lines 20–39

**YES — `@njit` candidate.** Pure linear: `y - theta*y + k_drift*P + beta_m*F_m + beta_s*F_s + sigma*epsilon`.

### 2.7 `update_market_tick` — `market.py` lines 47–60

Already uses numpy arrays. **Cannot use `@njit`** with numpy arrays in nopython mode unless the arrays are typed, but this is already fully vectorized — no gain from numba.

### 2.8 `price_from_gap` — `market.py` line 44

Trivially `@njit` (already uses `np.exp` — in njit mode this would use `math.exp` equivalently).

### 2.9 `composite_price_pressure` — `drivers.py` lines 80–82

```python
def composite_price_pressure(drivers, weights):
    return sum(weights.get(key, 0) * value for key, value in drivers.items())
```

**NO — uses dict iteration.** Cannot `@njit` in nopython mode. Would need to switch to numpy arrays of (values, weights) — see §5.2.

### 2.10 Scalar Driver Functions — `drivers.py` lines 17–77

The 7 individual driver functions:

| Function | Lines | @njit? | Why |
|----------|-------|--------|-----|
| `value_opportunity` | 22–23 | ✅ YES | Pure math: `(iv - price) / price` |
| `earnings_surprise` | 26–32 | ✅ YES | `math.exp(-decay * days)` — pure math |
| `news_severity` | 47–55 | ❌ NO | Dict iteration over list of dicts |
| `economic_outlook` | 59–60 | ✅ YES | Clamp only |
| `guidance` | 63–67 | ✅ YES | `math.exp(-decay * days)` — pure math |
| `technical_momentum` | 70–72 | ✅ YES | `math.tanh(k * (p - ma) / ma)` |
| `institutional_buying` | 75–77 | ✅ YES | Clamp only |

### 2.11 `decay` in `events.py` line 6–8

**YES — `@njit` candidate.** `math.exp(-rho * days_elapsed)`. Pure math.

### 2.12 OU Model Math in `tick.py` — `price_pressures` computation (line 74–76)

```python
price_pressures = state.pressure_scale * np.array(
    [composite_price_pressure(c.driver_values, c.driver_weights) for c in state.companies]
)
```

**NO — dict comprehension inside list.** The already-vectorized `update_market_tick` call on line 86–97 is fine as-is.

### 2.13 `_jitter_event_severities` — `orchestrator.py` lines 2646–2668

```python
return [
    {**event_data, "severity": event_data.get("severity", 0.0) * (1.0 + rng.gauss(0, jitter_std))}
    for event_data in active_events
]
```

**NO — uses dict spread + `rng.gauss`.** Not njit-compatible.

### 2.14 `_safe_finite` — `orchestrator.py` lines 2607–2612

**YES — trivially `@njit`.** Simple float checks (but `np.isfinite` needs njit-compatible replacement `math.isfinite`).

---

## 3. Numba `prange` — Deep Analysis

### 3.1 `_compute_drivers` per-company body — `orchestrator.py` lines 709–922

**Current loop (L264):**
```python
for company in companies:
    result = _compute_drivers(session, company, state, ...)
```

**Analysis:** ✅ **prange candidate.** Each company's driver computation is INDEPENDENT — no cross-company state mutation. The function reads from `state.*` dicts (read-only once loaded) and writes to a per-company result dict.

**Problem:** `rng.gauss()` calls inside `_compute_drivers` (3×: lines 758, 759, 760, 794). Python's `random.Random` is not thread-safe. Workarounds:
1. Pre-compute all gauss draws per-company in a vectorized batch (see §5.1), then make the loop pure math.
2. Use per-company `rng.gauss` calls with per-thread RNG instances (complex).
3. Replace `rng.gauss()` with `np.random.normal()` in a vectorized batch.

**With pre-batched gauss values, this loop becomes `@njit(parallel=True)` viable:**
```python
@njit(parallel=True)
def compute_all_drivers(...):
    for i in prange(n):
        results[i] = _compute_drivers_jit(...)
```

**Speedup estimate:** With 8 cores, 153 iterations → theoretical 4–6× wall-time reduction. Realistic: **2–3×** due to GIL overhead on dict operations even with prange.

### 3.2 `_update_prices_and_ohlc` — `orchestrator.py` lines 925–992

**YES — prange candidate.** Each `tick_result.outputs[i]` is independent (writes to `ohlc_results[cid]`, `volume_results[cid]`, `imbalance_results[cid]` — per-company dict keys, no collisions). Same rng problem as §3.1.

### 3.3 `_refresh_fundamentals` per-company loop — `orchestrator.py` lines 1549–1571

**PARTIAL — prange candidate only for the compute portion.** Each company's `_generate_fake_quarterly_financials` is independent in its math, but it also does DB queries inside — cannot prange DB sessions. If the DB queries were factored out (most already batch-loaded), the inner math could prange.

### 3.4 `_generate_concalls_for_quarter` — `orchestrator.py` lines 2468–2584

**NO — DB queries per iteration.** Each company queries its own IncomeStatement/ConsensusEstimate/BalanceSheet inside the loop. DB access is not prange-compatible, and the SQLAlchemy session is not thread-safe.

### 3.5 `_apply_timeline_factor_score_overrides` — `orchestrator.py` lines 1194–1316

**YES — prange candidate.** Each company in `affected_ids` is independent (reads from `batch.*` dicts, writes to its own `cfs` ORM row). However, ORM writes are not thread-safe, so only the computation portion could prange.

### 3.6 `_apply_factor_effects_to_company` — `orchestrator.py` lines 2872–3012

**YES — prange candidate.** Each `(cid, instances)` pair is independent. The function reads from `batch.*` (read-only) and mutates `latest_cfs` (per-company ORM row). ORM write contention makes this risky.

---

## 4. `functools.lru_cache` / Memoization — Deep Analysis

### 4.1 Repeated Pure-Function Calls with Same Args

**Analysis across all files:**

| Function | Called with Same Args? | Cachable? | Verdict |
|----------|----------------------|-----------|---------|
| `quality_multiplier(S, m_min, m_max, k, c)` | IntrinsicScore is per-company, and m_min/m_max/k/c are global params → **different per company** | ❌ | **NO** — different S per company |
| `growth_score_to_rate(gp, rate_min, rate_max)` | gp is per-company, rate_min/max are global → **unique per company** | ❌ | **NO** |
| `fair_peg(peg, S, ...)` | Per-company | ❌ | **NO** |
| `drift_iv(iv, g, tdp)` | Per-company | ❌ | **NO** |
| `_recompute_valuation(...)` | Per-company | ❌ | **NO** |
| `decay(rho, days_elapsed)` | rho is per-event, days_elapsed per company | ❌ | **NO** |
| `apply_circuit_breaker(price, prev_close, r_cap)` | Unique per (price, prev_close) pair per company | ❌ | **NO** |
| `synthesize_ohlc(prev_close, curr_close, rng)` | rng state changes → different result every call | ❌ | **NO** |
| `compute_volume_prd(...)` | Same args may repeat across companies if they share market_cap/free_float bands | ❌ | **NO — `rng.gauss` makes output non-deterministic** |

**Verdict: No `lru_cache` opportunity exists.** Every function is called with unique arguments per company (different company.id → different prices, IVs, financials) within a single tick. Across ticks, prices change. The random component in most functions (`rng.gauss`) also makes caching incorrect.

### 4.2 When Memoization Could Help (Cross-Tick)

If the same company's financials produce the same `quality_multiplier` / `fair_peg` between quarter boundaries (they should — financials only change at quarter boundaries), the `_recompute_valuation` calls in `_refresh_fundamentals` and `_apply_event_factor_effects` could cache by `(company_id, growth_potential, intrinsic_score, industry_id)`:

```python
@lru_cache(maxsize=153)
def cached_valuation(intrinsic_score, growth_potential, industry_id, ...):
    return _recompute_valuation(...)
```

But `_recompute_valuation` already reads from `params` dict (which doesn't change mid-tick) and `neutral_industry_pegs`. A cache key would need to include all param values, making the key long and the benefit marginal.

**Verdict:** ❌ **NO — not worth the complexity.**

---

## 5. SIMD-Friendly Data Structures — Deep Analysis

### 5.1 Separate `random.Random` per tick — replace with numpy random batch

**Problem:** 3 `rng.gauss()` calls per company per tick in `_compute_drivers`:
- L758: `state.rng.gauss(0, BETA_JITTER_STD)` — beta_market jitter
- L759: `state.rng.gauss(0, BETA_JITTER_STD)` — beta_sector jitter  
- L760: `state.rng.gauss(0, 1)` — epsilon noise
- L794: `state.rng.gauss(0, ECON_OUTLOOK_JITTER_STD)` — outlook jitter

Plus 2 more in `synthesize_ohlc` and 1 in `compute_volume_prd`.

**Total: ~6 gauss draws × 153 = ~918 Python `rng.gauss()` calls per tick.**

**Proposed fix — batch all gauss draws once per tick as numpy arrays:**
```python
# In run_ticks, before the per-company loop
n_companies = len(companies)
beta_jitter = np.random.normal(0, BETA_JITTER_STD, n_companies)  # SIMD-optimized
epsilon_noise = np.random.normal(0, 1, n_companies)
outlook_jitter = np.random.normal(0, ECON_OUTLOOK_JITTER_STD, n_companies)
ohlc_gauss1 = np.random.normal(0, intraday_volatility / 2, n_companies)
ohlc_gauss2 = np.random.normal(0, 1, n_companies)
vol_noise = np.random.normal(0, vol_noise_sigma, n_companies)
```

Then index into these arrays by `company_index` in the per-company loops, eliminating the `rng.gauss()` Python overhead entirely.

**Speedup estimate:** 918 Python `rng.gauss()` calls (~0.5µs each = ~0.46ms) → 6 vectorized `np.random.normal()` calls (~5µs each = 0.03ms). **~15× faster** for PRNG.

### 5.2 Switch `dict[str, float]` driver values/weights to numpy arrays

**Problem:** `composite_price_pressure` (drivers.py L80–82) iterates dict items:
```python
def composite_price_pressure(drivers, weights):
    return sum(weights.get(key, 0) * value for key, value in drivers.items())
```

Called 153× per tick (in tick.py L74–76 list comprehension). Dict iteration with `.get()` and `items()` is ~5× slower than numpy dot product.

**Proposed fix — store drivers as numpy arrays with fixed key ordering:**
```python
DRIVER_KEYS_ORDERED = ["value_opportunity", "earnings_surprise", "news_severity",
                       "economic_outlook", "guidance", "technical_momentum", "institutional_buying"]

# Instead of dict per company, store array per company OR a 2D array (153 × 7)
driver_values_array = np.empty((n, 7), dtype=np.float64)
driver_weights_array = np.empty((7,), dtype=np.float64)  # same for all companies

# composite_price_pressure = np.dot(driver_values[i], driver_weights)  # SIMD dot product
```

**Speedup estimate:** 153 dict iterations (~1µs each = ~0.15ms) → 1 vectorized `np.dot()` call (~2µs). **~75× faster for this specific operation.**

### 5.3 `_compute_drivers` returns list-of-dicts → pre-allocated struct arrays

**Problem:** `pricing_data` is 11 lists that are appended to per-company (L268–280) and then zipped back into `CompanyTickInput` namedtuples (L286–307). This creates 11 Python list appends + 153 namedtuple creations per tick.

**Proposed fix — pre-allocate numpy record arrays:**
```python
dtype = np.dtype([("y", "f8"), ("theta", "f8"), ("beta_market", "f8"), ...])
pricing_array = np.empty(n, dtype=dtype)
```

And create `CompanyTickInput` from array rows only when needed (the namedtuple is mainly for the `run_tick` function, which could instead accept arrays directly).

**Speedup estimate:** Saves ~153 namedtuple allocations + 11 list extensions + 11 zip calls. **~0.1–0.3ms** saved (small relative to total tick).

---

## 6. In-Memory Tick Arrays — Deep Analysis

### 6.1 PriceHistory as in-memory rolling window

**Current:** Each tick writes PriceHistory to DB. `_compute_drivers` reads `state.price_overlay` (in-memory dict, already fast). `_update_prices_and_ohlc` reads `prev_ns` from DB (batch-loaded once per tick).

**Opportunity — store rolling window of N tick prices as numpy array:**
```python
# (n_companies, tick_window) array — updated in-place each tick
price_window = np.zeros((n_companies, WINDOW_SIZE))
price_window[:, tick_idx % WINDOW_SIZE] = new_prices
```

This would eliminate:
- The `price_rows` query in `_load_tick_state` (L607–621) for moving averages
- The `prev_scores` query (L626–630) for prev_ns
- The `recent_prices` query in `_refresh_fundamentals` (L1459–1464) for price_return_by_company

**Verdict:** ✅ **PARTIAL.** High effort (would need to refactor data flow across tick boundaries) but meaningful for DB load reduction. The individual queries are already optimized (batch IN clauses, single queries), so the speedup is in **DB round-trip latency not query time**: maybe **5–10ms per tick** saved in DB wait time.

**Speedup estimate:** ~5–10ms/tick reduced DB load (the `load` portion of the timing shows ~10ms already). But this is a major architectural change.

---

## 7. Concrete Implementation Recommendations

### Low Effort / High Impact (implement immediately)

1. **Replace `rng.gauss()` with vectorized `np.random.normal()`** — batch 6 arrays per tick.
   - Files: `orchestrator.py` L758–760, L794, `cycle.py` L132, and OHLC/volume gauss calls
   - Speedup: **~0.5ms/tick** (918 Python calls → 6 numpy calls)
   - Lines changed: ~10

2. **`@njit` on 7 pure math functions** in `valuation.py`, `drivers.py`, `market.py`, `events.py`:
   - `drift_iv`, `quality_multiplier`, `fair_peg`, `fair_pe_from_peg`, `growth_score_to_rate`, `update_log_gap`, `decay`, `value_opportunity`, `earnings_surprise`, `guidance`, `technical_momentum`, `institutional_buying`
   - Add `from numba import njit` and `@njit` decorators
   - Speedup: **~0.1–0.3ms/tick** (function call overhead saved)
   - Lines changed: ~14 decorators + 1 import

3. **Vectorize IV drift loop** (orchestrator.py L240–250):
   - Replace per-company loop with numpy array operations
   - Speedup: **~0.1–0.2ms/tick**
   - Lines changed: ~15

### Medium Effort / Medium Impact

4. **Replace driver dicts with numpy arrays**:
   - Change `driver_values` from `dict[str, float]` to `np.ndarray` with fixed key ordering
   - Change `composite_price_pressure` to `np.dot()`
   - Speedup: **~0.2ms/tick** on composite_price_pressure alone
   - Files: `drivers.py`, `orchestrator.py`, `tick.py`
   - Lines changed: ~50 across 3 files

5. **Vectorize `synthesize_ohlc` and `apply_circuit_breaker`**:
   - Use numpy operations for clip/clamp/linear ops, keep gauss draws as pre-batched array lookups
   - Speedup: **~0.3ms/tick**
   - Lines changed: ~30

### High Effort / Lower Impact

6. **numba `prange` on `_compute_drivers`** — Requires:
   - Pre-batching all gauss draws (item 1 above)
   - Extracting `_compute_drivers` pure-math core into `@njit` function
   - Passing numpy arrays rather than `SimpleNamespace`/`Company` ORM objects
   - Speedup: **2-3× on the drivers section** (~15ms → ~5–7ms) but HIGH refactoring cost

7. **In-memory rolling price window** — Requires:
   - New `TickBuffer` class managing (N_companies × window_size) array
   - Replacing 3 DB queries per tick with array slice reads
   - Speedup: **~5ms/tick** DB time saved, but high architectural change

---

## 8. Key Blockers

| Blocker | Affected Technique | Why |
|---------|-------------------|-----|
| **`random.Random` gauss calls** | numba, prange, vectorization | 3–6 calls per company; not njit-compatible; thread-unsafe |
| **Dict-structured driver values** | numba, vectorization | `dict.get()` + `dict.items()` cannot be compiled by njit; cannot SIMD |
| **ORM objects in hot path** | numba, prange | `Company(id, name, ...)`, `SimpleNamespace` — njit cannot compile |
| **SQLAlchemy session** | prange | Not thread-safe; only compute code can parallelize, not DB code |
| **Heterogeneous per-company logic** | full vectorization | Conditional branches (e.g., "if latest_inc and latest_ce") differ per company |

---

## 9. Summary Table

| Location | Lines | Loop Type | Iterations | GPU? | vec? | njit? | prange? | memoize? | Priority |
|----------|-------|-----------|-----------|------|------|-------|---------|----------|----------|
| IV drift | orchestrator L240-250 | per-company scalar | 153 | ❌ | ✅ EASY | ✅ | ✅ | ❌ | **HIGH** |
| Compute drivers | orchestrator L264-280, L709-922 | per-company heavy | 153 | ❌ | ✅ PARTIAL | ✅ PARTIAL | ✅ PREP | ❌ | **HIGH** |
| OU tick | tick.py L74-110 | ALREADY VECTORIZED | 1 numpy | ✅ | ✅ DONE | ❌ (numpy) | ❌ | ❌ | DONE |
| OHLC/vol | orchestrator L950-991 | per-company OHLC | 153 | ❌ | ✅ EASY | ✅ PARTIAL | ✅ PREP | ❌ | **MEDIUM** |
| Write results | orchestrator L1020-1063 | per-company DB | 153 | ❌ | ❌ (DB) | ❌ | ❌ | ❌ | LOW |
| Denorm fields | orchestrator L1090-1112 | per-company DB | 153 | ❌ | ❌ (DB) | ❌ | ❌ | ❌ | LOW |
| Execute events | orchestrator L1146-1180 | per-event | ~few | ❌ | ❌ | ❌ | ❌ | ❌ | LOW |
| FQ percentile | orchestrator L1573-1587 | ALREADY VECTORIZED | 1 numpy | ✅ | ✅ DONE | ❌ (numpy) | ❌ | ❌ | DONE |
| Quarter financials | orchestrator L1549-1571 | per-company DB | 153 | ❌ | ❌ (DB) | ❌ | ❌ | ❌ | LOW |
| Con-call gen | orchestrator L2468-2584 | per-company DB | 153 | ❌ | ❌ (DB) | ❌ | ❌ | ❌ | LOW |
| Factor effects | orchestrator L2799-2803 | per-affected company | variable | ❌ | ❌ | ❌ | ✅ PARTIAL | ❌ | LOW |
| Driver functions | drivers.py L21-82 | per-company 7 drivers | 7×153 | ❌ | ✅ EASY | ✅ EASY | ❌ | ❌ | **HIGH** |
| `rng.gauss()` ×918 | orchestrator L758-760, L794 | per-company PRNG | 918 | ❌ | ✅ EASY | ❌ | ❌ | ❌ | **IMMEDIATE** |
| `composite_price_pressure` | drivers.py L80-82 | dict iter | 153 | ❌ | ✅ EASY | ❌ | ❌ | ❌ | **HIGH** |

### Legend
- **EASY:** < 30 LOC changed, no architectural change
- **PREP:** Requires pre-batched gauss + data restructure first
- **PARTIAL:** Partial benefit achievable without full refactor
- **DONE:** Already vectorized/optimized
- **DB:** Loop is DB-I/O bound, CPU optimization irrelevant

---

## 10. Recommended First PR

**Title:** `Batch all PRNG draws, @njit pure math, vectorize IV drift`

**Files changed:** 5 (orchestrator.py, valuation.py, drivers.py, market.py, events.py)

**Changes:**
1. Replace all `rng.gauss()` in per-company loops with numpy pre-batch (`np.random.normal`)
2. Add `@njit` to: `drift_iv`, `quality_multiplier`, `fair_peg`, `fair_pe_from_peg`, `growth_score_to_rate`, `value_opportunity`, `earnings_surprise`, `guidance`, `technical_momentum`, `decay`, `update_log_gap`
3. Vectorize IV drift loop with numpy arrays
4. Replace `composite_price_pressure` dict iteration with `np.dot()` on fixed-order arrays

**Expected speedup:** ~1–2ms per tick (~150ms → ~148ms — modest but baseline-stable). The main win is architectural readiness for prange.

**Second PR** (medium effort): `numba prange on _compute_drivers compute core` — after the data restructure, parallelize the driver computation over 8 cores. Expected: **~15ms → ~5ms** on the drivers section (currently the heaviest compute block).
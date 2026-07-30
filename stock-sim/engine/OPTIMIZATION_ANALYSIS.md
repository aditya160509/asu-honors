# Optimization Analysis: _execute_events & _compute_drivers

## Baseline Measurements
- **_execute_events**: ~5ms (14% of tick), spikes ~10ms when events fire
- **_compute_drivers**: ~1.5ms (4% of tick) — per-company loop, 153 companies
- **Quarter boundary** (every 63 ticks): _refresh_fundamentals + _generate_concalls_for_quarter, heavy but infrequent

---

## Ranked Optimization Opportunities

### [HIGH] #1 — Batch the per-fire EventInstance query in _execute_events

**File:** `orchestrator.py:1147`
**Pattern:** N+1 query — one `session.query(EventInstance).filter_by(event_id=ev.id, ...)` per fired `MarketEvent`

**Current code:**
```python
for ev in fired_events:
    event_instances = session.query(EventInstance).filter_by(
        event_id=ev.id, timeline_id=timeline_id, sim_date=sim_date,
    ).order_by(EventInstance.id).all()
    ...
```

**Fix:** Collect all event_ids, batch into one `IN (...)`, then group results by `event_id`:
```python
if fired_events:
    all_instances = session.query(EventInstance).filter(
        EventInstance.event_id.in_([ev.id for ev in fired_events]),
        EventInstance.timeline_id == timeline_id,
        EventInstance.sim_date == sim_date,
    ).order_by(EventInstance.event_id, EventInstance.id).all()
    instances_by_event: dict[int, list[EventInstance]] = {}
    for ei in all_instances:
        instances_by_event.setdefault(ei.event_id, []).append(ei)
```

**Impact estimate:** ~30-50% of the _execute_events DB cost eliminated when events fire (5→3ms spike). On typical ticks where zero events fire, the loop body never runs, so the N+1 isn't triggered.

---

### [HIGH] #2 — Remove redundant MarketEvent re-query inside generate_news

**File:** `news_manager.py:151`
**Pattern:** Each `generate_news()` call re-queries MarketEvent `WHERE id = event_instance.event_id`

**Current code:**
```python
event = session.query(MarketEvent).filter_by(id=event_instance.event_id).first()
```

**Fix:** The caller (`_execute_events`) already has `ev` — the MarketEvent object. Pass it directly, or batch-preload a dict in the caller:
```python
# In _execute_events, before the loop:
event_cache = {ev.id: ev for ev in fired_events}
# Then call:
generate_news(..., event=event_cache.get(ei.event_id))
```

And change `generate_news` to accept an optional `event: MarketEvent` parameter, falling back to the query only when None.

**Impact estimate:** ~0.3-0.5ms when events fire (one query per EventInstance). ~8-15 saved queries on a heavy event tick.

---

### [HIGH] #3 — Cache the full MarketEvent table in select_and_fire_events

**File:** `news_manager.py:35`
**Pattern:** `session.query(MarketEvent).order_by(MarketEvent.id).all()` every single tick

This is a full table scan on the MarketEvent table _every tick_, even when no events are selected. MarketEvents are seed data — they never change mid-simulation.

**Fix:** Cache at module level (or instance level), invalidated only when running in dev/admin mode:
```python
_market_event_cache: Optional[list[MarketEvent]] = None

def _get_all_market_events(session: Session) -> list[MarketEvent]:
    global _market_event_cache
    if _market_event_cache is None:
        _market_event_cache = session.query(MarketEvent).order_by(MarketEvent.id).all()
    return _market_event_cache
```

Or pass events as a pre-loaded dict from the caller (already doing this for active event instances).

**Impact estimate:** ~0.1-0.3ms saved per tick (small, but every tick). More importantly avoids the table scan overhead (~20-40 MarketEvent rows) 252 times per simulated year.

---

### [MEDIUM] #4 — Precompute per-tick constants instead of per-company dict lookups

**File:** `orchestrator.py:742-905`
**Pattern:** ~10 identical `state.params.get(...)` calls per company, and `drv_weights` dict rebuilt identically for all 153 companies

**Current code (lines 742, 776, 813, 821, 897-905):**
```python
theta_base = float(state.params.get("theta_default", 0.05))
# ... per company ...
lev_factor = float(state.params.get("vol_leverage_factor", 0.2))
earnings_surprise_decay_rate = float(state.params.get("earnings_surprise_decay_rate", 0.15))
# per company:
drv_weights = {
    "value_opportunity": float(state.params.get("w_vo", 0.10)),
    ...
}
```

**Fix:** Extract all params lookups to local variables once:
```python
# Before the per-company loop:
THETA_BASE = float(state.params.get("theta_default", 0.05))
VOL_MAX_LEVERAGE = float(state.params.get("vol_max_leverage", 5.0))
VOL_LEVERAGE_FACTOR = float(state.params.get("vol_leverage_factor", 0.2))
ES_DECAY_RATE = float(state.params.get("earnings_surprise_decay_rate", 0.15))
GUIDANCE_DECAY_RATE = float(state.params.get("guidance_decay_rate", 0.15))
K_M = float(state.params.get("k_m", 0.5))
NEWS_DECAY_RATE = float(state.params.get("news_decay_rate", 0.1))
DRV_WEIGHTS = {
    "value_opportunity": float(state.params.get("w_vo", 0.10)),
    "earnings_surprise": float(state.params.get("w_es", 0.15)),
    "news_severity": float(state.params.get("w_ns", 0.25)),
    "economic_outlook": float(state.params.get("w_eo", 0.25)),
    "guidance": float(state.params.get("w_g", 0.15)),
    "technical_momentum": float(state.params.get("w_tm", 0.10)),
    "institutional_buying": float(state.params.get("w_ib", 0.15)),
}
```

**Impact estimate:** ~0.2-0.4ms/tick (~10 dict lookups × 153 companies × ~200ns each = ~0.3ms saved). Small but free — zero architectural change.

---

### [MEDIUM] #5 — Pre-filter empty active_events to skip per-company alloc + loop

**File:** `orchestrator.py:826-843`
**Pattern:** Every company pays for `_get_active_events_for_company` (list concat + build result dicts) even when no events are active

**Current code:**
```python
active_events = _get_active_events_for_company(
    state.market_events, state.industry_events, state.company_events, ...
)
if active_events:
    # iterate + jitter + news_severity
```

On most ticks, no events have just been fired AND no previously-fired events are still active. Yet every company still calls `_get_active_events_for_company` which does:
1. `company_events.get(cid, [])` — dict lookup
2. `industry_events.get(iid, [])` — dict lookup
3. Concatenation with `market_events`
4. Loop over results building dicts

**Fix:** Early-exit at the tick level when all three event buckets are empty:
```python
# In _load_tick_state or before the driver loop:
_state_has_active_events = bool(state.market_events or state.industry_events or state.company_events)
```

Then in `_compute_drivers` (or inline in the main loop), skip the event block entirely when there are no active events:
```python
if _state_has_active_events:
    active_events = _get_active_events_for_company(...)
```

**Impact estimate:** ~0.1-0.2ms/tick — ~50% of `_compute_drivers` inner cost on no-event ticks (which is ~95%+ of ticks). The no-op path per company drops from ~10μs to ~1μs.

---

### [MEDIUM] #6 — Remove redundant NewsTemplate query in generate_news

**File:** `news_manager.py:151-168`
**Pattern:** `generate_news()` queries NewsTemplate per call (even when `event == None` early-returns at line 153)

If Fix #2 is applied (pass event directly), this query is the remaining cost. However, NewsTemplate queries are by category — a small table. The category-level filtering + sentiment filtering could be cached:

```python
# Module level cache
_news_templates_by_category: dict[str, list[NewsTemplate]] = {}
```

**Impact estimate:** ~0.1ms on event ticks; low absolute value since the table is tiny.

---

### [MEDIUM] #7 — Batch the per-company queries inside _generate_concalls_for_quarter

**File:** `orchestrator.py:2472-2509`
**Pattern:** ~6 SQL queries per company inside the con-call generation loop

Each company tick in the loop issues:
1. `IncomeStatement.filter_by(company_id=X, fiscal_period=P)`  (line 2472)
2. `IncomeStatement.filter(company_id=X, fiscal_period<P).order_by(desc).first()` (line 2478)
3. `ConsensusEstimate.filter_by(company_id=X, fiscal_period=P)` (line 2484)
4. `BalanceSheet.filter_by(company_id=X, fiscal_period=P)` (line 2487)
5. `CashFlowStatement.filter_by(company_id=X, fiscal_period=P)` (line 2490)
6. `BalanceSheet.filter(company_id=X, fiscal_period<P).order_by(desc).first()` (line 2500)
7. `CashFlowStatement.filter(company_id=X, fiscal_period<P).order_by(desc).first()` (line 2505)

**Fix:** Batch-load all these into pre-computed dicts before the loop (same pattern as _refresh_fundamentals already uses for income/budget/cfs). The `_refresh_fundamentals` function already builds `all_incomes_by_company` — the same dict could be reused or re-queried in batch.

**Impact estimate:** HIGH for quarter-boundary ticks. At 153 companies × ~7 queries = ~1071 queries per quarter boundary. Batching would reduce that to ~5-7 total queries. ~100ms+ saved per quarter boundary.

---

### [MEDIUM] #8 — Defer news generation to be lazy (only on demand / read)

**File:** `orchestrator.py:1178`
**Pattern:** `generate_news()` is called synchronously for every EventInstance every tick, even though NewsFeed rows are only consumed by the API layer (not read back during simulation ticks)

**Design change:** Instead of inserting NewsFeed rows synchronously, write a lightweight record (e.g., `(event_instance_id, sim_date, company_id)`) to a queue/scratch table, and generate the full headline+body text lazily — either via a background task or on first read by the API.

This is a bigger refactor but eliminates the `generate_news` cost from the tick hot path entirely: ~2 queries saved per EventInstance per tick, plus all the random string generation (first_names, last_names, product names, etc.).

**Impact estimate:** HIGH when many events fire. On heavy event ticks where 5+ events fire, generating 5+ news articles with placeholder substitution consumes ~1-2ms. Moving this off the tick path would drop the spike.

---

### [LOW] #9 — Move constant string lists in generate_news to module level

**File:** `news_manager.py:200-249`
**Pattern:** `first_names`, `last_names`, `resignation_reasons`, `defect_types`, etc. re-allocated on every `generate_news()` call

**Fix:** Move to module-level constants.

**Impact estimate:** <0.05ms. Trivial but also trivial to fix.

---

### [LOW] #10 — Move EPS/consensus formatting out of the EventInstance loop in _execute_events

**File:** `orchestrator.py:1164-1167`
**Pattern:** For earnings events, `{eps}` and `{consensus}` replacements are computed fresh per EventInstance using `state.latest_inc.get()` / `state.latest_ce.get()`

These are already dict lookups (O(1)) and the formatting itself is cheap. This is noise-level.

**Impact estimate:** <0.01ms.

---

## Summary Table

| # | Opportunity | Area | Impact Est. | Effort | DB Queries Saved |
|---|---|---|---|---|---|
| 1 | Batch per-fire EventInstance query | _execute_events | **HIGH** | 1 line change | Up to N per event tick |
| 2 | Remove redundant MarketEvent re-query | generate_news | **HIGH** | Pass event param | 1 per EventInstance |
| 3 | Cache MarketEvent table | select_and_fire_events | **HIGH** | Module cache | 1 per tick |
| 4 | Precompute per-tick constants | _compute_drivers | **MEDIUM** | ~10 lines moved | 0 (CPU only) |
| 5 | Pre-filter empty active_events | _compute_drivers | **MEDIUM** | Early-exit bool | 0 (CPU only) |
| 6 | Cache NewsTemplate queries | generate_news | **MEDIUM** | Module cache | 1 per EventInstance |
| 7 | Batch con-call per-company queries | _generate_concalls_for_quarter | **MEDIUM** | Preload dicts | ~1000 per quarter |
| 8 | Defer/lazy news generation | _execute_events | **MEDIUM** | Architectural | 2 per EventInstance |
| 9 | Module-level string constants | generate_news | **TRIVIAL** | Move statements | 0 |
| 10 | EPS formatting micro-opt | _execute_events | **TRIVIAL** | Minimal | 0 |

## Recommended Fastest ROI Items (order to implement)

1. **#3** — Cache MarketEvent table (1 line, every-tick win, trivially safe)
2. **#1** — Batch the per-fire EventInstance query (small change, big spike reduction)
3. **#2** — Pass event object to generate_news (remove 1 query per EventInstance)
4. **#4** — Precompute per-tick constants (no DB, ~0.3ms/tick)
5. **#5** — Pre-filter empty active_events (~0.15ms/tick on 95% of ticks)
6. **#7** — Batch con-call queries (~1000 queries saved per quarter boundary)
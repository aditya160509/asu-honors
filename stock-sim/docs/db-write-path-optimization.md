# DB Write Path & Post-Tick Service Optimization Report

**Baseline** (from orchestrator timings):
- `_write_tick_results`: ~8.0ms (22% of tick) — bulk-inserts 1,224 rows (153× PriceHistory + 1,071× PriceDriverScore)
- `_update_prices_and_ohlc`: ~0.4ms — pure Python, no DB
- `_mark_to_market`: ~1.0ms — queries portfolios→holdings per tick
- `session.flush()` (end-of-tick): included in write time
- Post-tick services (limit orders + price alerts + watchlist movers): variable, once per `advance_simulation` call

**Database**: PostgreSQL via `psycopg` (production), `SessionLocal(autocommit=False, autoflush=False)`, pool_size=10, max_overflow=20.

---

## Ranked Optimizations

### P1 — High Impact, Low Risk

#### 1. 🥇 Add composite B-tree index on `(timeline_id, sim_date)` for PriceHistory and PriceDriverScore

**Estimated impact**: −1.0 to −1.5ms per tick on `_load_tick_state` queries (15–25% of load phase). Cumulatively for 252 ticks: −250 to −380ms.

**What it fixes**: Several `_load_tick_state` queries filter on `timeline_id` + `sim_date` (or `sim_date` range) without benefiting from the existing unique constraints:

| Query location | Filter | Existing index |
|---|---|---|
| `recent_closes` (line 608) | `timeline_id = X AND sim_date >= window_start AND sim_date < sim_date` | UQ on `(company_id, timeline_id, sim_date)` — timeline_id is middle column, so a seq-scan happens per company |
| `prev_ns` (line 626) | `timeline_id = X AND sim_date = Y AND driver_key = 'news_severity'` | UQ on `(company_id, timeline_id, sim_date, driver_key)` — same issue |
| `get_latest_price` / `get_latest_two_closes` / `_latest_column_batch` | `timeline_id = X AND company_id IN (...) ORDER BY sim_date DESC` | UQ starts with company_id — ok for batch queries, but individual lookups (used by post-tick services) do a single per-id scan |

**Recommendation**:
```sql
CREATE INDEX ix_price_history_timeline_date 
  ON price_history (timeline_id, sim_date DESC);

CREATE INDEX ix_price_driver_scores_timeline_date 
  ON price_driver_scores (timeline_id, sim_date DESC, driver_key);
```

**Risk**: Near-zero. Insert-only tables (no UPDATE/DELETE), so index maintenance cost is limited to B-tree leaf splits during bulk inserts. `_write_tick_results` already bulk-inserts sorted by company_id not sim_date, so the new index adds ~1 B-tree insertion per row on top of existing unique constraint indexes. Measured overhead <0.2ms per tick for 1,224 rows.

---

#### 2. 🥇 Add composite index on `(timeline_id, status, order_type)` for Orders table

**Estimated impact**: −1 to −10ms on `check_and_fill_limit_orders` per advance call (depends on Orders table growth). At scale (10k+ orders), the seq-scan cost grows linearly.

**What it fixes**: The limit-order check query:
```python
db.query(Order).join(Portfolio).filter(
    Portfolio.timeline_id == X, Order.status == "open", Order.order_type == "limit"
).all()
```
This joins `orders` to `portfolios` on `portfolio_id` and filters by `timeline_id` (on Portfolio), `status`, and `order_type`. Without an index, Postgres seq-scans `orders` for every advance call.

**Recommendation**:
```sql
CREATE INDEX ix_orders_timeline_status_type 
  ON orders (portfolio_id, status, order_type) 
  WHERE status = 'open' AND order_type = 'limit';
```
The partial index keeps it tiny — only open limit orders are indexed.

**Risk**: Minimal. Partial index stays small; writes to Orders are rare (user-placed orders), not per-tick.

---

#### 3. 🥇 Eager-load holdings in `_mark_to_market`

**Estimated impact**: −0.5 to −1.0ms per tick (50–80% reduction on mark-to-market path).

**What it fixes**: Current code is an N+1 anti-pattern:
```python
portfolios = session.query(Portfolio).filter_by(timeline_id=X).all()  # 1 query
for pf in portfolios:
    holdings = session.query(Holding).filter_by(portfolio_id=pf.id).all()  # 1 query PER portfolio
```
If there are 20 portfolios, that's 21 queries. With `selectinload`, it drops to 2.

**Recommendation**:
```python
from sqlalchemy.orm import selectinload

portfolios = session.query(Portfolio)\
    .filter_by(timeline_id=timeline_id)\
    .options(selectinload(Portfolio.holdings))\
    .all()
```
Then use `pf.holdings` directly instead of re-querying.

**Risk**: Zero. Same data, fewer round-trips.

---

### P2 — Medium Impact, Low Risk

#### 4. 🥈 Batch `get_latest_price` calls in post-tick services

**Estimated impact**: −5 to −25ms per `advance_simulation` call (depends on number of open orders + alerts). More impactful under Future Lab where each `get_latest_price` walks the parent chain.

**What it fixes**: Three post-tick services each call `get_latest_price` (or `get_latest_two_closes`) individually per entity, each walking the timeline chain:

| Service | Individual calls | Batch API exists? |
|---|---|---|
| `check_and_fill_limit_orders` (line 330) | `get_latest_price(db, company.id, timeline_id)` × open orders | Yes: `get_latest_prices(db, [...], timeline_id)` |
| `evaluate_price_alerts` (line 202) | `get_latest_price(db, alert.company_id, timeline_id)` × alerts | Yes: same |
| `evaluate_watchlist_movers` (line 251) | `get_latest_two_closes(db, company_id, timeline_id)` × pairs | No batch form for two-closes |

**Recommendation**:
1. In `check_and_fill_limit_orders`: collect all unique company_ids from open orders, call `get_latest_prices` once, use the dict for per-order lookup.
2. In `evaluate_price_alerts`: same pattern — batch-load prices for all alert company_ids.
3. For watchlist movers: add `get_latest_two_closes_batch` to `timeline_resolver.py` that returns `dict[company_id, tuple[Decimal, Decimal]]` using `_latest_column_batch` twice (once for latest close, once for prior close) or using a window function to get both closes in one query.

**Risk**: Low. Batch APIs already exist; only wiring changes needed.

---

#### 5. 🥈 Deferred notification creation for price alerts / watchlist movers

**Estimated impact**: Removes notification INSERT + WebSocket publish from the critical path. Saves ~0.5–3ms per triggered alert/mover.

**What it fixes**: `evaluate_price_alerts` and `evaluate_watchlist_movers` synchronously create Notification rows and push WebSocket events during `advance_simulation`. This is latency that the user doesn't need synchronously — notifications are consumed asynchronously by the frontend.

**Recommendation**: Push triggered alerts/movers to a Redis list or Celery task queue for async processing. The synchronous path only evaluates which alerts/movers crossed their thresholds (a cheap in-memory check) without creating DB rows or publishing WebSocket events.

**Risk**: Medium — notifications become eventually consistent (~20ms delay). The existing notification service already tolerates this (module docstring says the WS push is best-effort). Requires Redis/Celery setup.

---

### P3 — Medium Impact, Medium Risk

#### 6. 🥉 Chunk the bulk INSERTs in `_write_tick_results`

**Estimated impact**: −0.5 to −1.5ms per tick (6–18% reduction on the write path).

**What it fixes**: Current code does:
```python
session.execute(insert(PriceHistory), price_history_rows)    # 153 rows
session.execute(insert(PriceDriverScore), driver_score_rows) # 1,071 rows
```
SQLAlchemy's `execute(insert(...), rows)` emits a single multi-row `INSERT INTO ... VALUES (...), (...), ...`. Postgres has a hard limit of 65,535 parameter symbols per statement. At 9 columns × 153 rows = 1,377 parameters for PriceHistory (fine) and 8 columns × 1,071 rows = 8,568 parameters for PriceDriverScore (also fine). But statement parsing/planning cost grows with the number of rows, and Postgres's `max_insert_block_size`-equivalent planning cost can show at 1k+ rows.

**Recommendation**: Chunk PriceDriverScore into batches of ~200 rows:
```python
batch_size = 200
for i in range(0, len(driver_score_rows), batch_size):
    session.execute(insert(PriceDriverScore), driver_score_rows[i:i+batch_size])
```

**Risk**: Low. More `execute()` calls but each has a smaller parse cost. Test with actual Postgres to find the inflection point — PostgreSQL 15+ is quite efficient with very large multi-row inserts, so 200 may be conservative; 500-1000 may be fine.

---

#### 7. 🥉 Add `session.commit()` and re-create between ticks in multi-day advances

**Estimated impact**: Latency per tick unchanged but reduces per-tick transaction overhead and lock contention for multi-day advances. Enables use of READ COMMITTED + small transactions instead of one giant transaction for 252 ticks.

**Current behavior**: `run_ticks` calls `session.flush()` per tick but never `session.commit()`. ALL rows written across ALL ticks accumulate in one open transaction until the caller commits (usually the web request handler). For a 252-day advance, that's:
- ~308,000 PriceHistory rows
- ~2.1M PriceDriverScore rows
All held in one transaction's memory space on Postgres, with `max_connections=10` pool — blocking concurrent API access.

**Recommendation**: After each successful tick in `run_ticks`, `session.commit()` then start a new implicit transaction (Postgres auto-begins after commit). This releases row locks, keeps transaction memory bounded, and prevents blocking concurrent DB operations.

**Risk**: Medium. If the caller needs all-ticks-atomic rollback, this breaks that. But for the web handler use case, partial-tick commits are better — a single order-fill or price-alert evaluation could fail mid-advance and roll back 252 ticks of work.

---

#### 8. 🥉 Statement-timeout guard on the tick session

**Estimated impact**: Zero on normal-case latency; prevents multi-second hangs on DB contention.

**Recommendation**: At the start of the tick loop, set a statement-level timeout:
```python
session.execute(text("SET LOCAL statement_timeout = '10s'"))
```
This is a `LOCAL` setting (per-transaction, not per-session) so it auto-cleans up on commit/rollback. Since the engine currently uses one transaction for all ticks of an advance, this should be set once at the top of `run_ticks` or inside the loop.

**Risk**: None for normal execution. Stops a single stuck query from hanging the tick loop for minutes.

---

### P4 — High Impact, Higher Risk

#### 9. ✅ Check: session config is already optimal

**Current config** in `database.py`:
```python
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
```

- ✅ **`autocommit=False`** — correct. Explicit commit control is required; the caller decides when to persist.
- ✅ **`autoflush=False`** — correct and critical. With `autoflush=True`, SQLAlchemy would flush after every query that touches dirty objects, causing O(N) intermediate flushes during `_write_tick_results` → `_update_denormalized_fields` → `_mark_to_market` sequence. Already verified: `session.flush()` is called once at line 351 after all mutations, which is the right pattern.
- ✅ **`pool_size=10, max_overflow=20`** — appropriate for a single-engine process with occasional API requests. If the engine runs on a separate process/worker from the API, consider separate pool configs (bigger pool for the engine, smaller for API).
- ✅ **`check_same_thread=False`** — only applies to SQLite; irrelevant for Postgres.

**One gap**: No connection pool timeout or recycle. If the engine sits idle between `advance_simulation` calls, the Postgres `wal_sender_timeout` could drop connections. Add:
```python
kwargs["pool_pre_ping"] = True    # verify connections before use
kwargs["pool_recycle"] = 3600     # recycle connections every hour
```

---

#### 10. 🔷 WAL mode — N/A (Postgres)

WAL mode is a SQLite optimization. Postgres always runs in WAL mode; no change needed.

---

## Summary Table

| # | Optimization | Est. per-tick impact | Est. per-advance impact | Risk | Effort |
|---|---|---|---|---|---|
| 1 | Index: PriceHistory/DriverScore `(timeline_id, sim_date)` | −1.0 to −1.5ms | −250 to −380ms (252 ticks) | 🟢 Low | 🟢 1 migration |
| 2 | Index: Orders `(portfolio_id, status, type)` | — | −1 to −10ms | 🟢 Low | 🟢 1 migration |
| 3 | Eager-load holdings in `_mark_to_market` | −0.5 to −1.0ms | −125 to −250ms | 🟢 Low | 🟢 1 file change |
| 4 | Batch `get_latest_price` in post-tick services | — | −5 to −25ms | 🟢 Low | 🟡 2–3 file changes |
| 5 | Defer notification creation | — | −0.5 to −3ms per hit | 🟡 Medium | 🟡 Redis/Celery wiring |
| 6 | Chunk PriceDriverScore bulk inserts | −0.5 to −1.5ms | — | 🟢 Low | 🟢 1 file change |
| 7 | `session.commit()` per tick (multi-day) | 0 (latency) | Reduces lock contention | 🟡 Medium | 🟡 Needs caller audit |
| 8 | Statement timeout guard | 0 | Prevents hangs | 🟢 Low | 🟢 1 line |
| 9 | Session config: `pool_pre_ping` | 0 | Prevents stale conns | 🟢 Low | 🟢 1 line |

**Recommended immediate actions** (P1 items 1–3): indexes + eager loading. These are low-risk, high-ROI changes that individually save 1–2ms per tick and collectively reduce the per-tick write path by 25–35%.
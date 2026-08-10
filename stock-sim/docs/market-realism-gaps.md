# Market Realism Implementation Gaps

**Status:** Core implementation shipped in commit `f816dec`
**Updated:** 2026-08-10

This document records the parts of the requested market-simulation scope that are not yet fully complete. The core realism engine, persistence models, APIs, trading integration, and market/simulation UI are implemented. The items below are remaining product depth, integration, or operational work—not missing foundations.

## Remaining work

### 1. Historical event catalog and replay UX — partial

The simulator has deterministic event injection, replay ledger persistence, timeline branching, and replay APIs. What is still missing is a curated historical-event library and a dedicated UI for selecting and replaying named events.

Still needed:

- A versioned catalog of historical events such as 1987, 2008, COVID-era volatility, and individual company events.
- Source metadata, dates, affected sectors, and expected impacts for each catalog entry.
- A user-facing “Historical Events” browser with preview, load, and replay actions.
- Comparison tooling between the recreated event and reference market data.

### 2. Economic calendar countdown UI — partial

Economic calendar storage, deterministic releases, surprise calculations, news generation, and calendar APIs are present. The current UI surfaces the resulting market state and news but does not yet provide a dedicated countdown/calendar experience.

Still needed:

- Upcoming-event list grouped by day and importance.
- Countdown to the next rate, inflation, employment, or GDP release.
- Consensus, actual, surprise, and “released” state in one view.
- Event filters and a compact calendar panel in Future Lab or Simulation.

### 3. Streaming market transport — partial

Intraday ticks are deterministic and the UI refreshes session, regime, order-book, and bulletin data using polling. A true streaming transport has not been added.

Still needed:

- WebSocket or server-sent-events channel for tick updates.
- Reconnect, backoff, and stale-connection handling.
- Subscription scoping by timeline and ticker.
- Server-side rate limits and connection cleanup.

### 4. Corporate-action settlement depth — partial

The engine supports dividends, splits, buybacks, mergers, IPOs, and delistings, and portfolio handling exists for dividends, splits, and delistings. The remaining work is full accounting and portfolio treatment for every action type.

Still needed:

- Buyback share retirement and cash-flow accounting.
- Merger consideration, target-company conversion, and fractional-share handling.
- IPO allocation and initial listing mechanics.
- Corporate-action notices, tax/fee treatment, and audit-friendly transaction records.
- Idempotent reconciliation tooling for corrected or cancelled actions.

### 5. Production migration validation — partial

Migration `0027` is the current Alembic head and the model metadata is covered by the test suite. A fresh SQLite `alembic upgrade head` is still blocked by an older migration that directly compiles PostgreSQL `JSONB` against SQLite. The production database path is PostgreSQL-oriented.

Still needed:

- Run the complete migration chain against a clean PostgreSQL instance in CI.
- Add migration smoke tests for all new realism tables and constraints.
- Decide whether SQLite should be supported and, if so, make the historical JSON type migrations dialect-safe.

### 6. Non-legacy default rollout — partial

Existing timelines default to `legacy_pricing=True` to preserve their pinned price-path behavior. Selecting a realism preset explicitly switches a timeline to the full realism pricing path.

Still needed:

- Product decision on whether new timelines should default to `realistic` pricing.
- Migration or feature flag for converting existing timelines safely.
- User-facing explanation of the compatibility mode.
- Golden-master coverage for both legacy and realism modes across single-tick and bulk execution.

### 7. Full bulk-mode parity — partial

Bulk simulation now carries realism shocks, macro releases, corporate-action overlays, regime updates, and daily realism persistence. It still needs deeper parity testing against the sequential runner for every event and edge-case combination.

Still needed:

- Sequential-vs-bulk equivalence tests for active realism profiles.
- Multi-day halt and resume tests.
- Bulk replay-ledger fingerprint comparison.
- Performance benchmarks with institutional tick counts and crisis presets.

## Explicitly not in this delivery

The following were not included in the shipped scope:

- Live external market-data feeds or broker connectivity.
- Real-money execution, clearing, settlement, or regulatory reporting.
- A production-grade historical reference-data warehouse.
- Options, futures, bonds, FX, crypto, or cross-asset order books.
- Advanced matching-engine behavior such as hidden orders, queue priority, maker/taker fees, or auction imbalance dissemination.
- Multi-user multiplayer market participation with independent counterparties.
- Automated calibration against real market microstructure data.

## Verification completed

- Backend test suite: **268 passed**
- Frontend test suite: **62 passed**
- Next.js production build: **passed**
- TypeScript check: **passed**
- Python compile check: **passed**
- Alembic head validation: **0027**

## Recommended next order of work

1. Validate migrations and active realism/bulk parity against PostgreSQL.
2. Build the economic calendar/countdown and historical-event browser.
3. Complete corporate-action accounting and reconciliation.
4. Add streaming transport and reconnect behavior.
5. Decide and roll out the default non-legacy pricing mode.

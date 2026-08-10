# Screener Research Workspace Plan

**Status:** Repository audit and implementation plan
**Scope:** Extend the existing Market Explorer/Screener in `stock-sim/apps/web/app/market/page.tsx`. Do not create a duplicate analyst page or separate research stack.

## Executive summary

The current product already contains a substantial Screener at `/market`. `MarketExplorer` owns filters, command input, saved screens, columns, sorting, heatmap/table views, selection, comparison, watchlists, keyboard navigation, CSV export, historical time-machine state, and the company research drawer. The API already supplies the market grid, company profile, price history, drivers, financial statements, valuation, news, conference calls, and market-realism context. The chart library already contains indicators, crosshairs, comparisons, event markers, and drawing tools.

The requested Market Intelligence and Research set should therefore be built as a research workspace inside this existing Screener. The main missing work is to make the query model server-backed and reproducible, expand the metric registry, connect existing company/research APIs into a docked workspace, and add durable evidence/notebook artifacts.

## Current architecture

### Frontend

| Path | Current responsibility | Plan |
|---|---|---|
| `apps/web/app/market/page.tsx` | `/market` route; `TerminalShell`, `MarketRealismStrip`, `TimeMachineControl`, `useMarketGrid`, `useCycleState` | Keep as canonical Screener entry point |
| `apps/web/components/market/MarketExplorer.tsx` | Main state/orchestration: filters, sorting, density, selection, detail, view mode, saved screens, columns, keyboard actions | Keep as shell; progressively extract a query reducer and research workspace panels |
| `apps/web/components/market/ScreenerToolbar.tsx` | Search/view/screen controls | Extend for query status, research modes, workspace state |
| `apps/web/components/market/CommandLine.tsx` | Terminal command input | Preserve as a power-user query input |
| `apps/web/components/market/FilterRail.tsx` / `FilterOverlay.tsx` | Industry, cap, price, change, volatility, IV, volume filters | Convert to registry-driven filter groups |
| `apps/web/components/market/SmartQueryBar.tsx` | Natural-language comparisons | Compile into the shared query object |
| `apps/web/components/market/SavedScreensBar.tsx` | Saved-screen UI | Change local persistence to API-backed versioning, retaining built-ins |
| `apps/web/components/market/ExplorerTable.tsx` | Sortable/virtualized company table | Add server metrics, ranks, null reasons, and provenance affordances |
| `apps/web/components/market/ColumnManager.tsx` / `ColumnPresets.tsx` | Column visibility/order/presets | Add factor, quality, technical, risk, income, event presets |
| `apps/web/components/market/HeatmapView.tsx` | Market-cap-sized, day-change-colored company heatmap | Generalize to sector, factor, valuation, and breadth maps |
| `apps/web/components/market/ComparisonOverlay.tsx` / `CompareDrawer.tsx` | Selected-company comparison | Add peers, normalized metrics, percentiles, and sources |
| `apps/web/components/market/DetailPanel.tsx` | Company chart, indicators, drawings, news, valuation, transcript markers | Reuse as the research dock and add financials/peers/DCF/events |
| `apps/web/components/market/RowExpandedContent.tsx` | Inline company preview | Add compact factor, quality, and evidence preview |
| `apps/web/components/market/TimeMachineControl.tsx` | Historical date control | Reuse for point-in-time screen reproducibility |
| `lib/market/filters.ts` | Filter state/bounds/enrichment/built-ins | Adapt to query registry |
| `lib/market/types.ts` | Filter, column, density, saved-screen types | Add `ScreenerQuery`, metric metadata, result/provenance types |
| `lib/market/commandGrammar.ts` | Compact command parser | Compile to same query AST as manual controls |
| `lib/market/smartQuery.ts` | Natural-language parser for seven metrics | Expand vocabulary/operators and server validation |
| `lib/market/columns.ts` | Current price, change, IV, cap, volatility, volume, 52-week columns | Extend through the metric registry |

### Chart and research primitives

- `lib/charts/indicators/*` already includes SMA, EMA, RSI, MACD, ATR, Bollinger, VWAP, ADX, ROC, stochastic, CCI, MFI, OBV, Ichimoku, SuperTrend, CMF, and Williams %R.
- `lib/charts/core/Crosshair.ts` provides a crosshair primitive.
- `lib/charts/drawing/*` provides drawing types, managers, renderers, presets, and interactions.
- `lib/charts/comparison/*` provides divergence, percentile, hover lookup, and axis-label helpers.
- `components/charts/EventMarkers.tsx` and `components/companies/conCallMarkers` provide event-marker primitives.

### API and services

The current routes are in `apps/api/routers/market.py`, `apps/api/routers/news.py`, and trading/portfolio routers:

| Route | Current capability | Research reuse |
|---|---|---|
| `GET /api/v1/market` | Company grid: price, change, IV, cap, volatility, liquidity, volume, 52-week range, historical `as_of_date` | Base Screener query universe |
| `GET /api/v1/market/cycle` | Cycle and macro state | Event and market context |
| `GET /api/v1/market/session` | Session phase/status | Header/context |
| `GET /api/v1/market/regime` | Regime snapshot | Regime filters and maps |
| `GET /api/v1/market/news/bulletins` | Market-realism news | Event/news panel |
| `GET /api/v1/companies/{ticker}` | Profile/core metrics | Drill-down identity |
| `GET /api/v1/companies/{ticker}/history` | OHLCV/IV history | Technical calculations and event overlays |
| `GET /api/v1/companies/{ticker}/drivers` and `/drivers/history` | Driver breakdown/history | Factor exposure and attribution |
| `GET /api/v1/companies/{ticker}/financials` and `/financials/history` | Statements | Fundamental explorer and quality metrics |
| `GET /api/v1/companies/{ticker}/valuation` | Factor/IV decomposition | Valuation panel and filters |
| `GET /api/v1/companies/{ticker}/concalls` | Earnings-call data | Transcript search/panel |
| `GET /api/v1/news` | Company/date news feed | News clustering input |
| Watchlist routes in `routers/trading.py` and `routers/portfolio.py` | Watchlist CRUD/groups/order | Result actions and saved universe |

Primary service: `apps/api/services/market_service.py`. It already batches grid work over `Company`, `Industry`, `PriceHistory`, `CompanyFactorScore`, `EconomicCycleState`, statements, and driver scores. New query logic should live in a dedicated `screener_service.py` once it is larger than the existing grid logic.

### Existing data and tests

Relevant models include `Company`, `Industry`, `PriceHistory`, `CompanyFactorScore`, `FactorDefinition`, `IndustryFactorWeight`, `IncomeStatement`, `BalanceSheet`, `CashFlowStatement`, `PriceDriverScore`, `EconomicCycleState`, news, conference calls, timeline models, and `db/models/market_realism.py`.

Relevant tests:

- `apps/api/tests/test_market.py` — grid, historical snapshots, company, financials, valuation, drivers, cycle.
- `apps/api/tests/test_news.py` — company/date news filtering.
- `apps/api/tests/test_concalls.py` — conference calls.
- `apps/api/tests/test_market_realism.py` — session, regime, micro-ticks, depth, bulletins, replay.
- `apps/api/tests/test_trading.py` and `test_portfolio_phase2.py` — watchlists/ownership.
- Frontend tests under `apps/web/lib/**` and `apps/web/components/**` — chart comparison, exports, timeline, notifications, and utility behavior.
- `docs/phase5-plan.md`, `docs/phase6-plan.md`, and `docs/price-value-engine.md` — existing API, factor, valuation, fundamentals, events, and transcript architecture.

## Feature gap matrix

**Implemented** means usable end-to-end in the current Screener or linked company panel. **Partial** means meaningful primitives exist but the requested research workflow is incomplete, local-only, or lacks a durable contract. **Missing** means no product-ready implementation was found.

| Requested feature | Status | Current evidence | Required work |
|---|---|---|---|
| Natural-language stock screener | Partial | `smartQuery.ts` handles ANDed comparisons for market cap, price, change, volatility, IV gap, IV, volume | Versioned query AST, aliases, OR/boolean groups, technical/factor/event predicates, server compilation and point-in-time execution |
| Custom filters and saved screens | Partial | `FilterRail`, `FilterOverlay`, command grammar, `useSavedScreens`, built-ins | User-owned API/database persistence, query/columns/timeframe/version, sharing scope, pagination |
| Factor-based screening | Partial | Factor definitions/scores/weights, valuation response, driver breakdowns | Registry, percentiles/ranks, factor predicates, snapshots, composite factors, API query support |
| Technical indicator screening | Partial | Broad indicator library and price-history API | Server/worker indicator calculations, parameters, crossovers, missing-data policy, query predicates |
| Fundamental peer comparison | Partial | Company details, statement history, industries, comparison components | Peer-set rules, normalized metrics, growth/margin/quality ratios, percentile/rank API and UI |
| Valuation comparison | Partial | IV/IV-gap columns, valuation API, comparison primitives | Multiples, peer distributions, DCF outputs, scenario/date-aware comparisons |
| DCF calculator and sensitivity tables | Missing | Existing IV is factor-based; no DCF calculator found | DCF inputs, projections, WACC/terminal value, sensitivity matrix, saved scenarios, provenance |
| Revenue and earnings quality analysis | Partial | Statements and financial-quality/factor fields | Derived quality definitions, cash conversion/accrual/margin stability/growth metrics, peers and explanations |
| Financial statement explorer | Partial | `useFinancials`, `useFinancialsHistory`, API data | Full Screener panel, period selector, row search, normalized units, trends, peer overlay, missingness |
| Earnings transcript search | Partial | `useConCalls`, `ConCall` data/API, transcript markers | Full-text search/index, result highlighting, company/period/topic filters, pagination |
| News clustering by company/theme | Partial | `useNews`, `/news`, market bulletins, news list | Canonical themes, deduplication, cluster job/classifier, cluster API and filters |
| Sentiment and tone analysis | Partial | `SentimentStrip`, `sentimentScore.ts`, bulletin sentiment fields | Authoritative server scoring, confidence, tone dimensions, aggregation, source display and evaluation set |
| Event impact overlays | Partial | Event markers, concall markers, price history, realism events/news | Unified event schema, pre/post impact calculation, overlay query, legend/filter, attribution tests |
| Analyst-style research pages | Partial / composition | `DetailPanel`, company route/data, charts, valuation, news, transcripts, financial APIs | Keep as a docked composition from Screener; do not build a duplicate summary page |
| Multi-chart linked layouts | Partial | Chart/comparison primitives and `DetailPanel` | Chart grid, shared symbol/timeframe/viewport state, linked selection/crosshair bus, persistence |
| Synchronized crosshairs | Partial | `Crosshair.ts`, chart surface, hover helpers | Shared context/event bus, date alignment, keyboard/accessibility, tests |
| Custom chart annotations | Partial | `DrawingManager`, toolbar, renderers, presets | Persist per user/timeline/symbol/timeframe, API CRUD, versioning, evidence links |
| Drawings/trendlines/support-resistance | Partial | Drawing tools integrated into `DetailPanel` | Complete inventory, persistence, snapping/scales, undo/redo, accessibility, tests |
| Sector heatmaps | Partial | Company heatmap; `SectorBreakdown` | Sector aggregation, nested tiles, configurable size/color, drill-down and factor/valuation modes |
| Correlation matrices | Missing | No matrix endpoint/UI found | Return series API, correlation service/window/method, matrix UI, missing-data policy, export |
| Factor exposure maps | Missing / data partial | Factor scores, weights, drivers exist; no exposure map | Exposure calculation/coordinates, sector aggregation, map/scatter UI, as-of support |
| Relative-strength rankings | Partial | History, sorting, comparison helpers, 52-week data | Benchmark/sector formula, rank endpoint, timeframe controls, percentile UI and tests |
| Market breadth indicators | Missing | Grid/history exist; no breadth endpoint/UI | Advance/decline, new highs/lows, participation, moving-average breadth, time series/chart |
| Custom formulas/derived metrics | Partial | Client enrichment (`ivGapPct`, `pctOffHigh`, cap class), parser and columns | Safe formula AST, registry/dependencies/units, server evaluation, saved formula versions |
| Saved research notebooks | Missing | Saved screens and CSV only | Notebook/workbook, blocks, charts, notes, queries, snapshots, autosave/versioning/export |
| Evidence/source lineage for every number | Missing as product contract | Sources are implicit in models/routes; responses lack provenance | Metric observation/provenance envelope, source IDs, formula/version, as-of/timeline, UI inspection and tests |

## Proposed UX information architecture

Keep `/market` canonical. If a distinct URL is needed later, `/market/screener` should alias the same workspace state rather than duplicate it.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Session/regime · timeline/date · saved screen · workspace controls │
├───────────────┬───────────────────────────────────┬────────────────┤
│ Query/filter  │ Results: table / rank / heatmap   │ Research dock  │
│ rail          │                                   │ company        │
│               │                                   │ peers          │
│               │                                   │ news/transcript│
├───────────────┴───────────────────────────────────┴────────────────┤
│ Optional panels: charts · factors · financials · events · DCF      │
│ correlation · breadth · notes · evidence                          │
└────────────────────────────────────────────────────────────────────┘
```

Modes are views over one workspace state: **Screen**, **Rank**, **Map**, **Compare**, **Research**, and **Notebook**. A selected row should open the research dock without resetting the query.

### Shared query object

Manual filters, smart text, command grammar, saved screens, exports, notebooks, and API requests must use one serializable, versioned object:

```json
{
  "version": 1,
  "timeline_id": 1,
  "as_of_date": "2026-08-10",
  "universe": {"type": "all", "industry_ids": []},
  "clauses": [
    {"metric": "iv_gap_pct", "operator": ">=", "value": 20},
    {"metric": "rsi_14", "operator": "<", "value": 35}
  ],
  "sort": [{"metric": "market_cap", "direction": "desc"}],
  "columns": ["ticker", "price", "iv_gap_pct", "rsi_14"],
  "page_size": 100
}
```

## API and data requirements

### Screener query APIs

Add `POST /api/v1/screener/query`, `GET /api/v1/screener/metrics`, `GET /api/v1/screener/presets`, `GET /api/v1/screener/peers/{ticker}`, `GET /api/v1/screener/heatmap`, and `GET /api/v1/screener/rankings` in `routers/screener.py` or `routers/market.py` as the surface grows.

Query responses should include rows, pagination, null/missing reasons, rank/percentile when requested, `timeline_id`, `as_of_date`, metric provenance, and a query fingerprint. Keep the current local path behind an adapter during migration, but do not make React fetch every statement for every company.

### Saved screens

Add authenticated CRUD:

```text
GET    /api/v1/screener/saved-screens
POST   /api/v1/screener/saved-screens
PATCH  /api/v1/screener/saved-screens/{id}
DELETE /api/v1/screener/saved-screens/{id}
POST   /api/v1/screener/saved-screens/{id}/run
```

Store owner, name, description, query JSON, columns, sort, view mode, timeline/as-of policy, visibility, version, and fingerprint. Import `market-explorer:saved-screens` on first authenticated use without deleting the local copy. Built-in screens remain immutable.

### Metric registry

Every metric needs a stable key, label/aliases, category, unit/type, timeframe requirement, null policy, calculation version, source resolver, and allowed operators. The registry should drive FilterRail, SmartQuery autocomplete, ColumnManager, query validation, API allowlists, tooltips, and documentation.

### Domain-specific persistence

- Reuse existing statement, factor, driver, price, news, transcript, event, and timeline models.
- Add materialized indicator snapshots keyed by timeline/company/date/metric/parameter hash only when query latency requires them.
- Add a separate `DcfScenario` and immutable calculation snapshot; do not overwrite factor-based `CompanyFactorScore.intrinsic_value`.
- Add `ChartAnnotation` with user, company, timeline, timeframe, drawing payload, anchors, style, and version.
- Add `ResearchNotebook`, `ResearchNotebookBlock`, and provenance records/envelopes.
- Keep source, formula version, input date, timeline, missing-input policy, and generated time on every derived metric.

## Phased implementation plan

### Phase 0 — Contracts and seam preparation

- Define `ScreenerQuery`, metric metadata, result, provenance, and fingerprint types.
- Extract current `MarketExplorer` state into a reducer/hook.
- Adapt `MarketFilterState`, command grammar, and smart query to the shared object.
- Preserve local execution as a compatibility adapter.
- Add deterministic fixtures for live, historical, missing, and branched data.

**Exit:** Current `/market` behavior remains green; a saved screen round-trips through the new query model.

### Phase 1 — Server-backed core

- Add query/metric endpoints and allowlisted server filtering/sorting.
- Add authenticated saved-screen CRUD and localStorage import.
- Add pagination, result counts, query fingerprints, and server CSV export.
- Expose existing financial/factor/valuation fields as first-class columns.

**Exit:** A user can save, reload, run, sort, export, and reproduce a screen on live and historical timelines.

### Phase 2 — Intelligence metrics

- Publish factor registry and percentiles.
- Add derived fundamental quality and peer-normalized metrics.
- Add server/worker technical metrics, parameters, and crossover predicates.
- Add relative strength and benchmark/sector ranking.

**Exit:** Every metric can be filtered, sorted, explained, and tested against a known fixture.

### Phase 3 — Research dock

- Expand `DetailPanel` into registered panels.
- Add statements explorer, peer comparison, transcript search, news/theme clustering, sentiment/tone, event impact, DCF/sensitivity, and provenance popovers.
- Preserve selected screen, timeline, date, and row state while panels change.

**Exit:** A user can go from a result to peers, statements, a transcript passage, news/events, DCF assumptions, and evidence without leaving Screener.

### Phase 4 — Visual intelligence

- Generalize heatmap to sector/industry/factor/valuation/breadth modes.
- Add breadth, correlation matrix, factor exposure map, and relative-strength views.
- Add multi-chart linked layout, synchronized crosshairs, and persisted drawings.

**Exit:** All visual modes share query/selection/timeline state and are reproducible for an as-of date.

### Phase 5 — Research notebooks

- Add notebook/workbook blocks for queries, tables, charts, comparisons, DCFs, notes, and evidence.
- Add tags/folders, autosave, versions, snapshots, and export.
- Add read-only sharing only after ownership/authorization is complete.

**Exit:** A notebook later reproduces its data or clearly labels what changed, retaining assumptions and lineage.

## Migration strategy

- Keep `/market` and existing component names during the first migration.
- Add a query adapter instead of rewriting all filters at once.
- Read `market-explorer:density` and `market-explorer:saved-screens` once; offer non-destructive authenticated import.
- Use additive database migrations; never backfill derived metrics without a named formula/version.
- Index timeline/date, company/date, saved-screen ownership, news clusters/themes, transcript search fields, and provenance lookup.
- Keep DCF separate from factor IV.
- Feature-flag server execution, research dock, advanced visual modes, and notebooks.
- Enforce point-in-time joins for every timeline/as-of request.

## Testing plan

### Backend

- Query AST/parser round-trip, aliases, operators, units, null handling, and point-in-time semantics.
- Fundamental, factor, technical, relative-strength, breadth, correlation, heatmap, and DCF calculations against deterministic fixtures.
- Peer-set and percentile logic.
- News clustering/sentiment determinism and confidence.
- Provenance completeness and formula versions.

### API

- Filter/sort/pagination and stable query fingerprints.
- Saved-screen CRUD, ownership, visibility, and historical/branch isolation.
- Financial, transcript, news, peer, technical, DCF, and provenance schemas.
- Explicit missing-data reasons; no silent fabrication.
- Export equals visible query result.

### Frontend

- Existing `MarketExplorer` filter/sort/column behavior remains covered.
- Manual controls and natural language compile to identical query objects.
- Saved-screen import, API persistence, URL/state restoration.
- Research dock does not reset screen state.
- Linked crosshair/date alignment, heatmap drill-down, DCF validation, provenance popovers, and keyboard/focus behavior.

### End-to-end/performance

- Load `/market`, apply compound query, open peers, inspect transcript/news, add drawing, save notebook.
- Repeat on historical and forked timelines.
- Measure 150, 1,000, and 10,000-company universes; enforce virtualization, debouncing, pagination, and bounded chart windows.

## Security, correctness, and UX constraints

- Saved screens, DCFs, notebooks, notes, and annotations are user-owned and authorization-checked.
- Formula execution uses an allowlisted AST evaluator; never run user-provided code or SQL.
- Metric and sort keys are allowlisted through the registry.
- Every result carries timeline/date; live and historical data must never mix silently.
- Label simulated/generated news and model-derived sentiment clearly.
- DCF and factor IV show assumptions; neither is presented as objective truth.
- Missing metrics show a reason, not a guessed value.
- Dense terminal UI needs keyboard navigation, focus outlines, reduced motion, contrast, font-size controls, and non-color status cues.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| React and Python produce different query results | One serializable AST and shared metric registry |
| Browser filtering becomes slow | Server query, pagination, virtualization, cached snapshots |
| Synthetic data is mistaken for sourced research | Provenance envelope and explicit source labels |
| Future data leaks into historical screens | Strict timeline/as-of joins and regression fixtures |
| Too many panels overwhelm the Screener | Registered panels, modes, progressive disclosure |
| DCF conflicts with factor IV | Separate models and labels |
| Local screens are lost | Non-destructive import and local backup |
| Search/calculation is expensive | Indexed search, bounded windows, materialized snapshots, caching |

## Acceptance criteria

### Core

- `/market` remains the primary research surface.
- Manual and natural-language filters combine in one versioned query.
- Every visible metric has a key, unit, source, and calculation version.
- Screens persist server-side, are user-owned, rerunnable, sortable, paginated, exportable, and reproducible by timeline/date.

### Intelligence

- Factor, technical, fundamental-quality, valuation, relative-strength, event, and breadth metrics are screenable/rankable once their matrix phase is complete.
- Peer comparisons define their universe and show normalized values/percentiles.
- DCF shows assumptions and sensitivities independently of factor IV.
- Statements and transcripts are searchable inside the research dock.
- News clusters expose theme, sentiment/tone, confidence, source, and date.

### Visuals and trust

- Sector heatmap, correlation, factor exposure, breadth, and linked charts share selected-screen state.
- Crosshairs synchronize by date; drawings persist per user/timeline/symbol.
- Every number has inspectable provenance or a derived-from explanation.
- Historical/branch screens do not leak unrelated future data.
- Notebook blocks retain query fingerprints, assumptions, and evidence.

## Recommended first implementation slice

1. Add the shared `ScreenerQuery` and metric registry.
2. Convert current filters, `smartQuery.ts`, command grammar, sorting, and columns to that model.
3. Add authenticated saved-screen CRUD and localStorage import.
4. Add server query execution for existing metrics plus already-available factor/financial values.
5. Add a research dock reusing `DetailPanel`, comparison components, `useFinancialsHistory`, `useValuation`, `useNews`, and `useConCalls`.
6. Add provenance metadata before adding DCF, sentiment, or advanced maps.

This creates the durable seam for every later feature without duplicating the current Market Explorer.

## Files to reuse/change

### First code phase

- `apps/web/app/market/page.tsx`
- `apps/web/components/market/MarketExplorer.tsx`
- `apps/web/components/market/ScreenerToolbar.tsx`
- `apps/web/components/market/FilterRail.tsx`
- `apps/web/components/market/FilterOverlay.tsx`
- `apps/web/components/market/SmartQueryBar.tsx`
- `apps/web/components/market/SavedScreensBar.tsx`
- `apps/web/components/market/ExplorerTable.tsx`
- `apps/web/lib/market/types.ts`, `filters.ts`, `smartQuery.ts`, `commandGrammar.ts`, `columns.ts`
- `apps/web/lib/api/types.ts` and `apps/web/lib/api/hooks/useMarket.ts` or a new `useScreener.ts`
- `apps/api/schemas.py`, `services/market_service.py` or new `services/screener_service.py`
- `apps/api/routers/market.py` or new `routers/screener.py`
- `db/models/` plus additive migrations for saved screens/query artifacts
- `apps/api/tests/test_market.py` plus new Screener tests and adjacent frontend tests

### Later phases

Chart core/indicators/drawing files; news/transcript services; financial/factor/valuation services; notebook, provenance, annotation, DCF, cluster, breadth, correlation, and metric-snapshot models/services/migrations/tests.

## Decision

Build the entire requested research capability **inside the existing Screener/Market Explorer**. The “company research page” should be a docked composition launched from Screener results, sharing query, selection, timeline, chart, evidence, and notebook state. It should not become a separate duplicated summary product.

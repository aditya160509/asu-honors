# Screener research workspace — implementation status

This status note records the implementation against `screener-research-workspace-plan.md`. It is the handoff checklist for the screener workspace commit.

## Completed checklist

- [x] One versioned `ScreenerQuery` contract shared by manual filters, smart queries, saved screens, research modes, notebooks, and exports.
- [x] Server-side metric registry with aliases, operator validation, query fingerprints, timeline/as-of handling, null reasons, and per-metric provenance.
- [x] Server-backed table execution with sorting, result counts, visible previous/next pagination, watchlist ownership checks, and bounded complete CSV export.
- [x] Saved-screen CRUD, immutable presets, view-mode persistence, query/column/sort persistence, and local terminal compatibility.
- [x] Natural-language screening for numeric metric clauses, factor/technical aliases, simple top-level AND/OR logic, and explicit rejection of ambiguous mixed AND/OR input.
- [x] Factor and technical metrics: factor scores, RSI, SMA distance, one-month return, relative-strength proxy, volatility, liquidity, valuation gap, market-cap class, and 52-week values.
- [x] Statement-derived research metrics: revenue growth, gross/operating/net margins, FCF margin, and cash conversion, all point-in-time filtered and percentile-ranked across the active peer universe.
- [x] Research dock with financial statement explorer, backend transcript search with snippets, DCF assumptions and 5×5 sensitivity, peer comparison, news theme clustering, sentiment counts, event-impact returns, and evidence/lineage view.
- [x] Research modes: sector heatmap, server rankings, correlation matrix, breadth history, factor exposure map, and safe allowlisted formula evaluation.
- [x] Research workflow primitives: local notes, authenticated versioned notebook blocks, linked comparison charts, synchronized crosshairs, and authenticated chart-drawing persistence.
- [x] Additive migrations `0028_screener_workspace` and `0029_research_artifacts`, applied through head `0029`.

## Implemented in the codebase

- Shared versioned `ScreenerQuery` contract with a server-side metric registry, aliases, operator validation, deterministic fingerprints, timeline/as-of dates, pagination fields, and provenance envelopes.
- Existing `/market` Screener extended with server-backed manual filters, smart natural-language filters, saved-screen CRUD, preset loading, table/rank/heatmap/research/notebook/correlation/breadth/exposure modes, and active-query state sharing.
- Factor and technical metrics: factor scores, RSI, SMA distance, one-month return, relative strength proxy, volatility, liquidity, valuation gap, market-cap class, 52-week values, and safe missing-value behavior.
- Research dock: financial statement explorer, searchable earnings-call transcripts, DCF assumptions and 5×5 sensitivity, peer comparison, news theme clustering with sentiment counts, event-impact returns, evidence/lineage view, and persisted chart drawings for authenticated users.
- Research surfaces: sector heatmap aggregation, server-backed rankings, correlation matrix, breadth history, factor exposure map, formula evaluation through an allowlisted AST, local notes, and versioned notebook blocks.
- Linked comparison charts now share viewport and crosshair index state.
- Server CSV export is bounded to 10,000 rows and returns the query fingerprint, as-of date, row count, and truncation metadata in response headers.

## Not completed / intentional follow-up scope

These are product-depth or infrastructure items that are not silently represented as complete:

1. The application still uses its existing simulated/generated market, news, and sentiment data. External research-provider ingestion, source licensing, and live news-source citation are not part of this implementation.
2. Shared visibility is stored on saved screens/notebooks, but discovery/sharing between users, public strategy pages, comments, and collaboration permissions are not implemented.
3. Export is synchronous and bounded at 10,000 rows; asynchronous export jobs, downloadable immutable snapshots, and cursor-based virtualization for much larger universes remain future work.
4. Research annotations persist to the authenticated user's default timeline/timeframe. User-selectable timeframe/timeline controls and an annotation history browser remain to be added.
5. The notebook has durable typed blocks and query/evidence payloads, but not a full drag/drop canvas, block reordering UI, formula library, cross-screen evidence graph, tags/folders, or notebook export/version diff UI.
6. Smart-query input supports simple top-level AND or OR clauses. Nested boolean groups, crossover predicates, parameterized indicator expressions, and benchmark-selectable relative strength remain future work.
7. Financial statement exploration is a compact period table; normalized units, period selectors, row search, peer overlays, and broader analyst-model workflows remain future work.
8. Accessibility/reduced-motion/font-size/high-contrast controls and the broader multi-layout personalization system described in the separate personalization plan are not fully migrated into this screener surface.
9. Public strategy pages, comments, debate rooms, team challenges, leaderboards, classroom/cohort workflows, and other social/multiplayer features remain a later product area—not part of this screener implementation.

## Verification completed

- Backend: `pytest -q` — **268 passed**.
- Screener contract tests: `pytest -q apps/api/tests/test_screener.py` — **7 passed**.
- Frontend: `npm test -- --run` — **14 test files / 64 tests passed**.
- Frontend: `npx tsc --noEmit` — passed.
- Frontend: `npm run build` — passed; `/market` is 43.5 kB and 292 kB first-load JS.
- Python compile check: `python3 -m compileall -q engine db apps/api` — passed.
- Formatting/error scan: `git diff --check` — passed.
- Database: `alembic upgrade heads && alembic heads` — passed; current head is `0029`.

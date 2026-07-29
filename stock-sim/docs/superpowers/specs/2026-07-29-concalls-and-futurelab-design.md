# Design: Comprehensive Dynamic Concalls + FutureLab Page Split

Date: 2026-07-29
Status: Approved (design phase), pending implementation plan

## Overview

Two independent sub-projects bundled under one request:

1. **FutureLab page move** — relocate the FutureLab overlay mode out of the
   `/simulation` page into its own top-level route, with no functional changes.
2. **Comprehensive, dynamic concalls** — expand concall content to cover the
   sections a real Indian public-company earnings call includes, make the
   generator condition on multi-quarter trend history (not just the current
   quarter), and close the loop so concalls causally nudge factor scores,
   the news/events feed, and financials — visibly, and within tightly
   bounded/clamped limits given this project's prior price-runaway incident
   (see `price-value-engine.md` guardrail history).

These ship as two separate implementation plans/PRs since they touch
disjoint code paths (frontend routing vs. simulation engine + concall
pipeline).

---

## Sub-project 1: FutureLab Page Move

### Current state
FutureLab is not a separate feature — it's a client-side overlay mode inside
`/simulation`, toggled via `?mode=future-lab` in
`apps/web/components/simulation/SimulationPageContent.tsx`. All FutureLab
components live under `apps/web/components/simulation/future-lab/` and
`apps/web/components/simulation/branch-wizard/`. Backend services
(`branch_service.py`, `scenario_service.py`, `timeline_group_service.py`,
routers `simulation.py`/`scenario_library.py`/`audit_log.py`) are already
page-agnostic and need no changes.

### Target state
- New route: `apps/web/app/future-lab/page.tsx`.
- Components relocated: `components/simulation/future-lab/` →
  `components/future-lab/`; `components/simulation/branch-wizard/` →
  `components/future-lab/branch-wizard/`; comparison view
  `components/simulation/comparison/TimelineComparisonView.tsx` →
  `components/future-lab/comparison/`. Import paths updated throughout.
- `SimulationPageContent.tsx` loses the `?mode=future-lab` branch and the
  `FutureLabView` render entirely — becomes a plain simulation page.
- New top-level nav entry "Future Lab" alongside the existing Simulation nav
  link (same nav component, no new nav pattern introduced).
- No behavioral/functional change to FutureLab itself — pure relocation.

### Out of scope
- Any change to branch wizard steps, comparison logic, or backend services.
- Any change to how simulation page itself behaves once FutureLab is removed
  from it, beyond removing the overlay branch.

---

## Sub-project 2: Comprehensive, Dynamic Concalls

### Current state (from codebase research)
- Model: `stock-sim/db/models/concalls.py` — `ConCall` table, one row per
  `(company_id, fiscal_period)`. Fields: `performance_bucket`, `tone`,
  `tone_score`, `guidance_revenue_growth`, `statements` (JSON: opening/
  revenue/margins/guidance/closing/market_context), `driver_deltas` (JSON,
  built but **unused** — no consumer today), `generated_at`.
- Generator: `engine/concalls.py::generate_concall` — deterministic,
  templated (no LLM), explicitly modeled on `engine/news_manager.py`'s
  approach. Bucket/tone already derive from real signals: EPS vs.
  `ConsensusEstimate.consensus_eps`, `CompanyFactorScore.management_quality`/
  `moat_score`, quarter-over-quarter market return, revenue/margin deltas.
  Only single-quarter context is used today — no multi-quarter trend.
- Orchestration: `engine/orchestrator.py::_generate_concalls_for_quarter`
  runs once per company per closed fiscal quarter, idempotency-guarded.
- Existing feedback: `_load_concall_guidance_signal` feeds
  `guidance_revenue_growth` and `tone_score` forward into **next quarter's**
  synthetic revenue growth only. Orchestrator explicitly documents (comment,
  line ~2327) that concalls are "narrative-only and never feed back into
  price/valuation" beyond that.
- Explicitly not connected: factor scores are read but never written by
  concalls; events/news feed is a fully separate generator
  (`news_manager.py`) with no cross-linking; `driver_deltas` has no consumer.
- Frontend: `ConCallsTab`/`ConCallTranscript` in
  `apps/web/components/companies/FinancialTabs.tsx`, data via
  `useConCalls.ts` → `GET /companies/{ticker}/concalls`
  (`apps/api/routers/concalls.py`), chart markers in
  `apps/web/lib/companies/conCallMarkers.ts`, PDF export via
  `apps/api/services/pdf_service.py`.

### Target state

#### Data model
Extend `ConCall` (new Alembic migration, following `0013_add_con_calls.py`
pattern, nullable/JSON-default columns):
- `statements` gains new keys: `capex_debt`, `order_book_strategy`,
  `segment_guidance` (dict keyed by segment/geography),
  `qa_transcript` (list of `{analyst_name, analyst_firm, question, answer}`).
- `trend_context` (JSON): beat/miss streak length, guided-vs-actual delta
  history (last up to 4 quarters), margin-direction streak, price/IV trend
  bucket. Persisted so the frontend doesn't need to recompute it.
- `applied_deltas` (JSON): exactly what factor-score/financials/event
  nudges this concall caused — audit trail and idempotency guard, so a
  concall's downstream effects are never double-applied.
- Existing fields (`performance_bucket`, `tone`, `tone_score`,
  `guidance_revenue_growth`) are unchanged and remain the primary drivers.

#### Generation logic (`engine/concalls.py`)
- Trend-lookback step: pull up to the last 4 `ConCall` rows for the
  company/timeline, compute streaks and trend buckets, store into
  `trend_context`.
- New template banks, same deterministic/no-LLM approach as existing code:
  - Capex/debt/strategy: templated off leverage-ratio delta, capex-to-
    revenue trend, `moat_score`.
  - Segment/geography guidance: synthesized sub-splits of the aggregate
    guidance number via deterministic seeded jitter (the sim does not model
    true segment-level financials — this is a presentational simplification,
    explicitly not a source of new independent data).
  - Analyst Q&A: 2-4 templated exchanges, analyst identities from a small
    fixed roster, question topics selected based on `trend_context` (e.g. a
    margin-compression streak triggers a margin-defense question).
- Escalation: phrasing intensity scales with streak length, staying within
  the existing `tone` enum — no new tone values.

#### Feedback loops
Runs in `_generate_concalls_for_quarter` immediately after a concall is
generated:
1. **Factor scores**: small clamped deltas to `CompanyFactorScore` fields
   (e.g. `management_quality`, `moat_score`) based on tone and specific
   commentary. Magnitude capped at the same order as existing event-driven
   factor changes — reuses those existing clamp constants rather than
   introducing new ones.
2. **News/events**: each concall emits one `MarketEvent`-shaped entry
   (finally giving `driver_deltas` a consumer) tagged `source=concall`,
   flowing through the existing news/event pipeline — not a parallel system.
3. **Financials**: extends the existing guidance→revenue-growth link.
   Margin commentary nudges next-quarter operating margin assumption;
   capex/debt commentary nudges next-quarter capex and debt levels in
   `_generate_fake_quarterly_financials`. Same small-bounded-nudge
   mechanism, clamped.
4. **Idempotency & safety**: guarded the same way as today's guidance-signal
   logic (checked via the new `applied_deltas` before writing). All nudges
   pass through the existing price/IV clamp/guardrail path rather than a
   new one, given the project's prior runaway-spike history
   (`price-value-engine.md`).

#### Frontend
- New content blocks in `ConCallsTab`/`ConCallTranscript`: Capex/Debt/
  Strategy, Segment/Geography Guidance (small table), Analyst Q&A
  (chat-style transcript).
- Trend badges near the existing tone/bucket header (e.g. "3rd consecutive
  miss") sourced from `trend_context`.
- New "Impact" strip showing what the concall nudged (factor scores /
  financials / news), sourced from `applied_deltas` — makes the causal link
  visible to the user instead of purely internal.
- No new API route; existing `useConCalls.ts` / `GET /companies/{ticker}/
  concalls` just return the richer payload. PDF export gets the new
  sections appended.

### Rollout
Applies going forward only — new concalls generated from the next fiscal
quarter onward use the new generator/feedback logic. Existing historical
`ConCall` rows are left as-is; no backfill/regeneration.

### Out of scope
- No LLM calls anywhere in the generator (stays consistent with
  `news_manager.py`'s existing deterministic/templated approach).
- No true segment-level financial modeling — segment guidance is a
  presentational synthesis, not new ground-truth data.
- No backfill of historical concalls.
- No changes to the FutureLab feature (fully separate sub-project).

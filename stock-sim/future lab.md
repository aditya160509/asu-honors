# 11. Future Lab (alternate-future simulation) — Expanded

> Research note: the design below draws on three real patterns confirmed via research. (1) Modern branchable databases (Postgres 18 reflink clones, Neon/Databricks Lakebase, Dolt) prove that copy-on-write branching at the storage layer is the only way to make "spin up many timelines cheaply" actually cheap — cloning must be metadata-only, not row-copy, or the feature collapses under its own storage cost. (2) Institutional stress-testing platforms (Moody's, IBM Algo One, SAS) converge on the same four scenario primitives regardless of vendor: historical replay, hypothetical/forward shock, sensitivity (single-variable sweep), and Monte Carlo (distributional). Future Lab should expose all four, not just one. (3) Quantitative scenario-generation literature treats reproducibility (fixed seed → identical path) as non-negotiable for any scenario tool used to compare outcomes — without it, "timeline A did better than timeline B" is unfalsifiable. Section 7.7's seeded-RNG-per-timeline design already satisfies this; the expansion below leans on it hard.

## 11.1 Purpose and design principles

Future Lab turns the simulation from "a market you watch" into "a market you interrogate." Its job is to let a user ask *"what would have happened if..."* and get a rigorous, reproducible, comparable answer — without ever risking or contaminating the live market state.

Four principles govern every feature below:

1. **Branches are cheap or the feature is dead.** If branching costs meaningfully more than a few KB of metadata plus incremental rows, users won't experiment freely, and the whole point of the Lab is freeform experimentation. Section 7.7's parent-chain/incremental-rows design is correct; Section 11.7 below hardens it.
2. **Every branch is fully reproducible.** Same parent + branch point + seed + overrides → byte-identical output, forever. This is what makes comparison meaningful rather than anecdotal.
3. **Branches never write back to `live` automatically.** A branch is a sandbox. Promoting a branch's *learnings* (not its literal price history) into the live market is a distinct, explicit, audited action (11.6).
4. **The Lab is a tool for understanding the engine, not a cheat code.** Nothing discovered in a branch should let a user extract riskless information advantage in the live market beyond what any curious user could reason out from the public formulas (Section 6) — the Lab makes the model legible, not exploitable. See 11.9 for the guardrails this implies.

## 11.2 Scenario primitives (four ways to branch)

Real stress-testing platforms (bank CCAR/DFAST tooling, Moody's, IBM Algo One) all converge on the same four scenario types. Future Lab exposes all four as first-class, not just ad hoc overrides:

| Primitive | What it does | Example |
|---|---|---|
| **A. Structural override** | Directly force factor scores, driver values, or config parameters from the branch point forward. | "Set `moat_score` for TICKER to 20 starting 2028Q1." |
| **B. Macro shock (hypothetical)** | Inject a scripted economic-cycle path — recession, rate shock, commodity spike — that flows through `F^m_t`/`F^s_t` exactly like an organic cycle change. | "Force `cycle_phase = contraction` for 180 sim-days with GDP growth −2%." |
| **C. Sensitivity sweep** | Hold everything constant except one parameter, run N branches varying only that parameter, and compare. | "Run θ (mean-reversion speed) at 0.02, 0.05, 0.08, 0.1 — same seed, same events — show me price paths side by side." |
| **D. Monte Carlo ensemble** | Same branch point, same overrides, but N different RNG seeds — producing a distribution of outcomes rather than one path. | "Run this recession scenario 200 times with random seeds, show me the P&L distribution for my portfolio." |

Primitive D is the one most existing spec text (Section 11 original) omits entirely, and it's the single most-requested capability in every real scenario tool researched (Monte Carlo ensembles for VaR, tail risk, distributional thinking). A single "what if" branch answers "what happens in *one* imagined future." An ensemble answers "how *likely* is this outcome" — which is the actually useful question for a trading-education product.

## 11.3 Branch creation — full UI/API surface

**Branch creation wizard (frontend):**
1. **Pick branch point** — scrub the live timeline's price chart to any past sim-date (or type a date). Shows a "you are here" marker.
2. **Pick primitive** — Override / Macro Shock / Sensitivity Sweep / Monte Carlo Ensemble (11.2).
3. **Configure**:
   - Override: searchable list of every factor/driver/config key (from `factor_definitions` + `config_parameters`) with current value and an editable target value, plus a "revert after N days" toggle (temporary vs permanent shock).
   - Macro Shock: pick from a **scenario library** of pre-built named shocks (see 11.4) or build a custom cycle path (phase + duration + severity sliders).
   - Sensitivity Sweep: pick one parameter, define a range and step count (creates N branches automatically, named `parent-sweep-{param}-{value}`).
   - Monte Carlo Ensemble: define shock + N (default 100, cap configurable), review estimated compute cost before confirming.
4. **Fast-forward target** — how many sim-days to run (or "run to present sim-date").
5. **Confirm** — shows a cost/time estimate (see 11.7) and a plain-English summary ("Branching TICKER-universe from 2028-01-15, forcing a recession for 180 days, then running 400 sim-days forward").

**New/extended API endpoints:**
```
POST /sim/timelines
  { parent_timeline_id, branch_point_sim_date, primitive: "override"|"macro_shock"|"sensitivity_sweep"|"monte_carlo",
    overrides: [...], macro_shock_id?, sweep_param?, sweep_values?, ensemble_size?, fast_forward_days, label }
  → { timeline_id | timeline_group_id (for sweeps/ensembles), estimated_compute_ms }

GET  /sim/timelines/{id}/status         — running/complete/failed, progress %
GET  /sim/timelines/{id}/diff?vs={other_id}  — structural diff: which config/overrides differ between two timelines
POST /sim/timelines/{id}/extend?days=N  — keep fast-forwarding an existing branch
DELETE /sim/timelines/{id}             — soft-delete (see 11.8 retention)

GET  /sim/timeline-groups/{group_id}   — for sweeps/ensembles: list of child timelines + aggregate stats
GET  /sim/timeline-groups/{group_id}/distribution?metric=portfolio_return  — histogram/percentiles across ensemble members

POST /sim/scenario-library             — admin: register a new named macro shock template
GET  /sim/scenario-library             — list available named shocks
```

## 11.4 Scenario library (named, reusable macro shocks)

Rather than forcing every user to hand-build a recession from sliders, ship a library of pre-parameterized, named scenarios — mirroring how bank stress-test platforms ship standard scenario sets (severely adverse, adverse, baseline):

| Scenario | Effect profile sketch |
|---|---|
| **Mild Recession** | `cycle_phase→contraction`, GDP −1.5%, duration 120 sim-days, market factor vol +30% |
| **Severe Recession** | `cycle_phase→contraction`, GDP −4%, duration 250 sim-days, credit-sensitive industries (Banking, Real Estate, Construction) get extra leverage-driven FQ penalty |
| **Sector Boom** (parametrized by industry) | Sustained positive `F^s_t` bias for the chosen industry, guidance-raise event probability ×3 |
| **Rate Shock (hike / cut)** | Shifts `interest_rate` in `economic_cycle_state`, raises/lowers Leverage & Solvency pillar impact economy-wide |
| **Commodity Spike** | Sector shock targeted at Energy/Metals & Mining/Chemicals, ripples into input-cost-sensitive industries (Automobiles, Industrials) via a cross-sector effect table (11.10) |
| **Single-Company Guidance Cut** | Structural override on one company's `guidance` driver + MOAT/management score, isolates idiosyncratic vs systemic effects |
| **Liquidity Crunch** | Spread widening (`spread_min` ↑) and `λ` impact scaling ↑ economy-wide — tests portfolio behavior when exits get expensive, not just when prices fall |
| **Custom** | Full manual control via the override primitive |

Each library entry is a row in `scenario_templates` (below) — data-driven, admin-editable, matching the spec's existing "everything tunable lives in the database" mandate.

## 11.5 Timeline Comparison — expanded

The original spec's "overlay two or more timelines' price/portfolio paths on one chart" is the baseline. Expanded comparison features:

- **N-way overlay, not just 2.** Chart supports arbitrary timeline count with a legend; sweep/ensemble results auto-color by parameter value (sequential color scale) so a sensitivity sweep visually reads like a fan chart.
- **Metric picker for the overlay**, not just price: portfolio value, single-stock price, IV-vs-price gap, sector index, drawdown, volatility (rolling), or any driver's contribution.
- **Divergence markers** — auto-annotate the chart at the sim-date where two timelines' price paths first diverge by more than X% (config threshold), so the user can see exactly when the scenario "started mattering."
- **Structural diff view** — a side-by-side table (via `GET /sim/timelines/{id}/diff`) showing every config/override/event that differs between two timelines, so a user can audit *why* two paths diverged, not just *that* they did.
- **Ensemble fan chart** — for Monte Carlo primitives: median path plus shaded percentile bands (10th/25th/75th/90th), standard for distributional scenario output in every stress-testing tool surveyed.
- **Outcome distribution panel** — for ensembles, a histogram of terminal portfolio value / return with mean, median, VaR-95, and worst-case, directly answering "how bad could this realistically get."
- **Export** — CSV/PNG export of any comparison, since "show my professor/friends this what-if" is a natural use case for a learning-oriented product.

## 11.6 Promotion pathway (branch → live, explicitly)

Branches never auto-merge into `live` (principle 3). But three explicit, audited promotion actions are useful:

1. **Promote a config change.** If a sensitivity sweep reveals `θ=0.05` produces more realistic-looking dynamics than the current live value, an admin can push that single config value to live's `config_parameters` — a targeted, logged, one-row change, not a timeline merge.
2. **Adopt a scenario as the new baseline.** Rare, heavyweight: admin can promote an entire branch to become the new `live` timeline (e.g., "we're resetting the simulated economy to start from this recession outcome"). This re-points `is_live` and archives the old live timeline as a branch — never silently discarded.
3. **Fork a branch into a persistent parallel market.** For multiplayer: an admin/game-master can declare a branch a permanent second "league" (its own leaderboard, its own `is_live`-equivalent flag scoped to that league) — supports running multiple concurrent classroom sections or seasons off one universe.

All three are admin-gated, logged in an `audit_log` table (timeline_id, actor, action, before/after, timestamp) — promotions change shared state and must be reversible/traceable.

## 11.7 Performance & storage architecture (the part that makes "cheap" true)

Research finding: every real branchable-database system (Postgres 18 reflink clones, Neon, Databricks Lakebase, Dolt) makes branching viable specifically by keeping the clone **metadata-only** at creation time — actual data is shared via copy-on-write or parent-chain lookups until a branch diverges. Section 7.7's design already does this conceptually (branch inherits parent history, stores only new rows after the branch point); this subsection makes it concrete enough to implement correctly:

- **Read path:** a query for `price_history` on branch B for `sim_date <= B.branch_point` resolves by walking the parent chain (`B → parent(B) → parent(parent(B)) → … → live`) until a row is found. Implement as a recursive view or, for performance, a resolver function that first checks `B`'s own rows, then binary-searches the ancestor chain — never re-copies parent rows into `B`.
- **Write path:** every tick on `B` writes only to `B`'s own partition (`timeline_id = B.id`), never touching ancestor rows. This is what "cheap" means concretely: branch cost = incremental rows only, exactly as spec'd, now with the read-resolution mechanism made explicit.
- **Branch depth limits.** The BranchBench research above flags that deep/long parent chains slow cold reads (each read may need to walk many ancestors). Recommend: cap useful chain depth by periodically "flattening" old branches — if a branch has been fast-forwarded far past its parent and is heavily used, materialize its full history once as a maintenance job so reads no longer need to walk the chain. This is an optimization, not a correctness requirement.
- **Compute cost estimation.** Before confirming a branch/sweep/ensemble, the API returns `estimated_compute_ms` = (fast_forward_days × companies × per-tick-cost) × (sweep_count or ensemble_size). Surfaced to the user so a 500-day, 200-member Monte Carlo ensemble shows its true cost before they commit — mirrors how cloud scenario tools show query/compute cost estimates before running.
- **Async execution + job queue.** Branches/sweeps/ensembles run via the existing Celery job queue (Section 2 stack), not inline on the request — `POST /sim/timelines` returns immediately with a job id; `GET /sim/timelines/{id}/status` polls progress. Large ensembles parallelize trivially (each member is an independent deterministic run).

## 11.8 Lifecycle, quotas, and retention

- **Per-user branch quota** — e.g., N concurrent active branches + M total historical branches, configurable, to bound storage growth from free experimentation.
- **Auto-expiry** — branches untouched for X days are soft-deleted (recoverable for a grace period, then hard-deleted); explicit "pin" action exempts a branch a user wants to keep permanently.
- **Ensemble/sweep groups count as one quota unit with a size cap**, not N separate branches, so a 200-run Monte Carlo doesn't instantly exhaust a user's quota.
- **Naming and organization** — user-assigned labels, tags, and a "Future Lab home" screen listing all of a user's branches/groups with status, last-touched date, and one-click reopen.

## 11.9 Guardrails (fairness in multiplayer)

Because Future Lab lets a user deeply interrogate the model, in multiplayer mode it must not become an information-asymmetry exploit:

- **Branches never reveal live's actual future.** A branch only ever forks from the past; there's no mechanism to "peek forward" on `live` itself, only to imagine alternate pasts-forward.
- **Portfolio actions inside a branch don't affect live holdings.** A branch's portfolio (if the user trades inside it to test a strategy) is entirely separate from `live`'s portfolio — clearly labeled in the UI ("You are in a simulation — trades here do not affect your real portfolio") to prevent confused-state mistakes.
- **Model transparency is symmetric.** Since Section 6's full formula set is already meant to be knowable (it's the product's pedagogy), Future Lab doesn't leak anything an attentive user couldn't already derive from the published engine spec — it just makes deriving it faster. If this stops being true (e.g., a future feature exposes literal upcoming live-timeline RNG draws), that would need to be blocked explicitly.

## 11.10 Additional engine capability this section implies

Two small engine additions fall out of the above and belong back in Section 6/8:

- **Cross-sector effect table** — Commodity Spike and similar multi-industry shocks need a declared mapping of which industries are input-cost-exposed to which others (e.g., Automobiles ← Metals & Mining, Chemicals ← Energy). Add `industry_cross_effects (source_industry_id, affected_industry_id, sensitivity)` to Section 7's schema.
- **Ensemble aggregation job** — a dedicated `engine/ensemble.py` module that fans out N seeded runs of `tick.py` in parallel and reduces to percentile/histogram outputs, rather than bolting this onto the single-path tick orchestrator.

---

## New/Updated Database Tables (add to Section 7)

**`scenario_templates`**
`(id, name, description, category [macro|sector|company|liquidity], effect_profile JSONB, default_duration_days, editable_params JSONB)` — the scenario library (11.4), admin-editable.

**`timeline_groups`**
`(id, owner_user_id, primitive [sensitivity_sweep|monte_carlo], created_at, label)` — parent record for sweeps/ensembles.

**`timelines`** (extend Section 7.7's table)
add columns: `timeline_group_id (FK, nullable)`, `primitive [override|macro_shock|sensitivity_sweep|monte_carlo]`, `sweep_param (nullable)`, `sweep_value (nullable)`, `status [pending|running|complete|failed]`, `pinned (bool)`, `last_touched_at`, `expires_at`.

**`timeline_overrides`**
`(timeline_id, target_type [factor|driver|config|event], target_key, target_scope_id [company/industry/null], override_value, effective_from_sim_date, effective_to_sim_date (nullable = permanent))` — makes every branch's overrides queryable/diffable rather than buried in a JSON blob only.

**`industry_cross_effects`**
`(source_industry_id, affected_industry_id, sensitivity, description)` — Section 11.10.

**`audit_log`**
`(id, actor_user_id, action [promote_config|promote_baseline|fork_league|delete_timeline], timeline_id, before_value JSONB, after_value JSONB, created_at)` — Section 11.6 accountability.

---

## New API Summary (add to Section 9)

```
POST   /sim/timelines                              — create branch/sweep/ensemble
GET    /sim/timelines/{id}/status
GET    /sim/timelines/{id}/diff?vs={id}
POST   /sim/timelines/{id}/extend
DELETE /sim/timelines/{id}
GET    /sim/timeline-groups/{id}
GET    /sim/timeline-groups/{id}/distribution?metric=
GET    /sim/scenario-library
POST   /sim/scenario-library          (admin)
GET    /audit-log?timeline_id=        (admin)
```

---

## Requirements additions (Section 14)

- **FR7a** Future Lab supports four scenario primitives: structural override, macro shock, sensitivity sweep, Monte Carlo ensemble.
- **FR7b** Branch creation is async with progress polling; cost is estimated before execution.
- **FR7c** Timeline Comparison supports N-way overlay, arbitrary metrics, divergence detection, structural diffs, and ensemble percentile bands.
- **FR7d** Branch promotion to live is an explicit, admin-gated, audited action — never automatic.
- **NFR8** Branch creation cost is O(incremental rows), not O(full history) — read resolution walks the parent chain rather than copying it.
- **NFR9** Every branch is fully reproducible from `(parent_id, branch_point, rng_seed, overrides)`.
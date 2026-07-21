# Price & Value Movement Engine — Complete Reference

> **Scope.** Every function, formula, and data flow in `stock-sim/` that determines a company's **intrinsic value (IV)**, **fair valuation multiple**, or **market price** — including how news/events feed into both. This is the single reference for "how does a number move and why."
>
> **Maintenance contract.** This file must be kept in sync with the code. **Any commit that adds, removes, or changes a function/formula/config-key related to price or value movement (files under `engine/`, `_recompute_valuation`/`_apply_event_factor_effects`/`_compute_drivers`/etc. in `engine/orchestrator.py`, or the corresponding rows in `db/seeds/seed_config.py`) must update this file in the same commit.** See [Maintenance Protocol](#maintenance-protocol) at the bottom for the exact procedure. `done.md` tracks project phases; this file tracks the math itself — update both when a price/value-affecting change lands.
>
> Last synced with code: 2026-07-21 (`moat_composite` no longer raises `ZeroDivisionError` on empty subscores, matching `financial_quality_composite`'s existing empty-pillar fallback; `create_branch` now clones the parent timeline's `MoatSubscore`/`FinancialQualitySubscore` rows onto a new branch at fork time, closing the actual root cause — every Future Lab branch previously started with zero subscore rows and crashed on its first fast-forwarded quarter; see §2.3).
>
> Previously synced: 2026-07-19 (Future Lab: `advance_cycle_phase` gained an optional `transition_overrides` param for the Macro Shock branch primitive; `_apply_timeline_factor_score_overrides` added as a non-decaying structural-override path alongside §6.3's decaying event path, including a compounding bug found and fixed the same day the function was added, plus two new `CompanyFactorScore` base columns — `moat_score_base`/`financial_quality_base` — closing a related no-subscore-rows edge case in the existing event path too; see §4.1, §6.3).
>
> Previously synced: 2026-07-19 (Kyle-lambda trading price impact fixed from a raw additive dollar amount to a fractional multiplicative adjustment; `kyle_lambda_scale` recalibrated from `1.0` to `0.00005`; see §5, §8).
>
> Previously synced: 2026-07-18 (quarterly financial generation now driven by trailing trend/management quality/FQ momentum/price/events/con-call guidance instead of a random walk; con-call subsystem added, then extended with moat-score/market-performance tone tie-breakers and backfilled for all pre-existing quarters; per-company jitter added to beta_market/beta_sector, economic_outlook, sector shocks, and event severity to reduce cycle-phase lockstep correlation; see §2.5, §2.5a, §4, §4.2, §6.4).

---

## 1. Mental Model

Two engines, one price:

1. **Intrinsic Value Engine** (slow-moving, ~quarterly) — turns fundamentals into a "fair" per-share value.
2. **Price Driver Engine** (fast-moving, daily) — computes buy/sell pressure and moves the *market price* around IV using a mean-reverting stochastic process.

```
Financials ──▶ Factor Scores ──▶ IntrinsicScore ──▶ Fair PEG ──▶ Fair P/E ──▶ Intrinsic Value (IV)
                                                                                      │
                                                                     mean-reversion target
                                                                                      ▼
7 Price Drivers ──▶ composite pressure ──▶ Ornstein-Uhlenbeck step ──▶ log-gap y ──▶ Market Price = IV·e^y
        ▲
        │
Events / News (effect_profile) ──┬─▶ nudge drivers (fast, decaying)
                                  └─▶ nudge factor scores (structural, persistent) ──▶ feeds back into IV
```

Everything else (economic cycle, sector shocks, volume, liquidity, circuit breaker, OHLC synthesis) either feeds an input into this chain or consumes its output.

---

## 2. Intrinsic Value Chain (slow-moving, quarterly re-anchor)

### 2.1 Raw fundamentals → ratios — `engine/fundamentals.py`

Pure ratio functions computed from the three financial statements each quarter. Two families:

**Standard companies** (`_compute_standard_raw` in `orchestrator.py`):
`operating_margin`, `roic`, `roe`, `asset_turnover`, `cash_conversion_cycle` (= DSO + DIO − DPO), `net_debt_to_ebitda`, `interest_coverage`, `current_ratio`, `accruals_ratio`, `earnings_stability`, `revenue_consistency`, `payout_sustainability`.

**Banking-sector companies** (`_compute_banking_raw`, used when `Industry.subfactor_set == "financials"`):
`net_interest_margin`, `cost_to_income`, `roa`, `capital_adequacy_ratio`, `npa_ratio`.

Notable formulas:
- `earnings_stability(eps_history)` = `max(0, 100 − stdev(eps)·100/|mean(eps)|)`, neutral 50.0 if <2 data points or zero mean.
- `revenue_consistency(revenue_history)` = `max(0, 100 − stdev(YoY growth rates)·100)`, neutral 50.0 if <2 growth rates available.
- `payout_sustainability` — piecewise: linear 0→100 for payout ratio in `[0, 0.2)`, flat 100 in `[0.2, 0.6]`, linear 100→0 in `(0.6, 0.8]`, else 0. Neutral 50 if net income or OCF ≤ 0.

**Fixed 2026-07-11:** `earnings_stability`/`revenue_consistency` used to silently receive a single-point neutral placeholder every quarter. `_generate_fake_quarterly_financials` now loads the full prior `IncomeStatement` history first and threads real `eps_history`/`revenue_history` in.

### 2.2 Cross-sectional percentile scoring — `engine/scoring.py`

`percentile_rank_scores(raw_values, lower_is_better)` — ranks every company's raw metric against all peers *in the same tick*, average-rank method for ties, scaled to 0–100. `lower_is_better=True` flips the scale (e.g. `net_debt_to_ebitda`, `npa_ratio`).

### 2.3 Composite scores

- **Financial Quality (FQ)** — `financial_quality_composite(subscores, industry_pillar_weights, subfactor_pillar_map)`: groups each metric's percentile score into its pillar (per `FactorDefinition.pillar`), averages within pillar, then takes the industry-specific weighted sum across pillars (`IndustryPillarWeight`). Different industries weight pillars differently (e.g. banking weights are different from IT).
- **Moat Score** — `moat_composite(subscores, weights)`: weighted average of `MoatSubscore` rows (market_share, brand_strength, customer_loyalty, cost_advantage, network_effects, intangibles, innovation, competitive_intensity, geographic_diversification) using `FactorDefinition.default_weight`.
  - **Fixed 2026-07-11:** previously raised `KeyError` if a `MoatSubscore` row had no matching weighted `FactorDefinition`. Now filters to only weighted sub-factors at the call site, falling back to the company's existing `moat_score` if none are weighted.
  - **Fixed 2026-07-21:** `moat_composite({}, weights)` raised `ZeroDivisionError` (empty `subscores` → `weight_total=0`) instead of degrading gracefully like `financial_quality_composite` already did for its own empty-pillar case. This was hit in production by every Future Lab branch: `create_branch` (`apps/api/services/branch_service.py`) never copied the parent timeline's `MoatSubscore`/`FinancialQualitySubscore` rows onto the new child `timeline_id`, so `_refresh_fundamentals` saw an empty subscore dict for every company on a branch's first fast-forwarded quarter and the whole Celery fast-forward job crashed, leaving the branch stuck at `status='failed', tick_count=0`. Two-part fix: `moat_composite` now returns `0.0` for empty subscores (matching FQ's behavior), and `create_branch` clones the parent's `MoatSubscore`/`FinancialQualitySubscore` rows onto the child at fork time (same pattern as the existing `SimulationState` seed) so branches no longer start with zero subscore data in the first place.
- **IntrinsicScore** — `intrinsic_score(mgmt, moat, fq, fcfq, growth, weights=DEFAULT_TOP_LEVEL_WEIGHTS)`:

  ```
  IntrinsicScore = 0.25·management_quality + 0.25·moat_score + 0.20·financial_quality
                   + 0.10·fcf_quality + 0.20·growth_potential
  ```

  `management_quality`, `fcf_quality`, `growth_potential` are **not** recomputed from data each quarter — they are carried forward from the prior `CompanyFactorScore` row (see §2.5) and only move when an event nudges them.

### 2.4 PEG-based valuation chain — `engine/valuation.py` (current formula, superseding two earlier revisions — see [§5 History](#5-valuation-formula-history))

```
S = IntrinsicScore (0–100)
M(S) = M_min + (M_max − M_min) / (1 + e^(−k·(S − c)))              quality_multiplier()
FairPEG = NeutralIndustryPEG(industry) × M(S)                       fair_peg()
GrowthRate% = growth_rate_min + (growth_rate_max − growth_rate_min) × growth_potential/100   growth_score_to_rate()
FairPE = FairPEG × GrowthRate%                                      fair_pe_from_peg()
IntrinsicValue = FairPE × EPS                                       intrinsic_value_per_share()
```

Defaults: `M_min=0.6`, `M_max=2.0`, `k=0.11`, `c=60` (config keys `quality_mult_min/max/k/inflection`). `growth_rate_min=2.0`, `growth_rate_max=60.0` (%/yr).

`NeutralIndustryPEG` — a **configured constant per industry** (not a market-observed average), seeded in `db/seeds/seed_industries.py` as `config_parameters` rows (`scope="industry"`). 15 values, e.g. Banking 0.90, IT 1.40, Pharma 1.50, Metals 0.60.

**⚠️ Scale note:** `GrowthRate%` is a raw percentage number (18.0 for 18%), not a fraction, so `FairPE = FairPEG × 18.0` — a deliberate ~100× scale jump from the old `FairPE = PE_industry × Q(S)` formula. Not a bug, but easy to mis-sanity-check.

Both `_refresh_fundamentals` (quarterly) and `_apply_factor_effects_to_company` (event-driven) call the **same** shared helper, `_recompute_valuation()` in `orchestrator.py`, to avoid the valuation chain being hand-rolled three times (Phase A cleanup, 2026-07-11). `db/seeds/seed_initial_prices.py` has a deliberately standalone fourth copy for the one-time seed script.

### 2.5 Quarterly refresh — `_refresh_fundamentals()` in `orchestrator.py`

Runs every `QUARTER_LENGTH = 63` ticks:
1. Generate a new fake quarter of financials per company (`_generate_fake_quarterly_financials`, revenue/margin driven by the multi-signal formula in §2.5a rather than a flat random walk off the prior quarter — ties net income → EPS → consensus estimate).
2. Cross-sectionally percentile-rank every raw metric into FQ subscores.
3. Compute FQ composite, Moat composite.
4. **Carry forward** `management_quality`/`growth_potential`/`fcf_quality` from the latest existing `CompanyFactorScore` (fixed 2026-07-11 — these used to be re-rolled with fresh `rng.uniform()` every quarter, causing IntrinsicScore/FairPE/IV to lurch randomly for reasons unrelated to the company's actual financials).
5. Compute `IntrinsicScore`, run the PEG valuation chain, write a new `CompanyFactorScore` row and update `Company.intrinsic_value/intrinsic_score/fair_pe`.
6. Generate a con-call for the quarter just closed (`_generate_concalls_for_quarter`, §6.4) from the financials just written in step 1.

### 2.5a Quarterly growth/margin formula — `_compute_quarterly_growth_and_margin_bias()` in `orchestrator.py`

**Added 2026-07-18.** Previously `_generate_fake_quarterly_financials` drew revenue as `prior_revenue * (1 + rng.gauss(0.01, 0.03))` — pure noise around only the single most recent quarter, ignoring management quality, financial-quality trend, price action, news/events, and (nonexistent at the time) con-call guidance entirely. Growth rate and a margin bias are now:

```
growth_rate = trend_drift + mgmt_mean_bias + fq_bias + price_reversion + event_bias + guidance_bias + noise
growth_rate = clamp(growth_rate, GROWTH_RATE_CLAMP_MIN=-0.40, GROWTH_RATE_CLAMP_MAX=0.60)

margin_bias = clamp(mgmt_mean_bias·0.5 + fq_bias·0.5 + event_bias·0.3, -0.05, 0.05)
```

Terms (`_weighted_trailing_growth`, `_management_quality_bias_and_noise`, `_financial_quality_trend_bias`, all in `orchestrator.py`):
- `trend_drift` — recency-weighted average QoQ revenue growth over up to the last 4 quarters (weights `0.40, 0.28, 0.20, 0.12`, newest first), replacing the old "only look at last quarter" behavior.
- `mgmt_mean_bias`, `mgmt_noise_scale` — `management_quality_base` (0–100) maps to a mean growth shift of up to ±2% and a noise stddev that shrinks from 4.5% (quality 0) to 1.5% (quality 100): better-managed companies are both more profitable and more consistent.
- `fq_bias` — average slope of the last 4 `financial_quality` readings, normalized against a 10-point swing, capped at ±1.5%; recomputed fresh each quarter (momentum, not permanent compounding).
- `price_reversion` — `clamp(-price_return_qtr * 0.02, -0.01, 0.01)`. Deliberately tiny and hard-capped: price is meant to be an *output* of financials (§4), not a feedback input: this only represents "the market may have overreacted," and can never dominate the other terms.
- `event_bias` — sum of company+industry `EventInstance` effect deltas that fired during the quarter (roughly −100..+100 scale pre-decay), divided by 400 and capped at ±5%.
- `guidance_bias` — prior-quarter con-call guidance signal (§6.4) × 0.015; defaults to neutral 0.0 if no con-call exists yet for that company (`_load_concall_guidance_signal` degrades gracefully rather than failing).
- `noise` — `rng.gauss(0, mgmt_noise_scale)`.

Deterministic given `rng` — no wall-clock or global-random dependence, consistent with the idempotency guarantees elsewhere in `_generate_fake_quarterly_financials`/`_refresh_fundamentals`.

### 2.6 Daily IV drift — `drift_iv()` in `engine/valuation.py`

Between quarterly re-anchors, IV drifts smoothly toward its expected annual growth rate every tick:

```
daily_growth = (1 + expected_annual_growth)^(1/252) − 1
IV_{t+1} = IV_t × (1 + daily_growth)
```

`expected_annual_growth` defaults to 0.08 (config key `expected_annual_growth`, not currently seeded — falls back to the hardcoded default in `run_ticks()`).

---

## 3. Price Driver Engine (fast-moving, daily) — `engine/drivers.py`

Seven drivers, each ∈ [−1, 1], computed per company per tick in `_compute_drivers()`:

| Driver | Formula | Weight (default) |
|---|---|---|
| `value_opportunity` (VO) | `clamp((IV − Price) / Price)` | 0.20 |
| `earnings_surprise` (ES) | `clamp(((actual−consensus)/|consensus|) · e^(−ρ·days_since))` | 0.15 |
| `news_severity` (NS) | `clamp(Σ event.severity · e^(−ρ·days_elapsed))` over active events | 0.15 |
| `economic_outlook` (EO) | `clamp(market_sentiment)` from the cycle state | 0.10 |
| `guidance` (G) | `clamp(sign · jump_size · e^(−ρ·days_since))`, sign = +1 raised / 0 maintained / −1 cut | 0.15 |
| `technical_momentum` (TM) | `tanh(k_m · (price − moving_avg) / moving_avg)` | 0.10 |
| `institutional_buying` (IB) | `clamp(net_flow_signal)` — currently `rng.uniform(-0.1,0.1) + 0.05·market_sentiment` | 0.15 |

`composite_price_pressure(drivers, weights) = Σ weight_i · driver_i`.

Driver-specific notes:
- **ES/G decay clock** — uses `tick_count % QUARTER_LENGTH` (days since the *current* quarter's earnings), not absolute tick count. **Fixed 2026-07-11:** previously used absolute `tick_count`, so both drivers decayed to ~0 permanently after the first quarter and never refreshed at subsequent quarters.
- **TM moving average** — real trailing-close moving average (`ma_window`, default 20 days), batch-loaded once per tick in `_load_tick_state`. **Fixed 2026-07-11:** previously hardcoded as `prev_close * 0.98`, not a real MA.
- **IB** — the only driver with **no real data source**; still synthetic noise. See [§6 Known Gaps](#6-known-gaps--todo).
- **NS** — built from `_get_active_events_for_company`, which pulls all non-expired `EventInstance` rows scoped to market/industry/company for that company, each contributing `severity · e^(−decay_rate·days_elapsed)`.

---

## 4. Price Update Mechanism (Ornstein–Uhlenbeck mean reversion) — `engine/market.py`, `engine/tick.py`

The market price is never set directly — it's derived from a **log-gap** `y` between price and IV, which mean-reverts:

```
y_{t+1} = y_t − θ·y_t + k_drift·composite_price_pressure + β_m·F_m + β_s·F_s + σ·ε
Price_{t+1} = IV · e^(y_{t+1})
```

- `θ` (theta) — mean-reversion speed, default `mean_reversion_rate=0.05` (config also seeds `theta_default/stable/speculative` per company type, currently only `theta_default` is wired into `_compute_drivers`).
- `k_drift` — scales the raw `composite_price_pressure` (§3, `Σ weight_i · driver_i`, itself already ∈ roughly [−1, 1]) down into a plausible single-day log-return contribution before it enters the OU step. Config key `k_drift` (default 0.03 if unseeded), passed as `TickState.pressure_scale` in `engine/tick.py`'s `run_tick()`. **Wired in 2026-07-16/17** — previously `k_drift` was seeded but never read (§9.1 used to list this as dead config) and the raw composite pressure (magnitude up to ~1.0) was fed directly into `y`, which routinely overshot the circuit breaker's `r_cap` whenever several drivers aligned across many companies at once (e.g. every company during the same cycle phase), producing lockstep, lookalike price action that masked company-specific fundamentals.
- `F_m` — market factor return for the day, from the economic cycle (§4.1).
- `F_s` — sector/industry factor shock (§4.2).
- `β_m`, `β_s` — company's market beta and sector beta (`Company.beta_market/beta_sector`), each perturbed every tick by a fresh multiplicative jitter `β * (1 + rng.gauss(0, BETA_JITTER_STD=0.7))` in `orchestrator.py`. **Added 2026-07-18:** all 153 seeded betas are same-sign (0.3–2.5 range), so a shared `F_m`/`F_s` previously pushed every company the same direction each tick, differing only in magnitude — this jitter is zero-mean (doesn't shift the population average) but lets a company's response to a given macro shock swing wide enough to occasionally flip sign relative to its peers.
- `σ` (sigma) — company-specific volatility (§4.3).
- `ε` — `rng.gauss(0, 1)`, one fresh draw per company per tick.

The `economic_outlook` driver (§3, weight 0.10) is likewise jittered per-company: `market_sentiment + rng.gauss(0, ECON_OUTLOOK_JITTER_STD=0.3)` in `orchestrator.py`. **Added 2026-07-18:** this driver previously fed the byte-identical `cycle_state["market_sentiment"]` to all 153 companies and turned out to be the single largest shared lockstep term in the whole tick (larger than `β_m·F_m` itself) — see §9.3 for the measured before/after correlation.

`run_tick()` in `engine/tick.py` vectorizes this across all ~150 companies with NumPy in a single call (`update_market_tick`). This is pure — no DB access; `orchestrator.py` builds `CompanyTickInput` per company and calls it, passing `pressure_scale=params.get("k_drift", 0.03)`.

### 4.1 Economic cycle — `engine/cycle.py`

4-phase Markov chain: `expansion → peak → contraction → trough → expansion`, transition probabilities in `CYCLE_TRANSITIONS` (expected durations ≈ 33/7/25/5 days, full cycle ≈ 70 days). Each phase has base `market_factor_return`, `gdp_growth`, `interest_rate`, `market_sentiment`, each perturbed by Gaussian jitter (`compute_cycle_state`). Cycle state persists in `EconomicCycleState`, advanced once per calendar sim-date (not re-rolled if already computed for that date — supports idempotent re-runs).

**Added 2026-07-19 (Future Lab):** `advance_cycle_phase(current_phase, rng, transition_overrides=None)` takes an optional `transition_overrides` dict that replaces `CYCLE_TRANSITIONS` for that call only (module-level table is never mutated — safe under parallel ensemble runs). This is how Future Lab's "Macro Shock" branch primitive forces a target cycle phase on a branch without touching the live timeline's transition table. `gdp_growth`/`interest_rate`/`market_sentiment` are unaffected by the override — they're always derived afterward by `compute_cycle_state()` for whichever phase this function returns. See `engine/overrides.py::build_cycle_transition_override`.

### 4.2 Sector shocks — `generate_sector_shocks()`

Per industry: `F_s = cycle_sensitivity(industry) × market_factor_return + N(0, SECTOR_NOISE_STD)` (idiosyncratic sector noise). `cycle_sensitivity` is a seeded `Industry` attribute — how strongly that industry's returns track the macro cycle. `SECTOR_NOISE_STD` raised from 0.002 to **0.005** (2026-07-18) — at 0.002 it barely decorrelated the 15 industries from each other or from the market-wide trend, given `market_factor_return`'s own base magnitude is only ~0.0001–0.0004 (§4.1).

### 4.3 Company-specific volatility (σ)

Computed inline in `_compute_drivers()` (NOT via `engine/market.py`'s `company_volatility()`, which is kept as a tested-but-unused reference implementation per Phase A cleanup):

```
f_size = 1 − 0.2·tanh(ln(market_cap / 1e9))         # smaller caps → higher vol
σ = industry.base_volatility/100 × f_size
if balance sheet has equity > 0:
    leverage = total_debt / shareholders_equity
    f_lev = 1 + vol_leverage_factor × min(leverage, vol_max_leverage)
    σ *= f_lev                                        # more leverage → higher vol
```

### 4.4 Circuit breaker + OHLC synthesis — `engine/ohlc.py`

- `apply_circuit_breaker(price, prev_close, r_cap=0.20, p_min=0.01)` — clips the day's return to ±20%, floors price at ₹0.01.
- `synthesize_ohlc(prev_close, current_close, rng, intraday_volatility=0.015)` — fabricates a plausible open/high/low around the two real closes via small Gaussian perturbations. `close` is exactly the circuit-breaker-adjusted engine output.

---

## 5. Volume & Liquidity — `engine/liquidity.py`

- **Volume** — `compute_volume_prd()`: `Volume = BaseFloatTurnover × (1 + a·|return| + b·|Δnews_severity| + c·EarningsDayFlag) × LogNormalNoise`, where `BaseFloatTurnover = market_cap × free_float_pct × turnover_rate`. Result is **dollar turnover**, floored at 1000. `is_earnings_day` = true for the first 5 ticks after a quarter boundary.
- **Order imbalance** — `order_imbalance(demand, supply) = (demand−supply)/(demand+supply)`; `demand`/`supply` scale with `price_pressure` via `demand_from_pressure`/`supply_from_pressure` (asymmetric — only ever scale volume *up*, floor at 1.0×).
- **Liquidity score** — `market_liquidity_score(free_float_pct, avg_daily_volume, market_cap) = clamp(100 × free_float_pct × (volume/market_cap), 0, 100)`.
- **Bid-ask spread** — `bid_ask_spread(base_spread_bps, liquidity_score)` widens as liquidity falls.
- **Kyle-lambda price impact** (used by the *trading* API, not the tick engine) — `λ = scale/(1+liquidity_score)`; `impact_fraction = λ × order_size`, applied to price **multiplicatively** (`execution_price = current_price × (1 ± impact_fraction)`), ± depending on buy/sell side. Impact is capped at 99% (buys) / 50% (sells) of current price per the Phase 5 audit fixes (see `done.md`). **Fixed 2026-07-19:** `apps/api/services/trade_service.py` was previously applying `λ × order_size` as a **raw dollar amount added to price** instead of a fraction, and `kyle_lambda_scale` was seeded at `1.0` — together this let a routine order on a low-liquidity stock execute near double the quoted price (visible as an instant fake unrealized loss right after a buy, since `avg_cost_basis` was set from the inflated fill price while `current_price` stayed at the real quote). Now applied fractionally, matching `engine/liquidity.py`'s `trade_price_with_impact` design; `kyle_lambda_scale` default recalibrated to `0.00005`.

`daily_volume()` (a simpler, older volume formula) is kept but unused — the live path is `compute_volume_prd` (Phase A cleanup).

---

## 6. News & Events → Price/Value Propagation — `engine/events.py`, `engine/news_manager.py`

Two entirely separate application paths for the same `EventInstance.applied_effects` (`effect_profile`) dict, split by key name (`DRIVER_KEYS` in `orchestrator.py` vs. everything else):

### 6.1 Event lifecycle
1. **Firing** — `select_and_fire_events()`: each `MarketEvent` row rolls against its own `probability_weight` every tick. If it fires, an `EventInstance` is created with a `resolved_severity` drawn uniformly from `severity_range`, scoped to `market` (scope_ref=0), a random `industry`, or a random `company`.
2. **News** — `generate_news()`: for company/industry-scoped instances, picks a matching `NewsTemplate` by category, substitutes `{company}`/`{industry}` placeholders, derives `sentiment` from the sign of severity, writes a `NewsFeed` row. Market-scope events produce no news row (no single target to attach it to).
3. **Decay** — `decay(rho, days_elapsed) = e^(−ρ·days_elapsed)`, shared by both effect-application paths below.

### 6.2 Path A — Driver effects (fast, decaying) — `apply_effect_to_drivers()`

For each key in `effect_profile` that matches one of the 7 `DRIVER_KEYS`: `driver[key] += base_effect × severity × decay(ρ, days_elapsed)`, clamped to [−1, 1]. Applied every tick the event is still active, so the effect fades naturally as `days_elapsed` grows — a fire-once, fade-out shock to short-term price pressure (e.g. `news_severity`, `guidance`).

### 6.3 Path B — Factor-score effects (structural, now also decaying) — `_apply_event_factor_effects()` / `apply_effect_to_factor_scores()`

For `effect_profile` keys that are **not** driver keys (i.e. target `management_quality`, `moat_score`, `financial_quality`, `fcf_quality`, `growth_potential`, or an individual `MoatSubscore` sub-factor like `innovation`): nudges the underlying `CompanyFactorScore`/`MoatSubscore` row, then re-runs the full valuation chain (§2.4) to produce a new IV.

Scope handling (`_scope_target_company_ids`): `company` scope → that one company; `industry` scope → every company in that industry; `market` scope → every company in the simulation.

**Changed 2026-07-17: this path now decays like the driver path, superseding the earlier "always `days_elapsed=0`, permanent step-change" design.** Previously (see the removed §9.1 note and `done.md`'s "News/Event → Factor Score Propagation Fix" entry) this was a deliberate choice: structural events were meant to be a one-time permanent shift, not a fading shock. On reconsideration during a 2026-07-17 code review, that design had an unintended side effect: the function is re-invoked on *every* tick an event is still active (needed so a still-open event's effect participates correctly if it fires again or the quarterly base changes), and each call read the *already-mutated* effective column as its own baseline — so repeated ticks of the *same* event kept re-adding a fresh full-severity delta on top of the previous tick's already-applied one, silently compounding far beyond the originally-intended single step-change. Rather than re-deriving "was this event already applied this tick" bookkeeping to preserve the old apply-once semantics, the fix makes the whole path decay-based like driver effects: `_apply_event_factor_effects` now scans every currently-active (non-expired) `EventInstance` each tick and computes `days_elapsed = sim_date - EventInstance.sim_date` fresh per event, matching `apply_effect_to_drivers`.

To make decay possible without losing the seeded/carried-forward baseline, `CompanyFactorScore` gained three snapshot columns — `management_quality_base`, `growth_potential_base`, `fcf_quality_base` — and `MoatSubscore` gained `score_base` (migration `0010_factor_score_bases`). Quarterly refresh (`_refresh_fundamentals`) writes these from the prior quarter's *base* (not the event-mutated effective value), and event effects are computed against that base each tick, never mutating it. `moat_score`/`financial_quality` didn't need new columns at the time — they were already re-derived fresh from `MoatSubscore`/`FinancialQualitySubscore` sub-factor tables every call, so they already had an equivalent "base" to decay against; only `management_quality`/`growth_potential`/`fcf_quality` (and individual `MoatSubscore` sub-factors) lacked one. **Superseded 2026-07-19 — see the Future Lab paragraph below:** that assumption broke for a company with no subscore rows at all (falls back to reading the current, possibly-already-mutated column), so `CompanyFactorScore` gained `moat_score_base`/`financial_quality_base` too (migration `0018`), populated lazily on first touch exactly like the other three.

**Added 2026-07-19 — Future Lab structural overrides (`_apply_timeline_factor_score_overrides()`):** a branch timeline can carry a `target_type='factor_score'` `TimelineOverride` row (e.g. "Severe Recession" backing `financial_quality` down 15 points for leverage-heavy industries) — a flat, **non-decaying** nudge re-applied at the same fixed magnitude every tick the override is active, unlike the event path above (which explicitly decays). This function runs unconditionally every tick the branch has an active factor_score override (not gated to quarter boundaries the way `_refresh_fundamentals` is), so naively reading the mutated column as "current value" and writing the nudged result back would compound the same way the pre-2026-07-17 event-path bug did — a flat -15 would become -15×N after N ticks. The fix mirrors §6.3's base-plus-delta pattern: `management_quality`/`growth_potential`/`fcf_quality` recompute from their `*_base` snapshot, and `moat_score`/`financial_quality` recompute fresh from `MoatSubscore`/`FinancialQualitySubscore` (falling back to `moat_score_base`/`financial_quality_base` when a company has no subscore rows), so the override delta is always added on top of the same undecayed anchor, never on top of yesterday's already-overridden result. See `engine/overrides.py::factor_score_bias_by_company` for how `TimelineOverride` rows resolve into the `{company_id: {field: delta}}` map this function consumes.

**Added 2026-07-18 — per-company event-severity jitter (`_jitter_event_severities`, `EVENT_SEVERITY_JITTER_STD = 0.25`):** market- and industry-scope `EventInstance` rows previously applied one identical `resolved_severity` to every company in scope (all 153 companies for market scope, or every company in the industry) with zero dispersion — this was actually the single largest driver of "all companies move together" complaints, bigger than the macro `F_m`/`F_s` terms. `_get_active_events_for_company` now draws a fresh multiplicative jitter per company (`severity * (1 + rng.gauss(0, 0.25))`) before the severity feeds `news_severity` (§3) or `_apply_event_factor_effects` (this section), so a market-wide event still moves every company but not by the identical amount.

### 6.4 Con-calls — `engine/concalls.py`

**Added 2026-07-18.** A `ConCall` row (migration `0013_add_con_calls`) is generated per `(company_id, fiscal_period)` immediately after `_refresh_fundamentals` writes that quarter's financials (`_generate_concalls_for_quarter`, called from `run_ticks` at the same quarter boundary, idempotency-guarded like the financials tables it depends on). `generate_concall()` is deterministic/template-based (no LLM call):

1. Buckets the quarter's actual EPS against the consensus estimate into beat/inline/miss.
2. Crosses that bucket with a `management_quality_base` band (strong/mid/weak) via a tone matrix to pick a base `tone` (confident/measured/cautious/defensive/evasive).
3. **(2026-07-18b)** Nudges that tone one step more confident/cautious per optional tie-breaker: `moat_score` (from the same-quarter `CompanyFactorScore`, ≥65 nudges up / ≤35 nudges down) and `market_performance` (the company's close-to-close stock return over the quarter, from `PriceHistory` via `_quarter_market_performance` in `engine/orchestrator.py`, ≥+8%/≤−8% nudge the same way). Either input can be omitted (e.g. no `CompanyFactorScore` row yet, or no price history predating the quarter) and the base tone from step 2 is used as-is. If the nudged tone has no template for the quarter's bucket (e.g. "beat" only has confident/measured templates), it walks back toward the un-nudged base tone rather than raising `KeyError`. The final `tone_score` ∈ [−1, 1] is derived from this nudged tone, so it — and everything downstream of it (`guidance_revenue_growth`, `driver_deltas`) — already reflects the moat/market tie-breakers.
4. Renders placeholder-substituted statement templates (opening/revenue/margins/guidance/closing) into `statements` (JSONB); when `market_performance` is available, appends a `market_context` statement acknowledging the stock's quarter return.
5. Computes `guidance_revenue_growth` from the nudged tone + actual revenue growth + a `growth_potential` tilt + small `rng` jitter.

This is the source of the `guidance_signal` term in §2.5a: `_load_concall_guidance_signal` reads the **prior** quarter's `ConCall.tone_score`/`guidance_revenue_growth` (the quarter being generated hasn't produced its own con-call yet) for each company, defaulting to neutral 0.0 when none exists (early quarters, or a fresh DB before any quarter boundary has run). Exposed via `GET /api/v1/companies/{ticker}/concalls` (`apps/api/routers/concalls.py`).

**Backfilled 2026-07-18b.** The con_calls table shipped empty in the same commit that advanced the sim to tick 200/`2027Q1` — five quarter boundaries had already been crossed before `_generate_concalls_for_quarter` existed, so no historical con-calls existed despite the financials being present. `scripts/backfill_concalls.py` walks every `(company, fiscal_period)` pair present in `IncomeStatement` that's missing a `ConCall` row and generates one via the same `generate_concall()` used live, approximating each historical quarter's `call_date`/`market_performance` window from `QUARTER_LENGTH`-spaced offsets off `FIRST_SIM_DATE`. Idempotent (skips existing rows) — safe to rerun after any gap, though going forward every quarter boundary generates its own con-calls live and no gap should recur.

Net effect for a game designer reading this: a structural event's factor-score nudge now fades over the event's `duration_days` (governed by the event's own `decay_rate`), the same as its driver-side price-pressure nudge — there is no longer an asymmetry where the driver effect on `news_severity` fades but the correlated `financial_quality` hit from the same event stays at full strength forever.

**Fixed 2026-07-10 (all three, see `done.md` "News/Event → Factor Score Propagation Fix"):**
1. `financial_quality` effects used to be silently dropped (baseline dict never included it).
2. A direct `moat_score` top-level effect used to be silently dropped (baseline only ever populated from individual `MoatSubscore` sub-factor rows, never the composite itself).
3. Only `scope_type == "company"` events applied factor effects at all — industry/market-scope events (e.g. "Supply Chain Disruption", "Commodity Price Spike") were skipped entirely regardless of bugs #1/#2.

Fix also **persists to the real `CompanyFactorScore` row**, not just the denormalized `Company.intrinsic_value/intrinsic_score/fair_pe` fields — otherwise the next tick's driver computation and any direct query would read stale scores.

---

## 7. Full Per-Tick Sequence (`run_ticks()` in `orchestrator.py`)

1. Load state: timeline, sim date, RNG (seeded `rng_seed + tick_count` — deterministic replay), config params, neutral industry PEGs.
2. Idempotency check — skip if `PriceHistory` already exists for this sim_date.
3. Advance/reuse economic cycle phase → `F_m`, macro indicators.
4. Generate per-industry sector shocks `F_s`.
5. **If quarter boundary** (`tick_count % 63 == 0`): refresh fundamentals → new FQ/Moat/IntrinsicScore/IV (§2.5).
6. Drift IV for every company (§2.6).
7. Per company: compute all 7 drivers + apply any active event driver-effects (§3, §6.2).
8. Run vectorized OU tick → new log-gap `y` → new raw price (§4).
9. Apply circuit breaker, synthesize OHLC, compute volume/order-imbalance (§4.4, §5).
10. Write `PriceHistory` + `PriceDriverScore` rows.
11. Update denormalized `Company.current_price/intrinsic_value/market_cap/market_liquidity_score`.
12. Mark portfolios to market.
13. Fire probabilistic events, generate news, apply factor-score effects → recompute IV where touched (§6.3).
14. Advance `SimulationState` (sim_date +1, tick_count +1).

---

## 8. Config Parameters Governing Price/Value (`db/seeds/seed_config.py`, scope="global" unless noted)

| Key | Role |
|---|---|
| `mean_reversion_rate` (referenced as `theta_default` fallback) | OU pull-back speed θ |
| `k_m` | technical_momentum tanh steepness |
| `k_drift` | scales `composite_price_pressure` before it enters the OU step (§4) — wired in 2026-07-16/17, previously unread |
| `k_flow` | seeded but **not currently read** by any engine call site — see §9 |
| `w_vo`/`w_es`/`w_ns`/`w_eo`/`w_g`/`w_tm`/`w_ib` | 7 driver weights |
| `rho_es` / `earnings_surprise_decay_rate`, `rho_g` / `guidance_decay_rate`, `rho_news` / `news_decay_rate` | decay rates ρ per driver |
| `quality_mult_min/max/k/inflection` | M(S) logistic curve shape |
| `growth_rate_min/max` | growth_potential → annual growth % linear map |
| `neutral_industry_peg` (scope="industry", one row per industry) | fair PEG anchor |
| `r_cap` / `circuit_breaker_cap` | daily ±return clamp |
| `vol_turnover_rate`, `vol_coeff_return/news/earnings`, `vol_noise_sigma` | volume formula coefficients |
| `vol_leverage_factor`, `vol_max_leverage` | σ leverage multiplier |
| `liquidity_sensitivity` | demand/supply pressure sensitivity |
| `kyle_lambda_scale` (default `0.00005`, fixed 2026-07-19 — was `1.0`), `base_spread_bps` | trading-side price impact / spread (not tick engine) |
| `ma_window` | technical_momentum moving-average window (days) |
| `expected_annual_growth` | IV daily drift target — **not currently seeded**, silently falls back to hardcoded 0.08 in `run_ticks()` |

---

## 9. Known Gaps / TODO (price & value movement only)

Cross-referenced against `done.md` and `docs/calibration-strategy.md`. Items purely about UI/API/testing are out of scope for this list — only things that change *how a number moves*.

### 9.1 Unresolved design/logic notes flagged in code or `done.md`

- **`expected_annual_growth` config key is never seeded.** `run_ticks()` reads it with `.get("expected_annual_growth", 0.08)`, so every company drifts IV at the same flat 8%/yr regardless of its own `growth_potential`/`growth_rate` — the per-company growth rate computed in `growth_score_to_rate()` for the *valuation* chain is never reused for the *drift* chain. These two growth concepts (fair-PE growth rate vs. IV daily drift rate) are currently disconnected; worth deciding whether drift should use the company's own derived growth rate instead of one global constant.
- **`k_flow` config key is seeded but never read** anywhere in `engine/` or `orchestrator.py` — dead config, or a placeholder for an unimplemented mechanism (unclear which). Should be either wired in or removed. (`k_drift`, its neighbor, was wired in 2026-07-16/17 — see §4 and §9.3.)
- **`institutional_buying` has no real signal** — it's `rng.uniform(-0.1, 0.1) + 0.05 × market_sentiment`, i.e. mostly noise with a small macro tilt. None of the 15% weight it carries reflects any actual "institutional" behavior (e.g. large simulated fund flows, insider trades, block orders). Lowest-fidelity of the 7 drivers.
- **All factor-score effects now decay uniformly (§6.3, changed 2026-07-17) — there is no longer a way for an event to declare itself a "permanent step-change."** The old always-`days_elapsed=0` design intentionally supported that distinction (e.g. a "temporary regulatory probe" fading vs. "permanent regulation change" not fading); the current implementation applies the same `decay(rho, days_elapsed)` curve to every factor-score effect, same as driver effects, with no per-event permanent/temporary flag. If a future revision wants some events to be truly permanent again, `MarketEvent` would need an explicit flag (e.g. `permanent: bool`) that `_apply_event_factor_effects` checks before deciding whether to floor `days_elapsed` at 0 for that event.
- **Reliance Industries real-world calibration sanity check (`done.md`, `docs/valuation_dry_run.py`) found FairPE ≈3× too high** at hand-estimated realistic quality inputs (mgmt=78, moat=82, fq=62, fcfq=58, growth=70) against real EPS/industry PE. Backwards-solving showed `IntrinsicScore≈50` (not ≈72) reproduces the real multiple at defaults `k=0.11, c=60`. **Conclusion reached:** the `M(S)` formula itself is mathematically sound (monotonic, correctly bounded, correct diminishing-marginal-valuation shape) — the miscalibration is in the *qualitative 0–100 score inputs*, which are synthetic placeholders never fitted to real market data. **This is the single highest-priority open correctness item** in the whole price/value engine, since it means every company's IV is plausible only by luck of what score it happened to seed with, not because the formula was validated end-to-end.
- **Discrepancy between the PRD image and PRD text for `M(S)`** (`done.md`, Valuation Formula Revision #2): the uploaded spec image showed `M(S) = 0.3 + 2.7/(1+e^{-0.11(S-60)})` (implying `M_min=0.3, M_max=3.0`) but the accompanying text said the range should be "approximately 0.6 to 2.0" and gave `M(S) = 0.6 + 1.4/(...)`. Implemented per the text (current code), not the image. If the image was actually authoritative, the multiplier range is currently ~46% too narrow — worth a final confirmation from whoever owns the spec.
- **`theta_stable`/`theta_speculative` are seeded but not wired into per-company theta selection** — every company currently uses the single flat `mean_reversion_rate` (0.05) regardless of whether it's a "stable" blue-chip or "speculative" small-cap, even though the config anticipates per-company-type mean-reversion speeds.

### 9.2 Not yet started (from `docs/calibration-strategy.md`, price/value-relevant sprints only)

- **Sprint A — Valuation calibration.** Fit `NeutralIndustryPEG`, `M(S)` bounds/steepness, `base_volatility`, and betas against the real 3,833-ticker fundamentals dataset (`data/fundamentals/master_fundamentals.parquet`) instead of hand-picked placeholder constants. This is the fix for the Reliance miscalibration above — the highest-ROI next step per the calibration doc, pure parameter changes, no new models needed.
- **Sprint B — Financial statement realism.** Revenue/margin growth is no longer a flat random walk (§2.5a, 2026-07-18 — now driven by trailing trend, management quality, FQ momentum, price, events, and con-call guidance). Still open: the remaining `rng.uniform(...)` ranges in `_generate_fake_quarterly_financials` for COGS%, opex%, D&A%, and leverage growth *bands themselves* are still hand-picked constants, not sector-median ratios derived from real data.
- **Sprint C — Score calibration.** Distill real company financials into realistic quality-score *distributions* (currently `management_quality`/`growth_potential`/`fcf_quality` are seeded once and only move via events — never grounded in a real cross-sectional distribution).
- **Sprint D — Factor-driven price engine.** Integrate the already-downloaded Fama-French (`MKT/SMB/HML/RMW/CMA/Mom`, 1926–2026) and AQR (BAB/QMJ) factor files into the OU process, so `β_m`/`β_s` and `F_m`/`F_s` are backed by real factor history/backtesting instead of a synthetic 4-phase Markov cycle.
- **TimescaleDB hypertable for `price_history`** — schema gap noted since Phase 3; doesn't affect correctness of price movement, but affects query performance for anything downstream that reads long price histories (e.g. technical_momentum's moving average, chart rendering).

### 9.3 Confirmed-correct, not a gap (to avoid re-litigating)

- `pe_min`/`pe_max`/`baseline_pe` clamp removal (2026-07-09/10) and later full column drop (Phase C, 2026-07-11) — intentional, the PEG formula's own `M_min`/`M_max` bounds already bound `FairPE` without a second clamp.
- Flush-in-service/commit-in-router split — deliberate architecture, not a transaction bug (reconciliation note, `done.md`).
- `engine/market.py`'s `company_volatility()` and `engine/liquidity.py`'s `daily_volume()` — both dead code paths, kept intentionally as tested, spec-referenced reference implementations, not accidental duplication.
- **`k_drift` wired into the OU step as `pressure_scale` (2026-07-16/17)** — previously listed here as dead config alongside `k_flow`; now resolved, see §4.
- **Factor-score event effects now decay (2026-07-17), reversing the earlier deliberate "always permanent, never decays" design** — see §6.3 for the full rationale. Superseded, not contradicted: the old design was intentional at the time, but the re-invoke-every-tick call pattern it was paired with made effects silently compound across ticks rather than stay at a single fixed step-change, which was the actual, previously-undetected bug.
- **Cycle-phase lockstep correlation reduced, not eliminated, by design (2026-07-18).** Measured via a 500-tick Monte Carlo against the real `engine.tick`/`engine.cycle` functions with actual seeded betas/industries: same-direction price movement among the 153 companies during a single phase tick dropped from ~63.4%→59.3% (expansion) and ~62.7%→59.0% (contraction) after adding the jitter described in §4/§4.2/§6.3, while each phase's average `y`-bias (directional tilt) was preserved (expansion +0.000894→+0.000906, contraction −0.000657→−0.000642). The residual same-direction motion is mostly the existing idiosyncratic `σ·ε` term overlapping with a real macro trend, not further lockstep — pushing the correlation materially lower would require either allowing some companies negative betas (changes what the beta ranking means) or increasing idiosyncratic volatility further (distorts realistic per-company price behavior), so this calibration was chosen as the largest safe reduction rather than a target of zero correlation.

---

## Maintenance Protocol

This file must stay reconciled with the code. Whenever a commit touches any of:

- `engine/valuation.py`, `engine/scoring.py`, `engine/drivers.py`, `engine/market.py`, `engine/tick.py`, `engine/cycle.py`, `engine/ohlc.py`, `engine/liquidity.py`, `engine/events.py`, `engine/fundamentals.py`, `engine/news_manager.py`
- the price/value-relevant functions in `engine/orchestrator.py` (`_recompute_valuation`, `_refresh_fundamentals`, `_compute_drivers`, `_update_prices_and_ohlc`, `_apply_event_factor_effects`, `_apply_factor_effects_to_company`)
- `db/seeds/seed_config.py` or `db/seeds/seed_industries.py` config-parameter rows referenced in §8

...update this file **in the same commit**:

1. If a formula changed: update its section (§2–§6) with the new formula and default constants, and add a one-line dated note (like the "**Fixed 2026-07-11:**" callouts above) explaining what changed and why, if the change is a correctness fix rather than a routine tweak.
2. If a new config parameter was added/removed: update the §8 table.
3. If a TODO in §9.1/§9.2 was resolved: move it out of "Known Gaps" (delete or move to §9.3 "Confirmed-correct" if it's worth remembering the resolution).
4. If a new gap or logical/mathematical issue is discovered (whether or not it's fixed immediately): add it to §9.1 with enough detail that a future reader can act on it without re-deriving the issue from scratch.
5. Bump the "Last synced with code" date at the top.

When asked to "reconcile the price-value-engine doc" or after any commit touching the files above, an agent should re-read the changed files, diff their current formulas/behavior against what's written here, and apply the edits above before considering the task done.

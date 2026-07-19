"""Seed the Future Lab scenario library (Section 11.4).

Every template's effect_profile["overrides"] entries reference real engine
hooks, matching the corrected design from Section 11's revision pass:
- Macro shocks target cycle_transition only -- GDP/rate/sentiment are never
  set directly; they always fall out of engine.cycle.compute_cycle_state()
  for whatever phase the forced transition produces (see
  engine/overrides.py::build_cycle_transition_override).
- Structural overrides target factor_score/config rows -- never a raw
  "driver" pin, since the 7 tick-loop drivers are recomputed every tick.
- The Liquidity Crunch scenario explicitly pairs its config override
  (kyle_lambda_scale) with a driver_bias on technical_momentum, since
  Kyle's-lambda impact only fires at trade-execution time
  (apps/api/services/trade_service.py) and is otherwise invisible in
  PriceHistory for a branch with no simulated trade activity.

Each override dict matches apps.api.services.branch_service.OverrideSpec's
fields (minus effective_from_sim_date, filled in uniformly at apply-time by
apps.api.services.scenario_service.apply_scenario_template).
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import ScenarioTemplate

SCENARIO_TEMPLATES = [
    {
        "name": "Mild Recession",
        "description": (
            "Forces cycle_phase -> contraction for 120 sim-days via a transition-matrix "
            "override; GDP (~-1.5%), interest rate, and sentiment follow from "
            "compute_cycle_state()'s existing phase distribution, not hand-set values."
        ),
        "category": "macro",
        "default_duration_days": 120,
        "effect_profile": {
            "overrides": [
                {"target_type": "cycle_transition", "target_key": "contraction", "override_value": "1.0"},
            ],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 120, "min": 30, "max": 365}},
    },
    {
        "name": "Severe Recession",
        "description": (
            "Same phase-forcing mechanism as Mild Recession but for 250 sim-days, plus a "
            "financial_quality penalty scoped to leverage-sensitive industries "
            "(Banking & Financial Services, Real Estate, Construction & Infrastructure)."
        ),
        "category": "macro",
        "default_duration_days": 250,
        "effect_profile": {
            "overrides": [
                {"target_type": "cycle_transition", "target_key": "contraction", "override_value": "1.0"},
                {
                    "target_type": "factor_score", "target_key": "financial_quality",
                    "override_value": "-15", "target_scope_id": None,
                    "note": "apply per-company at scenario-application time, scoped to Banking & Financial "
                            "Services / Real Estate / Construction & Infrastructure industries",
                },
            ],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 250, "min": 60, "max": 500}},
    },
    {
        "name": "Sector Boom",
        "description": (
            "Sustained positive bias on the chosen industry's sector-shock sensitivity, "
            "plus increased guidance-raise-type MarketEvent firing probability scoped to "
            "that industry. Parametrize target_scope_id (industry id) at apply-time."
        ),
        "category": "sector",
        "default_duration_days": 90,
        "effect_profile": {
            "overrides": [
                {"target_type": "config", "target_key": "sector_boom_bias", "override_value": "0.3", "target_scope_id": None},
            ],
        },
        "editable_params": {"industry_id": {"type": "int", "required": True}},
    },
    {
        "name": "Rate Shock (Hike)",
        "description": (
            "Biases the interest-rate jitter for the current/forced phase toward a hike; "
            "downstream Leverage & Solvency pillar penalty applies economy-wide via "
            "factor_score overrides on financial_quality."
        ),
        "category": "macro",
        "default_duration_days": 60,
        "effect_profile": {
            "overrides": [
                {"target_type": "config", "target_key": "rate_shock_direction", "override_value": "hike"},
            ],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 60, "min": 15, "max": 180}},
    },
    {
        "name": "Rate Shock (Cut)",
        "description": "Same mechanism as Rate Shock (Hike), biased toward a cut instead.",
        "category": "macro",
        "default_duration_days": 60,
        "effect_profile": {
            "overrides": [
                {"target_type": "config", "target_key": "rate_shock_direction", "override_value": "cut"},
            ],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 60, "min": 15, "max": 180}},
    },
    {
        "name": "Commodity Spike",
        "description": (
            "Sector shock targeted at Energy (Oil & Gas) / Metals & Mining / Chemicals, "
            "propagated to input-cost-exposed industries (Automobiles & Auto Components, "
            "Industrials & Capital Goods) via the industry_cross_effects table (Section 11.10), "
            "not an ad hoc ripple."
        ),
        "category": "sector",
        "default_duration_days": 60,
        "effect_profile": {
            "overrides": [
                {"target_type": "config", "target_key": "sector_boom_bias", "override_value": "0.4", "target_scope_id": None},
            ],
            "source_industries": ["Energy (Oil & Gas)", "Metals & Mining", "Chemicals"],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 60, "min": 15, "max": 180}},
    },
    {
        "name": "Single-Company Guidance Cut",
        "description": (
            "Fires a real EventInstance targeting the guidance/earnings_surprise driver "
            "inputs plus a management_quality decrement, rather than pinning the guidance "
            "driver directly (which the tick loop would silently overwrite next tick)."
        ),
        "category": "company",
        "default_duration_days": 15,
        "effect_profile": {
            "overrides": [
                {"target_type": "event", "target_key": "Guidance Raised", "override_value": "cut"},
                {"target_type": "factor_score", "target_key": "management_quality", "override_value": "-10"},
            ],
        },
        "editable_params": {"company_id": {"type": "int", "required": True}},
    },
    {
        "name": "Liquidity Crunch",
        "description": (
            "Config override to the Kyle's-lambda scale term (kyle_lambda_scale) consumed by "
            "trade_service.kyle_lambda_from_liquidity(). Explicitly has NO effect on "
            "PriceHistory unless the branch simulates trade activity (Kyle's-lambda impact "
            "only fires at trade-execution time) -- paired by default with a driver_bias on "
            "technical_momentum (elevated idiosyncratic volatility proxy) so the scenario is "
            "visible in price even for a passive observer, matching how real liquidity crises "
            "show up as vol spikes independent of any single trade."
        ),
        "category": "liquidity",
        "default_duration_days": 30,
        "effect_profile": {
            "overrides": [
                {"target_type": "config", "target_key": "kyle_lambda_scale", "override_value": "0.0005"},
                {"target_type": "driver_bias", "target_key": "technical_momentum", "override_value": "-0.3", "target_scope_id": None},
            ],
        },
        "editable_params": {"duration_days": {"type": "int", "default": 30, "min": 5, "max": 90}},
    },
    {
        "name": "Custom",
        "description": "Full manual control via the structural-override primitive -- no canned overrides.",
        "category": "company",
        "default_duration_days": None,
        "effect_profile": {"overrides": []},
        "editable_params": None,
    },
]


def seed(session: Session) -> None:
    for tmpl in SCENARIO_TEMPLATES:
        existing = session.query(ScenarioTemplate).filter_by(name=tmpl["name"]).first()
        if existing is None:
            session.add(ScenarioTemplate(**tmpl))


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_scenario_templates.py done.")


if __name__ == "__main__":
    main()

"""Tests for db/seeds/seed_scenario_templates.py and applying a template
via apps.api.services.scenario_service.apply_scenario_template."""

from datetime import date

from db.models import ScenarioTemplate, TimelineOverride
from db.seeds.seed_scenario_templates import SCENARIO_TEMPLATES, seed


def test_seed_scenario_templates_creates_all_entries(test_db):
    seed(test_db)
    test_db.commit()

    rows = test_db.query(ScenarioTemplate).all()
    assert len(rows) == len(SCENARIO_TEMPLATES)
    names = {r.name for r in rows}
    assert "Mild Recession" in names
    assert "Liquidity Crunch" in names
    assert "Custom" in names


def test_seed_scenario_templates_idempotent(test_db):
    seed(test_db)
    test_db.commit()
    seed(test_db)
    test_db.commit()

    rows = test_db.query(ScenarioTemplate).all()
    assert len(rows) == len(SCENARIO_TEMPLATES)


def test_seed_scenario_template_categories_are_valid(test_db):
    """Every seeded category must satisfy the DB CHECK constraint
    (macro|sector|company|liquidity) -- this is really a static assertion,
    but running it through the ORM insert path confirms the CHECK
    constraint (added in migration 0017) actually accepts every row."""
    seed(test_db)
    test_db.commit()  # would raise IntegrityError if any category were invalid


def test_liquidity_crunch_pairs_config_and_driver_bias(test_db):
    seed(test_db)
    test_db.commit()

    template = test_db.query(ScenarioTemplate).filter_by(name="Liquidity Crunch").first()
    assert template is not None
    overrides = template.effect_profile["overrides"]
    target_types = {o["target_type"] for o in overrides}
    # The core correctness requirement from the spec revision: liquidity
    # scenarios must not rely on Kyle's-lambda impact alone (invisible in
    # price without simulated trades) -- must be paired with a
    # price-visible driver_bias.
    assert "config" in target_types
    assert "driver_bias" in target_types
    config_override = next(o for o in overrides if o["target_type"] == "config")
    assert config_override["target_key"] == "kyle_lambda_scale"
    bias_override = next(o for o in overrides if o["target_type"] == "driver_bias")
    assert bias_override["target_key"] == "technical_momentum"


def test_macro_shock_templates_never_set_gdp_or_rate_directly(test_db):
    """Regression test for the spec's core correction: Macro Shock overrides
    must only ever target cycle_transition, never gdp_growth/interest_rate/
    market_sentiment directly -- those always fall out of
    engine.cycle.compute_cycle_state() for whatever phase results."""
    seed(test_db)
    test_db.commit()

    macro_templates = test_db.query(ScenarioTemplate).filter_by(category="macro").all()
    assert len(macro_templates) >= 2
    for tmpl in macro_templates:
        for override in tmpl.effect_profile["overrides"]:
            assert override["target_key"] not in {"gdp_growth", "interest_rate", "market_sentiment"}


def test_apply_scenario_template_materializes_overrides(test_db, test_timeline):
    from apps.api.services.scenario_service import apply_scenario_template

    seed(test_db)
    test_db.commit()
    template = test_db.query(ScenarioTemplate).filter_by(name="Mild Recession").first()

    rows = apply_scenario_template(
        test_db, template.id, test_timeline.id, effective_from_sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    assert len(rows) == 1
    assert rows[0].target_type == "cycle_transition"
    assert rows[0].target_key == "contraction"
    # effective_to_sim_date is INCLUSIVE (engine.overrides.resolve_active_overrides
    # treats both ends as active days), so a 120-day scenario starting 2026-01-02
    # must end 119 days later (2026-05-01), not 120 days later -- otherwise it's
    # active for 121 days, not 120.
    assert rows[0].effective_to_sim_date == date(2026, 5, 1)

    persisted = test_db.query(TimelineOverride).filter_by(timeline_id=test_timeline.id).all()
    assert len(persisted) == 1


def test_apply_scenario_template_duration_days_is_active_for_exactly_that_many_days(test_db, test_timeline):
    """Regression test for the off-by-one: engine.overrides.resolve_active_overrides
    treats effective_to_sim_date as inclusive on both ends, so a
    duration_days=N override must be active on exactly N sim_dates, not N+1."""
    from apps.api.services.scenario_service import apply_scenario_template
    from engine.overrides import resolve_active_overrides

    seed(test_db)
    test_db.commit()
    template = test_db.query(ScenarioTemplate).filter_by(name="Mild Recession").first()

    start = date(2026, 1, 2)
    rows = apply_scenario_template(
        test_db, template.id, test_timeline.id, effective_from_sim_date=start, duration_days=5,
    )
    test_db.commit()

    from datetime import timedelta
    active_day_count = sum(
        1 for offset in range(10) if resolve_active_overrides(rows, start + timedelta(days=offset))
    )
    assert active_day_count == 5


def test_apply_scenario_template_liquidity_crunch_writes_both_overrides(test_db, test_timeline):
    from apps.api.services.scenario_service import apply_scenario_template

    seed(test_db)
    test_db.commit()
    template = test_db.query(ScenarioTemplate).filter_by(name="Liquidity Crunch").first()

    rows = apply_scenario_template(
        test_db, template.id, test_timeline.id, effective_from_sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    assert len(rows) == 2
    target_types = {r.target_type for r in rows}
    assert target_types == {"config", "driver_bias"}


def test_apply_scenario_template_custom_writes_no_overrides(test_db, test_timeline):
    from apps.api.services.scenario_service import apply_scenario_template

    seed(test_db)
    test_db.commit()
    template = test_db.query(ScenarioTemplate).filter_by(name="Custom").first()

    rows = apply_scenario_template(
        test_db, template.id, test_timeline.id, effective_from_sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    assert rows == []

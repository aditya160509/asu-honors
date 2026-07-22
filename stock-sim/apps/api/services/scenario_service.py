"""Future Lab (Section 11.4) — the scenario library: CRUD for
scenario_templates plus applying a template's canned effect_profile onto a
real timeline as TimelineOverride rows.

effect_profile (JSONB) stores a list of override specs matching
apps.api.services.branch_service.OverrideSpec's fields, keeping every named
scenario mechanically traceable to a real engine input rather than free-form
formula text -- see db/seeds/seed_scenario_templates.py (Phase 5) for the
actual seeded entries, including the Liquidity Crunch scenario's explicit
sigma/volatility pairing (Section 11.2/11.4).
"""

from datetime import date
from typing import Any, Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.services.branch_service import TARGET_KEY_VOCABULARIES, VALID_TARGET_TYPES, OverrideSpec
from db.models import ScenarioTemplate, TimelineOverride

REQUIRED_OVERRIDE_KEYS = frozenset({"target_type", "target_key", "override_value"})


def _validate_effect_profile(effect_profile: dict[str, Any]) -> None:
    """Validate effect_profile["overrides"] shape at authoring time.

    effect_profile is a free-form JSON column with no DB-level schema
    validation, so a malformed template previously passed create_template
    unchecked and only surfaced a bare KeyError/500 much later, whenever
    apply_scenario_template first tried to materialize it onto a real
    timeline -- far from the authoring action that actually caused it.
    """
    raw_overrides = (effect_profile or {}).get("overrides", [])
    if not isinstance(raw_overrides, list):
        raise ConflictError("effect_profile['overrides'] must be a list")
    for i, raw in enumerate(raw_overrides):
        if not isinstance(raw, dict):
            raise ConflictError(f"effect_profile['overrides'][{i}] must be an object")
        missing = REQUIRED_OVERRIDE_KEYS - raw.keys()
        if missing:
            raise ConflictError(f"effect_profile['overrides'][{i}] is missing required keys: {sorted(missing)}")
        target_type = raw["target_type"]
        if target_type not in VALID_TARGET_TYPES:
            raise ConflictError(f"effect_profile['overrides'][{i}] has unknown target_type '{target_type}'")
        vocab = TARGET_KEY_VOCABULARIES.get(target_type)
        if vocab is not None and raw["target_key"] not in vocab:
            raise ConflictError(
                f"effect_profile['overrides'][{i}] target_key '{raw['target_key']}' is not valid for "
                f"target_type '{target_type}' (expected one of {sorted(vocab)})"
            )


def list_templates(db: Session) -> list[ScenarioTemplate]:
    return db.query(ScenarioTemplate).order_by(ScenarioTemplate.name).all()


def create_template(
    db: Session,
    name: str,
    category: str,
    effect_profile: dict[str, Any],
    description: Optional[str] = None,
    default_duration_days: Optional[int] = None,
    editable_params: Optional[dict[str, Any]] = None,
) -> ScenarioTemplate:
    _validate_effect_profile(effect_profile)
    template = ScenarioTemplate(
        name=name,
        description=description,
        category=category,
        effect_profile=effect_profile,
        default_duration_days=default_duration_days,
        editable_params=editable_params,
    )
    db.add(template)
    db.flush()
    return template


def apply_scenario_template(
    db: Session,
    template_id: int,
    timeline_id: int,
    effective_from_sim_date: date,
    duration_days: Optional[int] = None,
) -> list[TimelineOverride]:
    """Materialize a template's canned override set onto a real timeline.

    effect_profile["overrides"] is a list of dicts with the same shape as
    OverrideSpec (minus effective_from_sim_date, which this function fills
    in uniformly for every override in the template). Used by both the
    branch-creation wizard (picking a named scenario) and directly via the
    scenario-library endpoints.
    """
    template = db.query(ScenarioTemplate).filter_by(id=template_id).first()
    if template is None:
        raise NotFoundError(f"ScenarioTemplate {template_id} not found")

    days = duration_days if duration_days is not None else template.default_duration_days
    effective_to = None
    if days is not None:
        from datetime import timedelta
        # engine.overrides.resolve_active_overrides treats effective_to_sim_date
        # as INCLUSIVE (active on effective_from through effective_to, both
        # ends counted) -- so a `days`-long scenario starting on
        # effective_from_sim_date must end on effective_from + (days - 1), not
        # + days, or it silently runs one day longer than requested (days + 1
        # active days instead of days).
        effective_to = effective_from_sim_date + timedelta(days=days - 1)

    # Defense in depth: create_template validates this shape at authoring
    # time, but templates written before that check existed (or via a
    # direct DB write/migration) could still be malformed, so re-validate
    # here rather than letting a bare KeyError surface as an unhandled 500
    # far from the template that actually caused it.
    _validate_effect_profile(template.effect_profile or {})

    raw_overrides = (template.effect_profile or {}).get("overrides", [])
    rows: list[TimelineOverride] = []
    for raw in raw_overrides:
        row = TimelineOverride(
            timeline_id=timeline_id,
            target_type=raw["target_type"],
            target_key=raw["target_key"],
            target_scope_id=raw.get("target_scope_id"),
            override_value=str(raw["override_value"]),
            effective_from_sim_date=effective_from_sim_date,
            effective_to_sim_date=effective_to,
        )
        db.add(row)
        rows.append(row)

    db.flush()
    return rows

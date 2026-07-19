"""Future Lab (Section 11.4) — the named scenario library."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user, require_admin
from apps.api.database import get_db
from apps.api.schemas import ScenarioTemplateCreateRequest, ScenarioTemplateResponse
from apps.api.services import scenario_service
from db.models import ScenarioTemplate, User

router = APIRouter(prefix="/api/v1/sim/scenario-library", tags=["Future Lab"])


@router.get("", response_model=list[ScenarioTemplateResponse])
def list_scenario_library(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ScenarioTemplate]:
    return scenario_service.list_templates(db)


@router.post("", response_model=ScenarioTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_scenario_template(
    request: ScenarioTemplateCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ScenarioTemplate:
    template = scenario_service.create_template(
        db,
        name=request.name,
        category=request.category,
        effect_profile=request.effect_profile,
        description=request.description,
        default_duration_days=request.default_duration_days,
        editable_params=request.editable_params,
    )
    db.commit()
    return template

"""Market Explorer screener and research-workspace endpoints."""

import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user, get_current_user_optional
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.schemas import (
    BreadthResponse,
    ChartAnnotationCreateRequest,
    ChartAnnotationResponse,
    ChartAnnotationUpdateRequest,
    CorrelationResponse,
    DcfRequest,
    DcfResponse,
    FormulaEvaluateRequest,
    FormulaEvaluateResponse,
    SavedScreenCreateRequest,
    SavedScreenResponse,
    SavedScreenUpdateRequest,
    ScreenerHeatmapCell,
    ScreenerHeatmapRequest,
    ScreenerMetric,
    ScreenerPreset,
    ScreenerQuery,
    ScreenerQueryResponse,
    ScreenerRanking,
    ScreenerRankingRequest,
    ScreenerExposureRequest,
    ScreenerExposurePoint,
    ScreenerEventImpactResponse,
    ScreenerNewsClustersResponse,
    ScreenerTranscriptSearchResponse,
    ResearchNotebookBlockInput,
    ResearchNotebookBlockResponse,
    ResearchNotebookCreateRequest,
    ResearchNotebookResponse,
    ResearchNotebookUpdateRequest,
)
from apps.api.services import screener_service
from db.models import ChartAnnotation, ResearchNotebook, ResearchNotebookBlock, SavedScreen, User

router = APIRouter(prefix="/api/v1/screener", tags=["Screener"])


def _saved_response(row: SavedScreen) -> SavedScreenResponse:
    return SavedScreenResponse(
        id=row.id,
        name=row.name,
        description=row.description,
        query=ScreenerQuery.model_validate(row.query_json),
        columns=row.columns_json or [],
        sort=[entry for entry in (row.sort_json or [])],
        view_mode=row.view_mode,
        timeline_id=row.timeline_id,
        as_of_date=row.as_of_date,
        visibility=row.visibility,
        version=row.version,
        fingerprint=row.fingerprint,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/metrics", response_model=list[ScreenerMetric])
def get_screener_metrics() -> list[ScreenerMetric]:
    return screener_service.metric_definitions()


@router.post("/dcf/{ticker}", response_model=DcfResponse)
def run_dcf(ticker: str, body: DcfRequest, timeline_id: int = Query(default=settings.default_timeline_id), as_of_date: Optional[date] = Query(default=None), db: Session = Depends(get_db)) -> DcfResponse:
    try:
        return screener_service.calculate_dcf(db, ticker, body, timeline_id, as_of_date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/correlation", response_model=CorrelationResponse)
def get_correlation(
    tickers: str = Query(..., description="Comma-separated tickers"),
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    lookback: int = Query(default=60, ge=5, le=252),
    db: Session = Depends(get_db),
) -> CorrelationResponse:
    symbols = [ticker.strip() for ticker in tickers.split(",") if ticker.strip()][:12]
    if not symbols:
        raise HTTPException(status_code=422, detail="At least one ticker is required")
    return screener_service.correlation_matrix(db, symbols, timeline_id, as_of_date, lookback)


@router.get("/breadth", response_model=BreadthResponse)
def get_breadth(
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    lookback: int = Query(default=60, ge=5, le=252),
    db: Session = Depends(get_db),
) -> BreadthResponse:
    return screener_service.breadth_series(db, timeline_id, as_of_date, lookback)


@router.post("/formulas/evaluate", response_model=FormulaEvaluateResponse)
def evaluate_screener_formula(body: FormulaEvaluateRequest, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)) -> FormulaEvaluateResponse:
    try:
        return screener_service.evaluate_formula(db, body, user)
    except (SyntaxError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/exposure", response_model=list[ScreenerExposurePoint])
def get_factor_exposure(body: ScreenerExposureRequest, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)) -> list[ScreenerExposurePoint]:
    try:
        return screener_service.factor_exposure_map(db, body, user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/news-clusters", response_model=ScreenerNewsClustersResponse)
def get_news_clusters(
    ticker: Optional[str] = Query(default=None),
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> ScreenerNewsClustersResponse:
    try:
        return screener_service.news_clusters(db, ticker, timeline_id, as_of_date, limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/transcript-search/{ticker}", response_model=ScreenerTranscriptSearchResponse)
def search_transcripts(
    ticker: str,
    q: str = Query(..., min_length=1, max_length=160),
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ScreenerTranscriptSearchResponse:
    try:
        return screener_service.transcript_search(db, ticker, q, timeline_id, as_of_date, limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/event-impacts/{ticker}", response_model=ScreenerEventImpactResponse)
def get_event_impacts(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> ScreenerEventImpactResponse:
    try:
        return screener_service.event_impacts(db, ticker, timeline_id, as_of_date, limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _block_response(row: ResearchNotebookBlock) -> ResearchNotebookBlockResponse:
    return ResearchNotebookBlockResponse(
        id=row.id,
        notebook_id=row.notebook_id,
        block_type=row.block_type,
        position=row.position,
        payload=row.payload_json or {},
        provenance=row.provenance_json or {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _notebook_response(row: ResearchNotebook, db: Session) -> ResearchNotebookResponse:
    blocks = db.query(ResearchNotebookBlock).filter(ResearchNotebookBlock.notebook_id == row.id).order_by(ResearchNotebookBlock.position, ResearchNotebookBlock.id).all()
    return ResearchNotebookResponse(
        id=row.id,
        title=row.title,
        description=row.description,
        query=row.query_json or {},
        visibility=row.visibility,
        version=row.version,
        blocks=[_block_response(block) for block in blocks],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/notebooks", response_model=list[ResearchNotebookResponse])
def list_research_notebooks(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ResearchNotebookResponse]:
    rows = db.query(ResearchNotebook).filter(ResearchNotebook.user_id == user.id).order_by(ResearchNotebook.updated_at.desc()).all()
    return [_notebook_response(row, db) for row in rows]


@router.post("/notebooks", response_model=ResearchNotebookResponse, status_code=status.HTTP_201_CREATED)
def create_research_notebook(body: ResearchNotebookCreateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchNotebookResponse:
    if db.query(ResearchNotebook).filter(ResearchNotebook.user_id == user.id, ResearchNotebook.title == body.title).first():
        raise HTTPException(status_code=409, detail="A notebook with this title already exists")
    row = ResearchNotebook(user_id=user.id, title=body.title, description=body.description, query_json=body.query, visibility=body.visibility)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _notebook_response(row, db)


@router.patch("/notebooks/{notebook_id}", response_model=ResearchNotebookResponse)
def update_research_notebook(notebook_id: int, body: ResearchNotebookUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchNotebookResponse:
    row = db.query(ResearchNotebook).filter(ResearchNotebook.id == notebook_id, ResearchNotebook.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if body.title is not None and body.title != row.title and db.query(ResearchNotebook).filter(ResearchNotebook.user_id == user.id, ResearchNotebook.title == body.title).first():
        raise HTTPException(status_code=409, detail="A notebook with this title already exists")
    if body.title is not None: row.title = body.title
    if body.description is not None: row.description = body.description
    if body.query is not None: row.query_json = body.query
    if body.visibility is not None: row.visibility = body.visibility
    row.version += 1
    db.commit()
    db.refresh(row)
    return _notebook_response(row, db)


@router.delete("/notebooks/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_research_notebook(notebook_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    row = db.query(ResearchNotebook).filter(ResearchNotebook.id == notebook_id, ResearchNotebook.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    db.delete(row)
    db.commit()


@router.post("/notebooks/{notebook_id}/blocks", response_model=ResearchNotebookBlockResponse, status_code=status.HTTP_201_CREATED)
def create_notebook_block(notebook_id: int, body: ResearchNotebookBlockInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchNotebookBlockResponse:
    notebook = db.query(ResearchNotebook).filter(ResearchNotebook.id == notebook_id, ResearchNotebook.user_id == user.id).first()
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    row = ResearchNotebookBlock(notebook_id=notebook.id, block_type=body.block_type, position=body.position, payload_json=body.payload, provenance_json=body.provenance)
    db.add(row)
    notebook.version += 1
    db.commit()
    db.refresh(row)
    return _block_response(row)


@router.delete("/notebooks/{notebook_id}/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook_block(notebook_id: int, block_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    notebook = db.query(ResearchNotebook).filter(ResearchNotebook.id == notebook_id, ResearchNotebook.user_id == user.id).first()
    row = db.query(ResearchNotebookBlock).filter(ResearchNotebookBlock.id == block_id, ResearchNotebookBlock.notebook_id == notebook_id).first()
    if notebook is None or row is None:
        raise HTTPException(status_code=404, detail="Notebook block not found")
    db.delete(row)
    notebook.version += 1
    db.commit()


def _annotation_response(row: ChartAnnotation) -> ChartAnnotationResponse:
    return ChartAnnotationResponse(id=row.id, ticker=row.ticker, timeline_id=row.timeline_id, timeframe=row.timeframe, tool=row.tool, anchors=row.anchors_json or [], style=row.style_json or {}, evidence=row.evidence_json or {}, version=row.version, created_at=row.created_at, updated_at=row.updated_at)


@router.get("/annotations", response_model=list[ChartAnnotationResponse])
def list_chart_annotations(ticker: Optional[str] = Query(default=None), timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ChartAnnotationResponse]:
    query = db.query(ChartAnnotation).filter(ChartAnnotation.user_id == user.id, ChartAnnotation.timeline_id == timeline_id)
    if ticker:
        query = query.filter(ChartAnnotation.ticker == ticker.upper())
    return [_annotation_response(row) for row in query.order_by(ChartAnnotation.updated_at.desc()).limit(500).all()]


@router.post("/annotations", response_model=ChartAnnotationResponse, status_code=status.HTTP_201_CREATED)
def create_chart_annotation(body: ChartAnnotationCreateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ChartAnnotationResponse:
    row = ChartAnnotation(user_id=user.id, ticker=body.ticker.upper(), timeline_id=body.timeline_id, timeframe=body.timeframe, tool=body.tool, anchors_json=body.anchors, style_json=body.style, evidence_json=body.evidence)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _annotation_response(row)


@router.delete("/annotations/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chart_annotation(annotation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    row = db.query(ChartAnnotation).filter(ChartAnnotation.id == annotation_id, ChartAnnotation.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(row)
    db.commit()


@router.patch("/annotations/{annotation_id}", response_model=ChartAnnotationResponse)
def update_chart_annotation(annotation_id: int, body: ChartAnnotationUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ChartAnnotationResponse:
    row = db.query(ChartAnnotation).filter(ChartAnnotation.id == annotation_id, ChartAnnotation.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if body.timeframe is not None: row.timeframe = body.timeframe
    if body.tool is not None: row.tool = body.tool
    if body.anchors is not None: row.anchors_json = body.anchors
    if body.style is not None: row.style_json = body.style
    if body.evidence is not None: row.evidence_json = body.evidence
    row.version += 1
    db.commit()
    db.refresh(row)
    return _annotation_response(row)


@router.get("/presets", response_model=list[ScreenerPreset])
def get_screener_presets() -> list[ScreenerPreset]:
    base = ScreenerQuery(timeline_id=settings.default_timeline_id, columns=screener_service.DEFAULT_COLUMNS)
    return [
        ScreenerPreset(
            id="quality-growth",
            name="Quality compounders",
            description="Financial quality and growth above 60 with positive one-month momentum.",
            query=base.model_copy(update={
                "clauses": [
                    {"metric": "financial_quality", "operator": ">=", "value": 60},
                    {"metric": "growth_potential", "operator": ">=", "value": 60},
                    {"metric": "return_1m_pct", "operator": ">", "value": 0},
                ],
                "sort": [{"metric": "financial_quality", "direction": "desc"}],
            }),
        ),
        ScreenerPreset(
            id="oversold-value",
            name="Oversold value",
            description="RSI below 35 with a positive intrinsic-value gap.",
            query=base.model_copy(update={
                "clauses": [
                    {"metric": "rsi_14", "operator": "<", "value": 35},
                    {"metric": "iv_gap_pct", "operator": "<", "value": -10},
                ],
                "sort": [{"metric": "iv_gap_pct", "direction": "asc"}],
            }),
        ),
    ]


@router.post("/query", response_model=ScreenerQueryResponse)
def run_screener_query(query: ScreenerQuery, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)) -> ScreenerQueryResponse:
    try:
        return screener_service.query_screener(db, query, user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/export")
def export_screener_csv(
    query: ScreenerQuery,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> StreamingResponse:
    """Export the complete bounded result set for a reproducible screen.

    The export deliberately reuses the exact query executor instead of
    exporting whichever page happens to be visible in React.  The service
    caps the result at a safe, documented maximum and includes the query
    fingerprint in response headers for auditability.
    """
    try:
        csv_text, fingerprint, as_of_date, exported_rows, total_rows = screener_service.export_csv(db, query, user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    headers = {
        "Content-Disposition": 'attachment; filename="market-screen.csv"',
        "X-Screener-Query-Fingerprint": fingerprint,
        "X-Screener-As-Of-Date": as_of_date.isoformat(),
        "X-Screener-Exported-Rows": str(exported_rows),
        "X-Screener-Total-Rows": str(total_rows),
        "X-Screener-Export-Truncated": str(total_rows > exported_rows).lower(),
    }
    return StreamingResponse(io.BytesIO(csv_text.encode("utf-8")), media_type="text/csv; charset=utf-8", headers=headers)


@router.post("/heatmap", response_model=list[ScreenerHeatmapCell])
def run_screener_heatmap(body: ScreenerHeatmapRequest, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)) -> list[ScreenerHeatmapCell]:
    try:
        return screener_service.heatmap(db, body.query, body.color_metric, body.size_metric, user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/heatmap", response_model=list[ScreenerHeatmapCell])
def get_screener_heatmap(
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    color_metric: str = Query(default="day_change_pct"),
    size_metric: str = Query(default="market_cap"),
    db: Session = Depends(get_db),
) -> list[ScreenerHeatmapCell]:
    query = ScreenerQuery(timeline_id=timeline_id, as_of_date=as_of_date, columns=screener_service.DEFAULT_COLUMNS)
    try:
        return screener_service.heatmap(db, query, color_metric, size_metric)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/rankings", response_model=list[ScreenerRanking])
def run_screener_rankings(body: ScreenerRankingRequest, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)) -> list[ScreenerRanking]:
    try:
        return screener_service.rankings(db, body.query, body.metric, body.direction, body.limit, user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/rankings", response_model=list[ScreenerRanking])
def get_screener_rankings(
    metric: str = Query(default="market_cap"),
    direction: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=50, ge=1, le=500),
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ScreenerRanking]:
    query = ScreenerQuery(timeline_id=timeline_id, as_of_date=as_of_date, columns=[metric])
    try:
        return screener_service.rankings(db, query, metric, direction, limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/peers/{ticker}", response_model=ScreenerQueryResponse)
def get_screener_peers(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
) -> ScreenerQueryResponse:
    from db.models import Company, Industry

    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
    industry = db.query(Industry).filter(Industry.id == company.industry_id).first()
    query = ScreenerQuery(
        timeline_id=timeline_id,
        as_of_date=as_of_date,
        universe={"type": "industry", "industry_names": [industry.name] if industry else []},
        columns=screener_service.DEFAULT_COLUMNS,
        sort=[{"metric": "market_cap", "direction": "desc"}],
    )
    response = screener_service.query_screener(db, query)
    response.rows = [row for row in response.rows if row.company.ticker.upper() != ticker.upper()]
    response.total = max(0, response.total - 1)
    return response


@router.get("/saved-screens", response_model=list[SavedScreenResponse])
def list_saved_screens(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SavedScreenResponse]:
    return [_saved_response(row) for row in db.query(SavedScreen).filter(SavedScreen.user_id == user.id).order_by(SavedScreen.updated_at.desc()).all()]


@router.post("/saved-screens", response_model=SavedScreenResponse, status_code=status.HTTP_201_CREATED)
def create_saved_screen(
    body: SavedScreenCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SavedScreenResponse:
    if db.query(SavedScreen).filter(SavedScreen.user_id == user.id, SavedScreen.name == body.name).first():
        raise HTTPException(status_code=409, detail="A saved screen with this name already exists")
    row = SavedScreen(
        user_id=user.id,
        name=body.name,
        description=body.description,
        query_json=body.query.model_dump(mode="json"),
        columns_json=body.columns or body.query.columns,
        sort_json=[entry.model_dump(mode="json") for entry in (body.sort or body.query.sort)],
        view_mode=body.view_mode,
        timeline_id=body.query.timeline_id,
        as_of_date=body.query.as_of_date,
        visibility=body.visibility,
        fingerprint=screener_service.fingerprint_query(body.query),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _saved_response(row)


@router.patch("/saved-screens/{screen_id}", response_model=SavedScreenResponse)
def update_saved_screen(
    screen_id: int,
    body: SavedScreenUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SavedScreenResponse:
    row = db.query(SavedScreen).filter(SavedScreen.id == screen_id, SavedScreen.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    if body.name is not None and body.name != row.name and db.query(SavedScreen).filter(SavedScreen.user_id == user.id, SavedScreen.name == body.name).first():
        raise HTTPException(status_code=409, detail="A saved screen with this name already exists")
    if body.name is not None:
        row.name = body.name
    if body.description is not None:
        row.description = body.description
    if body.query is not None:
        row.query_json = body.query.model_dump(mode="json")
        row.timeline_id = body.query.timeline_id
        row.as_of_date = body.query.as_of_date
        row.fingerprint = screener_service.fingerprint_query(body.query)
    if body.columns is not None:
        row.columns_json = body.columns
    if body.sort is not None:
        row.sort_json = [entry.model_dump(mode="json") for entry in body.sort]
    if body.view_mode is not None:
        row.view_mode = body.view_mode
    if body.visibility is not None:
        row.visibility = body.visibility
    row.version += 1
    db.commit()
    db.refresh(row)
    return _saved_response(row)


@router.delete("/saved-screens/{screen_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    row = db.query(SavedScreen).filter(SavedScreen.id == screen_id, SavedScreen.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    db.delete(row)
    db.commit()


@router.post("/saved-screens/{screen_id}/run", response_model=ScreenerQueryResponse)
def run_saved_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScreenerQueryResponse:
    row = db.query(SavedScreen).filter(SavedScreen.id == screen_id, SavedScreen.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    return screener_service.query_screener(db, ScreenerQuery.model_validate(row.query_json), user)

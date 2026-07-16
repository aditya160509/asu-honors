"""Pytest fixtures for API tests: in-memory SQLite DB shared across connections."""

from datetime import date, datetime, timezone

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure JSONB (Postgres) columns compile as plain JSON under SQLite, matching
# the pattern already used by tests/test_orchestrator.py in this repo.
SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

os.environ["DATABASE_URL"] = "sqlite://"

from apps.api.auth import create_access_token, hash_password
from apps.api.database import get_db
from apps.api.main import app
from apps.api.rate_limiter import InMemoryRateLimiter
from db.models import Base, Company, ConfigParameter, Industry, Portfolio, Timeline, SimulationState, User

# Bump rate limit so tests don't hit 429
for mw in app.user_middleware:
    if mw.cls is InMemoryRateLimiter:
        mw.kwargs["max_requests"] = 100000


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def test_db(engine):
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(test_db):
    def _override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = _override_get_db
    # Remove rate limiter middleware for tests to avoid 429 errors
    app.user_middleware = [m for m in app.user_middleware if m.cls.__name__ != "InMemoryRateLimiter"]
    app.middleware_stack = app.build_middleware_stack()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(test_db: Session) -> User:
    user = User(
        email="alice@example.com",
        hashed_password=hash_password("password"),
        display_name="Alice",
        role="user",
        starting_cash=100_000.0,
        # Fixture bypasses POST /auth/register (where skip_email_verification
        # normally auto-verifies) — mark verified directly so login-flow tests
        # against this fixture reflect a normal, usable account.
        email_verified_at=datetime.now(timezone.utc),
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture()
def test_admin(test_db: Session) -> User:
    admin = User(
        email="admin@example.com",
        hashed_password=hash_password("password"),
        display_name="Admin",
        role="admin",
        starting_cash=100_000.0,
        email_verified_at=datetime.now(timezone.utc),
    )
    test_db.add(admin)
    test_db.commit()
    test_db.refresh(admin)
    return admin


@pytest.fixture()
def auth_headers(test_user: User) -> dict:
    token = create_access_token(data={"sub": str(test_user.id), "role": test_user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_auth_headers(test_admin: User) -> dict:
    token = create_access_token(data={"sub": str(test_admin.id), "role": test_admin.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def test_timeline(test_db: Session) -> Timeline:
    timeline = Timeline(id=1, name="Live Market", rng_seed=42, is_live=True)
    test_db.add(timeline)
    test_db.commit()

    sim_state = SimulationState(
        timeline_id=1,
        current_sim_date=date(2026, 1, 2),
        tick_count=0,
        is_running=False,
    )
    test_db.add(sim_state)
    test_db.commit()
    return timeline


@pytest.fixture()
def test_industry(test_db: Session) -> Industry:
    industry = Industry(
        id=1,
        name="Test Industry",
        description="",
        base_volatility=20.0,
        cycle_sensitivity=1.0,
        sector_beta_default=0.8,
        subfactor_set="standard",
    )
    test_db.add(industry)
    test_db.commit()
    return industry


@pytest.fixture()
def test_company(test_db: Session, test_industry: Industry) -> Company:
    company = Company(
        id=1,
        name="Test Corp",
        ticker="TST",
        industry_id=test_industry.id,
        shares_outstanding=100_000_000,
        free_float_pct=0.8,
        beta_market=1.0,
        beta_sector=0.5,
        current_price=100.0,
        intrinsic_value=100.0,
        intrinsic_score=50.0,
        fair_pe=15.0,
        market_cap=10_000_000_000.0,
        volatility=0.02,
        market_liquidity_score=80.0,
    )
    test_db.add(company)
    test_db.commit()
    return company


@pytest.fixture()
def test_portfolio(test_db: Session, test_user: User, test_timeline: Timeline) -> Portfolio:
    portfolio = Portfolio(
        user_id=test_user.id,
        timeline_id=test_timeline.id,
        cash_balance=100_000.0,
        total_value=100_000.0,
    )
    test_db.add(portfolio)
    test_db.commit()
    test_db.refresh(portfolio)
    return portfolio


@pytest.fixture()
def base_config(test_db: Session) -> None:
    """Config parameters required by engine.orchestrator.run_tick."""
    params = {
        "mean_reversion_rate": "0.05",
        "quality_mult_min": "0.6",
        "quality_mult_max": "2.0",
        "quality_mult_k": "0.11",
        "quality_mult_inflection": "60",
        "growth_rate_min": "2.0",
        "growth_rate_max": "60.0",
        "r_cap": "0.20",
        "w_vo": "0.20",
        "w_es": "0.15",
        "w_ns": "0.15",
        "w_eo": "0.10",
        "w_g": "0.15",
        "w_tm": "0.10",
        "w_ib": "0.15",
        "k_m": "2.0",
        "liquidity_sensitivity": "0.5",
        "expected_annual_growth": "0.08",
        "rho_es": "0.15",
        "rho_g": "0.15",
        "rho_news": "0.1",
        "trade_fee_rate": "0.001",
    }
    for key, value in params.items():
        test_db.add(ConfigParameter(key=key, value=value, scope="global"))
    test_db.add(ConfigParameter(
        key="neutral_industry_peg", value="1.4", scope="industry", scope_id=1,
    ))
    test_db.commit()

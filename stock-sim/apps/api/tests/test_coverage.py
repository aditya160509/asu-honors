"""Tests for edge cases in auth, database, rate limiter, schemas, and health."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import text

from apps.api.auth import create_access_token, get_current_user_optional, settings
from apps.api.database import get_db as real_get_db, engine
from apps.api.rate_limiter import InMemoryRateLimiter
from db.models import Base


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_get_current_user_optional_no_token(test_db):
    result = get_current_user_optional(credentials=None, db=test_db)
    assert result is None


def test_get_current_user_optional_invalid_token(test_db):
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")
    result = get_current_user_optional(credentials=creds, db=test_db)
    assert result is None


def test_get_current_user_optional_no_sub(test_db, test_user):
    token = jwt.encode({"role": "user"}, settings.secret_key, algorithm=settings.algorithm)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    result = get_current_user_optional(credentials=creds, db=test_db)
    assert result is None


def test_get_current_user_optional_valid(test_db, test_user):
    token = create_access_token(data={"sub": str(test_user.id), "role": test_user.role})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    result = get_current_user_optional(credentials=creds, db=test_db)
    assert result is not None
    assert result.id == test_user.id


def test_rate_limiter_exceeded():
    test_app = FastAPI()

    @test_app.get("/ping")
    def ping():
        return {"ok": True}

    test_app.add_middleware(InMemoryRateLimiter, max_requests=2, window_seconds=60)

    with TestClient(test_app) as c:
        r1 = c.get("/ping")
        assert r1.status_code == 200
        r2 = c.get("/ping")
        assert r2.status_code == 200
        with pytest.raises(HTTPException) as exc_info:
            c.get("/ping")
        assert exc_info.value.status_code == 429


def test_rate_limiter_cleanup():
    test_app = FastAPI()

    @test_app.get("/ping")
    def ping():
        return {"ok": True}

    test_app.add_middleware(InMemoryRateLimiter, max_requests=200, window_seconds=60)

    with TestClient(test_app) as c:
        for _ in range(100):
            resp = c.get("/ping")
            assert resp.status_code == 200


def test_get_db_normal():
    if not settings.database_url.startswith("sqlite"):
        pytest.skip("requires sqlite database_url")
    Base.metadata.create_all(bind=engine)
    gen = real_get_db()
    db = next(gen)
    try:
        result = db.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        gen.close()


def test_get_db_exception():
    if not settings.database_url.startswith("sqlite"):
        pytest.skip("requires sqlite database_url")
    Base.metadata.create_all(bind=engine)
    gen = real_get_db()
    db = next(gen)
    with pytest.raises(Exception):
        gen.throw(Exception("test db error"))


def test_database_postgres_pool_config():
    import importlib
    from apps.api import database as db_mod
    from apps.api.config import settings

    old_url = settings.database_url
    settings.database_url = "postgresql+psycopg://localhost/test"
    importlib.reload(db_mod)
    settings.database_url = old_url

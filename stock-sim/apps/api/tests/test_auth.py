"""Tests for /api/v1/auth endpoints."""

from apps.api.auth import verify_password
from apps.api.config import settings
from jose import jwt


def test_verify_password_malformed_hash(client):
    assert verify_password("test", "not-a-valid-hash") is False


def test_register_success(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "bob@example.com", "password": "password123", "display_name": "Bob"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "bob@example.com"
    assert body["display_name"] == "Bob"
    assert body["role"] == "user"


def test_register_duplicate_email(client):
    payload = {"email": "bob@example.com", "password": "password123", "display_name": "Bob"}
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


def test_login_success(client, test_user):
    resp = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "password"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    resp = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "password"})
    assert resp.status_code == 401


def test_me_authenticated(client, test_user, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@example.com"


def test_me_no_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_invalid_token(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_register_password_too_short(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "1234567", "display_name": "Short"},
    )
    assert resp.status_code == 422


def test_register_password_too_long(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "long@example.com", "password": "x" * 73, "display_name": "Long"},
    )
    assert resp.status_code == 422


def test_me_token_no_sub(client, test_user):
    token = jwt.encode({"role": "user"}, settings.secret_key, algorithm=settings.algorithm)
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_me_token_non_int_sub(client, test_user):
    token = jwt.encode({"sub": "abc", "role": "user"}, settings.secret_key, algorithm=settings.algorithm)
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_me_token_user_not_found(client, test_user):
    token = jwt.encode({"sub": "99999", "role": "user"}, settings.secret_key, algorithm=settings.algorithm)
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401

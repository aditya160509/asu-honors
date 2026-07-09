"""Tests for /api/v1/auth endpoints."""


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

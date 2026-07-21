"""Tests for the notifications WebSocket (apps/api/routers/ws.py) and its
publish helper (apps/api/ws_manager.py). No Redis server runs in this test
environment (see conftest.py's celery_eager fixture, which stubs out the
Celery worker ping for the same reason) -- these tests cover what's testable
without one: auth rejection (closes before ever touching Redis) and the
publish-side circuit breaker."""

import time

import pytest
from fastapi import WebSocketDisconnect
from starlette.testclient import TestClient

from apps.api import ws_manager


def test_ws_notifications_rejects_missing_token(client: TestClient):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/ws/notifications"):
            pass


def test_ws_notifications_rejects_invalid_token(client: TestClient):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/ws/notifications?token=not-a-real-jwt"):
            pass


def test_publish_user_event_swallows_connection_failure(monkeypatch):
    """No Redis server is running here, so a real publish attempt should fail
    without raising into the caller (notification_service.create_notification
    must never break because a push happened to be undeliverable)."""
    ws_manager._client = None
    ws_manager._unavailable_until = 0.0

    # publish_user_event must not raise even though nothing is listening on
    # settings.redis_url in this test environment.
    ws_manager.publish_user_event(1, "notification", {"id": 1})


def test_publish_user_event_cooldown_skips_repeat_attempts(monkeypatch):
    """After a failed publish, subsequent calls within the cooldown window
    must short-circuit instead of re-paying a connection timeout on every
    single notification."""
    ws_manager._client = None
    ws_manager._unavailable_until = 0.0

    call_count = 0

    class _BoomClient:
        def publish(self, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise ConnectionError("simulated: no broker reachable")

    monkeypatch.setattr(ws_manager, "_get_client", lambda: _BoomClient())

    ws_manager.publish_user_event(1, "notification", {"id": 1})
    assert call_count == 1
    assert ws_manager._unavailable_until > time.monotonic()

    # Still within cooldown -- must not call the client again.
    ws_manager.publish_user_event(1, "notification", {"id": 2})
    assert call_count == 1

    # Reset for other tests in the same process.
    ws_manager._unavailable_until = 0.0

"""Tests for WebSocket auth and zero-infrastructure notification fan-out."""

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


def test_publish_user_event_without_subscriber_is_safe():
    ws_manager.publish_user_event(1, "notification", {"id": 1})


def test_publish_user_event_fans_out_to_local_subscribers():
    channel = ws_manager.subscribe(1)
    try:
        ws_manager.publish_user_event(1, "notification", {"id": 2})
        message = channel.get_nowait()
        assert '"type": "notification"' in message
        assert '"id": 2' in message
    finally:
        ws_manager.unsubscribe(1, channel)

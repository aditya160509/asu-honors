"""Best-effort live push over Redis pub/sub for the notifications WebSocket
(apps/api/routers/ws.py). Notifications are still fully usable via polling
(RecentActivity's useNotifications, 15s interval) if Redis or this publish
step is unavailable -- this is a latency optimization (near-instant instead
of up-to-15s-stale), not the source of truth, so failures here are swallowed
rather than raised into the caller (notification_service.create_notification
must never fail because a push happened to be undeliverable).
"""

import json
import logging
import time
from typing import Any, Optional

import redis

from apps.api.config import settings

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT_SECONDS = 0.2
# After a failed publish, skip further attempts for this long rather than
# re-paying a connection timeout on every single notification when Redis is
# simply not running (local dev without a broker, or the test suite, which
# deliberately never stands one up -- see conftest.py's celery_eager fixture
# stubbing out the Celery worker ping for the same reason).
_COOLDOWN_SECONDS = 30.0

_client: Optional["redis.Redis"] = None
_unavailable_until: float = 0.0


def _get_client() -> "redis.Redis":
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=_CONNECT_TIMEOUT_SECONDS,
            socket_timeout=_CONNECT_TIMEOUT_SECONDS,
        )
    return _client


def user_channel(user_id: int) -> str:
    return f"user-events:{user_id}"


def publish_user_event(user_id: int, event_type: str, data: dict[str, Any]) -> None:
    global _unavailable_until
    now = time.monotonic()
    if now < _unavailable_until:
        return
    try:
        client = _get_client()
        client.publish(user_channel(user_id), json.dumps({"type": event_type, "data": data}))
    except Exception:
        logger.debug("Realtime push unavailable -- falling back to polling only", exc_info=True)
        _unavailable_until = time.monotonic() + _COOLDOWN_SECONDS

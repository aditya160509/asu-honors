"""Best-effort, zero-infrastructure realtime notification fan-out."""

from __future__ import annotations

import json
from queue import Queue
from threading import Lock
from typing import Any

_subscribers: dict[int, set[Queue[str]]] = {}
_lock = Lock()


def subscribe(user_id: int) -> Queue[str]:
    channel: Queue[str] = Queue(maxsize=100)
    with _lock:
        _subscribers.setdefault(user_id, set()).add(channel)
    return channel


def unsubscribe(user_id: int, channel: Queue[str]) -> None:
    with _lock:
        channels = _subscribers.get(user_id)
        if channels is not None:
            channels.discard(channel)
            if not channels:
                _subscribers.pop(user_id, None)


def publish_user_event(user_id: int, event_type: str, data: dict[str, Any]) -> None:
    message = json.dumps({"type": event_type, "data": data})
    with _lock:
        channels = tuple(_subscribers.get(user_id, ()))
    for channel in channels:
        try:
            channel.put_nowait(message)
        except Exception:
            pass

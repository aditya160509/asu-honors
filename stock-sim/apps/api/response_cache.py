"""Small process-local cache for expensive, shared read responses.

The deployment deliberately uses one API process, so a bounded in-memory
cache avoids Redis while collapsing simultaneous dashboard requests. Entries
are short-lived and mutation endpoints invalidate their timeline explicitly.
"""

from __future__ import annotations

from collections import OrderedDict
from threading import RLock
from time import monotonic
from typing import Callable, TypeVar

T = TypeVar("T")


class ResponseCache:
    def __init__(self, max_entries: int = 128) -> None:
        self._max_entries = max_entries
        self._items: OrderedDict[tuple, tuple[float, object]] = OrderedDict()
        self._lock = RLock()

    def get_or_create(self, key: tuple, ttl_seconds: float, factory: Callable[[], T]) -> T:
        now = monotonic()
        with self._lock:
            cached = self._items.get(key)
            if cached is not None and cached[0] > now:
                self._items.move_to_end(key)
                return cached[1]  # type: ignore[return-value]
            if cached is not None:
                del self._items[key]

            # Compute under the lock to prevent a cold-start request burst from
            # running the same heavy SQL aggregation in parallel.
            value = factory()
            self._items[key] = (now + ttl_seconds, value)
            self._items.move_to_end(key)
            while len(self._items) > self._max_entries:
                self._items.popitem(last=False)
            return value

    def invalidate_timeline(self, timeline_id: int) -> None:
        with self._lock:
            for key in [key for key in self._items if timeline_id in key]:
                del self._items[key]

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


response_cache = ResponseCache()

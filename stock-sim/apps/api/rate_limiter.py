"""Simple in-memory rate limiter middleware with periodic stale-IP cleanup,
plus a scoped per-endpoint limiter for sensitive auth flows."""
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException, status

MAX_IP_AGE_SECONDS = 300
CLEANUP_EVERY = 100


class InMemoryRateLimiter(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 300, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self._request_count = 0

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window_seconds

        self.requests[client_ip] = [t for t in self.requests[client_ip] if t > window_start]

        if len(self.requests[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )

        self.requests[client_ip].append(now)

        self._request_count += 1
        if self._request_count % CLEANUP_EVERY == 0:
            cutoff = now - MAX_IP_AGE_SECONDS
            self.requests = {
                ip: times for ip, times in self.requests.items()
                if times and times[-1] > cutoff
            }

        return await call_next(request)


class ScopedRateLimiter:
    """Keyed sliding-window limiter for individual sensitive endpoints
    (forgot-password, OTP request, login). Keys are caller-chosen, e.g.
    "forgot:email:<addr>" or "otp:ip:<ip>", so one limiter instance can
    enforce independent per-email and per-IP caps.

    Raises 429 with a Retry-After header when a cap is exceeded.
    """

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.time()
        window_start = now - window_seconds
        hits = [t for t in self._hits[key] if t > window_start]
        if len(hits) >= max_requests:
            retry_after = max(1, int(hits[0] + window_seconds - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        self._hits[key] = hits

        # Opportunistic cleanup so the map doesn't grow unbounded.
        if len(self._hits) > 10_000:
            cutoff = now - 3600
            self._hits = defaultdict(
                list,
                {k: v for k, v in self._hits.items() if v and v[-1] > cutoff},
            )


auth_rate_limiter = ScopedRateLimiter()
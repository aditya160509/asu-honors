"""Simple in-memory rate limiter middleware with periodic stale-IP cleanup."""
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException, status

MAX_IP_AGE_SECONDS = 300
CLEANUP_EVERY = 100


class InMemoryRateLimiter(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
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
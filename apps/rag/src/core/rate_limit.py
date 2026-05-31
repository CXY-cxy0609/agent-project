from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass

from .errors import AppError


@dataclass
class WindowRateLimiter:
    limit: int
    window_seconds: int

    def __post_init__(self) -> None:
        self._bucket: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        now = time.time()
        dq = self._bucket.setdefault(key, deque())
        while dq and dq[0] <= now - self.window_seconds:
            dq.popleft()
        if len(dq) >= self.limit:
            return False
        dq.append(now)
        return True


def enforce_rate_limit(limiter: WindowRateLimiter, key: str) -> None:
    if limiter.allow(key):
        return
    raise AppError(
        code="RATE_LIMITED",
        message="rate limit exceeded",
        http_status=429,
    )

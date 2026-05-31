from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int
    cooldown_seconds: int


class SimpleCircuitBreaker:
    def __init__(self, config: CircuitBreakerConfig) -> None:
        self._config = config
        self._failures = 0
        self._opened_at: float | None = None

    def allow(self) -> bool:
        if self._opened_at is None:
            return True
        if time.time() - self._opened_at >= self._config.cooldown_seconds:
            self._opened_at = None
            self._failures = 0
            return True
        return False

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self._config.failure_threshold:
            self._opened_at = time.time()

    @property
    def is_open(self) -> bool:
        return self._opened_at is not None and not self.allow()

from __future__ import annotations

import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .metrics import REQUEST_LATENCY_SECONDS, REQUEST_TOTAL

logger = logging.getLogger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        tenant_id = request.headers.get("x-tenant-id", "public")
        started_at = time.perf_counter()
        request.state.request_id = request_id
        request.state.tenant_id = tenant_id
        response_status = 500
        try:
            response = await call_next(request)
            response_status = response.status_code
            response.headers["x-request-id"] = request_id
            response.headers["x-tenant-id"] = tenant_id
            return response
        finally:
            latency = time.perf_counter() - started_at
            REQUEST_LATENCY_SECONDS.labels(request.url.path, request.method).observe(latency)
            REQUEST_TOTAL.labels(request.url.path, request.method, str(response_status)).inc()
            logger.info(
                "request completed",
                extra={
                    "request_id": request_id,
                    "tenant_id": tenant_id,
                    "path": request.url.path,
                    "method": request.method,
                    "latency_ms": round(latency * 1000, 2),
                },
            )

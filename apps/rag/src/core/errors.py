from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette import status


@dataclass
class AppError(Exception):
    code: str
    message: str
    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    details: dict[str, Any] | None = None


class UnauthorizedError(AppError):
    def __init__(self, message: str = "unauthorized"):
        super().__init__(
            code="UNAUTHORIZED",
            message=message,
            http_status=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(AppError):
    def __init__(self, message: str = "forbidden"):
        super().__init__(
            code="FORBIDDEN",
            message=message,
            http_status=status.HTTP_403_FORBIDDEN,
        )


class BadRequestError(AppError):
    def __init__(self, message: str = "bad request", *, details: dict[str, Any] | None = None):
        super().__init__(
            code="BAD_REQUEST",
            message=message,
            http_status=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class NotFoundError(AppError):
    def __init__(self, message: str = "resource not found"):
        super().__init__(
            code="NOT_FOUND",
            message=message,
            http_status=status.HTTP_404_NOT_FOUND,
        )


class UpstreamError(AppError):
    def __init__(self, message: str = "upstream service unavailable"):
        super().__init__(
            code="UPSTREAM_ERROR",
            message=message,
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        trace_id = request.headers.get("x-request-id", "")
        payload = {
            "code": exc.code,
            "message": exc.message,
            "trace_id": trace_id,
        }
        if exc.details:
            payload["details"] = exc.details
        return JSONResponse(status_code=exc.http_status, content=payload)

    @app.exception_handler(Exception)
    async def handle_unknown_error(request: Request, _exc: Exception) -> JSONResponse:
        trace_id = request.headers.get("x-request-id", "")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "code": "INTERNAL_ERROR",
                "message": "internal error",
                "trace_id": trace_id,
            },
        )

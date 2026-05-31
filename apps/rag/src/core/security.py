from __future__ import annotations

from fastapi import Header

from ..config import settings
from .errors import UnauthorizedError, ForbiddenError


def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    if not settings.internal_token:
        raise UnauthorizedError("internal token not configured")
    if not x_internal_token:
        raise UnauthorizedError("missing x-internal-token")
    if x_internal_token != settings.internal_token:
        raise ForbiddenError("invalid internal token")

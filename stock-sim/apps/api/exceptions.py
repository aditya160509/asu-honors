"""Custom HTTP exceptions and handlers for consistent error responses."""

import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ConflictError(HTTPException):
    def __init__(self, detail: str = "Resource already exists") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class ValidationError(HTTPException):
    def __init__(self, detail: str = "Invalid input") -> None:
        super().__init__(status_code=422, detail=detail)


class InsufficientFundsError(HTTPException):
    def __init__(self, detail: str = "Insufficient cash") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class InsufficientSharesError(HTTPException):
    def __init__(self, detail: str = "Not enough shares") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


_ERROR_CODES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    422: "VALIDATION_ERROR",
}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    error_code = _ERROR_CODES.get(exc.status_code, "ERROR")
    logger.info("HTTP %s on %s: %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": error_code},
        headers=getattr(exc, "headers", None),
    )


def add_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers on the given FastAPI app."""
    app.add_exception_handler(HTTPException, http_exception_handler)

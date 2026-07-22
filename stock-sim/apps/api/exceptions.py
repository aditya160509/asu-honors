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
    status.HTTP_422_UNPROCESSABLE_CONTENT: "VALIDATION_ERROR",
}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    error_code = _ERROR_CODES.get(exc.status_code, "ERROR")
    logger.info("HTTP %s on %s: %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": error_code},
        headers=getattr(exc, "headers", None),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for anything that isn't an HTTPException (DB errors, KeyError,
    etc). Without this, FastAPI/Starlette's default handling returns a bare
    500 response with no `detail` key, which the frontend then displays as
    the unhelpful literal string "HTTP 500" -- exactly the symptom behind a
    prior incident (Timeline.rng_seed integer overflow crashing branch
    creation with a raw psycopg error). Logs the full traceback server-side
    but never leaks the raw exception message to the client.
    """
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "error_code": "INTERNAL_ERROR"},
    )


def add_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers on the given FastAPI app."""
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

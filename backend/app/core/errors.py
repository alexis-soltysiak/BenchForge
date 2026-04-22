from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

ErrorHandler = Callable[[Request, Exception], Awaitable[JSONResponse]]


async def database_exception_handler(_: Request, exc: DBAPIError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database unavailable. The API cannot connect to the database.",
            "error_type": exc.__class__.__name__,
            "orig": str(exc.orig) if exc.orig else None,
        },
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": exc.__class__.__name__,
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DBAPIError, database_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
